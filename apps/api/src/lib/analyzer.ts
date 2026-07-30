import * as cheerio from "cheerio";
import type { PageContext, FormInfo, ButtonInfo, LinkInfo } from "@cro/shared";
import { detectChallenge } from "./challenge";
import { assertSafeExternalUrl } from "./net-guard";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const CTA_KEYWORDS =
  /(get started|start free|sign up|signup|buy now|try|book|request|subscribe|download|contact|get my|claim|get a demo|demo|schedule|talk to|learn more|see (a )?demo|free trial|join)/i;

const PRIMARY_HINT = /primary|cta|signup|sign-up|get-started|buy|start|try/i;

/**
 * Fetches the target URL's HTML and extracts CRO-relevant page signals using
 * cheerio. This replaces the Playwright DOM crawl with a lightweight,
 * serverless-friendly HTTP fetch + parse.
 */
export async function analyzePage(url: string): Promise<PageContext> {
  const start = Date.now();
  let finalUrl = url;
  let html = "";
  let blockReason: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": DESKTOP_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timeout);
    finalUrl = res.url || url;
    // Redirect SSRF guard: a public URL can 30x into an internal host. Validate
    // the post-redirect URL before we trust/parse anything from it.
    if (finalUrl !== url) {
      try {
        await assertSafeExternalUrl(finalUrl);
      } catch {
        return buildEmptyContext(url, finalUrl, "Blocked redirect target", start);
      }
    }
    html = await res.text();
    if (res.status >= 400) {
      blockReason =
        res.status === 403 || res.status === 429
          ? "WAF block"
          : `HTTP ${res.status}`;
    }
  } catch {
    // Network failure / timeout — treat as an unreadable page.
    return buildEmptyContext(url, finalUrl, "Empty / non-rendered page", start);
  }

  return extractPageContext(html, url, finalUrl, Date.now() - start, blockReason);
}

/**
 * Builds CRO page signals from browser-rendered HTML (post-JS DOM). Used to
 * recover a usable audit when the plain HTTP fetch was walled by a WAF but the
 * headless browser rendered the real page. Marked as client-rendered so the
 * model trusts the accompanying screenshot alongside these DOM signals.
 */
export function analyzeRenderedHtml(
  html: string,
  url: string,
  finalUrl: string,
  loadTimeMs: number
): PageContext {
  const ctx = extractPageContext(html, url, finalUrl, loadTimeMs, null);
  ctx.clientRendered = true;
  return ctx;
}

/**
 * Parses an HTML document (from a plain fetch or a browser render) into the
 * CRO signals the audit needs. `preBlockReason` carries a block signal detected
 * before parsing (e.g. an HTTP 403/429 status); challenge detection then runs
 * over the parsed content unless a reason is already set.
 */
