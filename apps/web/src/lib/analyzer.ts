import * as cheerio from "cheerio";
import type { PageContext, FormInfo, ButtonInfo, LinkInfo } from "@/lib/cro";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// Markers of a bot-protection / verification interstitial (Cloudflare, etc.).
const CHALLENGE_MARKERS: { pattern: RegExp; reason: string }[] = [
  { pattern: /just a moment/i, reason: "Cloudflare challenge" },
  { pattern: /checking your browser/i, reason: "Cloudflare challenge" },
  { pattern: /attention required/i, reason: "Cloudflare block" },
  { pattern: /cf-chl|cf_chl|__cf_/i, reason: "Cloudflare challenge" },
  { pattern: /verify(ing)? you are (a )?human/i, reason: "Human verification" },
  { pattern: /enable javascript and cookies/i, reason: "JS/cookie gate" },
  {
    pattern: /(are you a robot|i'm not a robot|recaptcha|hcaptcha|captcha)/i,
    reason: "CAPTCHA",
  },
  {
    pattern: /access denied|ddos protection|request blocked/i,
    reason: "WAF block",
  },
];

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

  const $ = cheerio.load(html);
  const loadTimeMs = Date.now() - start;

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

  // Challenge detection over title + body sample
  const sample = `${title ?? ""} ${bodyText.slice(0, 600)}`;
  if (!blockReason) {
    for (const { pattern, reason } of CHALLENGE_MARKERS) {
      if (pattern.test(sample)) {
        blockReason = reason;
        break;
      }
    }
  }
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
    hasTestimonials,
    hasPricing,
    hasTrustBadges,
    hasSocialProof,
    hasVideo,
    loadTimeMs,
    blocked: blockReason !== null,
    blockReason,
    screenshots: [],
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
    hasTestimonials: false,
    hasPricing: false,
    hasTrustBadges: false,
    hasSocialProof: false,
    hasVideo: false,
    loadTimeMs: Date.now() - start,
    blocked: true,
    blockReason: reason,
    screenshots: [],
  };
}