export function extractPageContext(
  html: string,
  url: string,
  finalUrl: string,
  loadTimeMs: number,
  preBlockReason: string | null = null
): PageContext {
  let blockReason: string | null = preBlockReason;
  const $ = cheerio.load(html);

  const text = (el: cheerio.Cheerio<any>) => el.text().trim().replace(/\s+/g, " ");

  const headings = (sel: string) =>
    $(sel)
      .map((_, el) => text($(el)))
      .get()
      .filter(Boolean)
      .slice(0, 12);

  const h1 = headings("h1");
  const h2 = headings("h2");
  const h3 = headings("h3");

  // Buttons / CTA-like elements
  const buttons: ButtonInfo[] = [];
  $(
    'button, a[role="button"], input[type="submit"], .btn, [class*="button"]'
  ).each((_, el) => {
    const $el = $(el);
    const label = text($el) || $el.attr("value") || "";
    if (!label) return;
    const cls = `${$el.attr("class") ?? ""} ${$el.attr("id") ?? ""}`;
    buttons.push({ text: label, isPrimary: PRIMARY_HINT.test(cls) });
  });
  const dedupedButtons = buttons.slice(0, 20);

  const ctaTexts = dedupedButtons
    .filter((b) => CTA_KEYWORDS.test(b.text))
    .map((b) => b.text)
    .slice(0, 8);

  // Nav links (from the first nav or header)
  const navRoot = $("nav").first().length ? $("nav").first() : $("header").first();
  const navLinks: LinkInfo[] = navRoot.length
    ? navRoot
        .find("a")
        .map((_, a) => ({
          text: text($(a)),
          href: $(a).attr("href") ?? "",
        }))
        .get()
        .filter((l: LinkInfo) => l.text)
        .slice(0, 20)
    : [];

  // Forms
  const forms: FormInfo[] = $("form")
    .map((_, f) => {
      const $f = $(f);
      const fields = $f
        .find("input, select, textarea")
        .filter((_, el) => {
          const type = ($(el).attr("type") ?? "").toLowerCase();
          return !["hidden", "submit", "button"].includes(type);
        })
        .map((_, el) => {
          const $el = $(el);
          return {
            type: ($el.attr("type") ?? el.tagName ?? "text").toLowerCase(),
            name: $el.attr("name") ?? null,
            label: null,
            required: $el.attr("required") !== undefined,
            placeholder: $el.attr("placeholder") ?? null,
          };
        })
        .get();
      const submit = $f.find('[type="submit"], button').first();
      return {
        action: $f.attr("action") ?? null,
        method: $f.attr("method") ?? null,
        fieldCount: fields.length,
        fields: fields.slice(0, 20),
        submitText: submit.length ? text(submit) : null,
      };
    })
    .get();

  // Images + alt coverage
  const imgs = $("img");
  const total = imgs.length;
  const withAlt = imgs.filter((_, i) => (($(i).attr("alt") ?? "").trim().length > 0)).length;

  // Body text / word count
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;

  // Raw, visible copy for the model to critique. Clone the body, drop
  // non-content nodes, then flatten to whitespace-collapsed text (truncated so
  // the prompt stays lean).
  const $copy = cheerio.load(html);
  $copy(
    "script, style, noscript, template, svg, iframe, [aria-hidden='true']"
  ).remove();
  const copyText = $copy("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);

  // Fonts + colors (best-effort from inline styles + style tags)
  const styleBlob = `${$("style").text()} ${$("[style]")
    .map((_, el) => $(el).attr("style") ?? "")
    .get()
    .join(" ")}`;
  const fonts = Array.from(
    new Set(
      (styleBlob.match(/font-family:\s*([^;"}]+)/gi) ?? []).map((m) =>
        m.replace(/font-family:\s*/i, "").trim().toLowerCase()
      )
    )
  ).slice(0, 10);
  const colors = Array.from(
    new Set((styleBlob.match(/#[0-9a-f]{3,8}\b/gi) ?? []).map((c) => c.toLowerCase()))
  ).slice(0, 10);

  const lowerHtml = html.toLowerCase();
  const hasTestimonials = /testimonial|review|rating|what our|customers say/i.test(
    lowerHtml
  );
  const hasPricing = /pricing|\$\d|per month|\/mo|\/month|\bplan\b/i.test(lowerHtml);
  const hasTrustBadges =
    /guarantee|secure|verified|certified|money-back|ssl|trusted by/i.test(lowerHtml);
  const hasSocialProof =
    /trusted by|customers|users|companies|join \d|\d+\+? (customers|users|companies)/i.test(
      lowerHtml
    );
  const hasVideo =
    $("video").length > 0 ||
    $("iframe[src*='youtube'], iframe[src*='vimeo']").length > 0;

  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;
  const hasViewportMeta = $('meta[name="viewport"]').length > 0;
  const title = $("title").first().text().trim() || null;
  const lang = $("html").attr("lang") ?? null;

  // Challenge detection over title + body sample. Scoped to the top of the
  // page so security vendors that merely mention "bots"/"security" deep in
  // their real copy don't false-positive.
  const sample = `${title ?? ""} ${bodyText.slice(0, 600)}`;
  if (!blockReason) blockReason = detectChallenge(sample);
  if (!blockReason && wordCount < 20 && h1.length === 0 && buttons.length === 0) {
    blockReason = "Empty / non-rendered page";
  }

  return {
    url,
    finalUrl,
    title,
    metaDescription,
    lang,
    hasViewportMeta,
    isHttps: finalUrl.startsWith("https://"),
    headings: { h1, h2, h3 },
    buttons: dedupedButtons,
    ctaTexts,
    navLinks,
    forms,
    images: { total, withAlt, withoutAlt: total - withAlt },
    fonts,
    colors,
    wordCount,
    copyText,
    hasTestimonials,
    hasPricing,
    hasTrustBadges,
    hasSocialProof,
    hasVideo,
    loadTimeMs,
    blocked: blockReason !== null,
    blockReason,
  };
}

function buildEmptyContext(
  url: string,
  finalUrl: string,
  reason: string,
  start: number
): PageContext {
  return {
    url,
    finalUrl,
    title: null,
    metaDescription: null,
    lang: null,
    hasViewportMeta: false,
    isHttps: finalUrl.startsWith("https://"),
    headings: { h1: [], h2: [], h3: [] },
    buttons: [],
    ctaTexts: [],
    navLinks: [],
    forms: [],
    images: { total: 0, withAlt: 0, withoutAlt: 0 },
    fonts: [],
    colors: [],
    wordCount: 0,
    copyText: "",
    hasTestimonials: false,
    hasPricing: false,
    hasTrustBadges: false,
    hasSocialProof: false,
    hasVideo: false,
    loadTimeMs: Date.now() - start,
    blocked: true,
    blockReason: reason,
  };
}
