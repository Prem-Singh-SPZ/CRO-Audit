import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

import { detectChallenge } from "./challenge";
import { assertSafeExternalUrl, isBlockedUrlSync } from "./net-guard";

export interface Screenshot {
  device: "desktop" | "mobile";
  // Raw base64 (no data-URI prefix) for feeding vision LLMs via inlineData.
  base64: string;
  mimeType: string;
  // Full data URI (data:image/jpeg;base64,...) for rendering in the report UI
  // without any external image host.
  dataUri: string;
  width: number;
  height: number;
}

// Lightweight signals read from the fully-rendered (post-JS) page. Used to
// detect client-rendered SPAs where the static HTML crawl looks empty.
export interface RenderedSignals {
  textLength: number;
  h1Count: number;
}

export interface ScreenshotResult {
  screenshots: Screenshot[];
  // A lightweight above-the-fold (viewport-sized) capture used as the seed for
  // the deferred "after" mockup. Kept small so it can round-trip to the client
  // and back up to the mockup endpoint without hitting request-body limits.
  heroShot: Screenshot | null;
  // Set when the renderer was served a bot-protection / verification wall
  // instead of the real page. The HTML analysis may still be valid.
  blockedReason: string | null;
  // Signals from the rendered DOM (null when capture failed/blocked).
  rendered: RenderedSignals | null;
  // Serialized post-JS DOM of the rendered page (null when capture
  // failed/blocked). Used to recover CRO signals when the plain HTTP crawl was
  // walled by a WAF but the headless browser read the real page. Bounded so a
  // huge document can't blow up function memory.
  renderedHtml: string | null;
}

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 1 } as const;
// Bound the in-memory image by clipping the capture height. This caps three
// things that scale with page height: (1) the vision-LLM latency — a very tall
// screenshot pushes Gemini toward its request timeout and can blow the whole
// analyze budget; (2) the sessionStorage payload the report page round-trips;
// (3) the raw capture/encode time. ~5 screenfuls is plenty to audit the parts
// of a page that actually drive conversion.
const MAX_HEIGHT = 5000;
const NAV_TIMEOUT_MS = 30_000;
// Per-operation ceilings. A page whose main thread is pegged by heavy scripts
// (analytics, A/B tools, chat widgets) can make even `page.title()` /
// `page.evaluate()` / `page.screenshot()` hang forever — the CDP call queues
// behind the busy JS thread and never resolves, and `.catch()` does NOT rescue
// a hang (only a rejection). We therefore race every page op against a timeout
// so a stuck page degrades to "no screenshot" instead of hanging the request.
const PAGE_OP_TIMEOUT_MS = 6_000;
const SCREENSHOT_TIMEOUT_MS = 20_000;

// Cap concurrent Chromium instances so a burst of audits can't OOM the
// function (each headless Chromium is memory-hungry). Requests beyond the cap
// wait briefly for a slot; if none frees up they degrade to "no screenshot"
// rather than piling up browsers. Tunable via env.
const MAX_CONCURRENT_BROWSERS = Math.max(
  1,
  Number.parseInt(process.env.MAX_CONCURRENT_BROWSERS ?? "2", 10) || 2
);
const ACQUIRE_TIMEOUT_MS = 25_000;

let activeBrowsers = 0;
const waiters: (() => void)[] = [];

function acquireSlot(): Promise<boolean> {
  if (activeBrowsers < MAX_CONCURRENT_BROWSERS) {
    activeBrowsers += 1;
    return Promise.resolve(true);
  }
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const idx = waiters.indexOf(grant);
      if (idx >= 0) waiters.splice(idx, 1);
      resolve(false);
    }, ACQUIRE_TIMEOUT_MS);
    const grant = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeBrowsers += 1;
      resolve(true);
    };
    waiters.push(grant);
  });
}

function releaseSlot(): void {
  activeBrowsers = Math.max(0, activeBrowsers - 1);
  const next = waiters.shift();
  if (next) next();
}

/**
 * Resolves to `fallback` if `p` doesn't settle within `ms`. The losing promise
 * is allowed to reject harmlessly in the background (browser close aborts it).
 */
function raceTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const guard = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([
    p.catch(() => fallback),
    guard,
  ]).finally(() => clearTimeout(timer));
}

async function launchBrowser(): Promise<Browser> {
  const localPath = process.env.CHROME_EXECUTABLE_PATH;
  if (localPath) {
    return puppeteer.launch({
      executablePath: localPath,
      headless: true,
      defaultViewport: VIEWPORT,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
      ],
    });
  }

  // Serverless (Vercel): use the bundled, brotli-compressed Chromium binary.
  chromium.setGraphicsMode = false;
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: VIEWPORT,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

/**
 * Captures a desktop full-page screenshot with a self-hosted headless Chromium
 * (no external screenshot service). The image is returned in-memory as base64 /
 * data URI so it can be fed to a vision LLM and rendered in the report without
 * any image host. Bot-wall / verification pages are detected (via the rendered
 * title + body sample and the navigation status) and reported so we never
 * annotate a security-check page.
 */
export async function captureScreenshots(url: string): Promise<ScreenshotResult> {
  const screenshots: Screenshot[] = [];
  let heroShot: Screenshot | null = null;
  let blockedReason: string | null = null;
  let rendered: RenderedSignals | null = null;
  let renderedHtml: string | null = null;
  let browser: Browser | null = null;

  // Bound concurrent Chromium instances. If we can't get a slot in time, skip
  // the capture — the audit still runs on crawl + PageSpeed + text.
  const acquired = await acquireSlot();
  if (!acquired) {
    console.warn("[screenshot] skipped — capture concurrency limit reached");
    return {
      screenshots,
      heroShot: null,
      blockedReason: null,
      rendered: null,
      renderedHtml: null,
    };
  }

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(DESKTOP_UA);
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    // SSRF guard for the browser: abort any request (including redirects and
    // subresources) that targets a disallowed scheme, internal host, or
    // private/reserved IP literal. The primary target's DNS is already checked
    // upstream via assertSafeExternalUrl.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (isBlockedUrlSync(req.url())) {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });

    // Auto-dismiss any JS dialog (alert/confirm/beforeunload). An open dialog
    // blocks the page's main thread, which would otherwise freeze every
    // subsequent CDP call (title/evaluate/screenshot) until it times out.
    page.on("dialog", (d) => {
      d.dismiss().catch(() => {});
    });

    let status = 0;
    try {
      // Wait only for the DOM, not full network idle: heavy marketing pages
      // (analytics, chat widgets, A/B tools, video) often never reach
      // networkidle2, which would otherwise time out the whole navigation and
      // leave us with nothing to capture.
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
      });
      status = response?.status() ?? 0;
    } catch (err) {
      // Navigation timed out or aborted — capture whatever rendered anyway.
      console.warn("[screenshot] navigation issue (continuing):", err);
    }

    // Best-effort: give the network a brief chance to settle so late hero
    // content/images load, but never block on it (bounded + swallowed).
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 8000 })
      .catch(() => {});
    // Let late-loading hero animations / lazy content settle.
    await new Promise((r) => setTimeout(r, 1500));

    // Detect bot walls from the rendered page before trusting the screenshot.
    // Time-bounded: on a pegged page these can hang indefinitely, so we cap
    // them and simply skip challenge detection if they don't return in time.
    const title = await raceTimeout(page.title(), PAGE_OP_TIMEOUT_MS, "");
    const bodySample = await raceTimeout(
      page.evaluate(() => document.body?.innerText?.slice(0, 600) ?? ""),
      PAGE_OP_TIMEOUT_MS,
      ""
    );
    // Redirect SSRF guard: the page may have navigated to a different host.
    // Re-validate the final URL (DNS-resolving) before trusting/capturing it.
    const finalUrl = page.url();
    if (finalUrl && finalUrl !== url) {
      try {
        await assertSafeExternalUrl(finalUrl);
      } catch {
        blockedReason = "Blocked redirect target";
      }
    }

    const challenge = blockedReason ? null : detectChallenge(`${title} ${bodySample}`);
    if (challenge) {
      blockedReason = challenge;
    } else if (!blockedReason && status >= 400 && !bodySample.trim()) {
      // Only treat an error status as a hard block when the page also failed to
      // render any real content. A 4xx that still paints usable content (some
      // WAFs/CDNs do this) should not cost us the screenshot.
      blockedReason = status === 403 || status === 429 ? "WAF block" : `HTTP ${status}`;
    }

    if (blockedReason) {
      console.warn(
        `[screenshot] skipping capture for ${url} — reason: ${blockedReason} (status ${status})`
      );
    }

    if (!blockedReason) {
      // Read rendered-DOM signals so the caller can detect client-rendered SPAs
      // (static HTML crawl empty, but the rendered page clearly has content).
      rendered = await raceTimeout<RenderedSignals | null>(
        page.evaluate(() => ({
          textLength: document.body?.innerText?.trim().length ?? 0,
          h1Count: document.querySelectorAll("h1").length,
        })),
        PAGE_OP_TIMEOUT_MS,
        null
      );

      // Grab the post-JS DOM so the caller can recover CRO signals if the plain
      // HTTP crawl was walled by a WAF. Bounded (~2MB) so a giant document can't
      // balloon function memory; time-boxed like every other page op.
      const html = await raceTimeout(page.content(), PAGE_OP_TIMEOUT_MS, "");
      renderedHtml = html ? html.slice(0, 2_000_000) : null;

      // Read the page dimensions defensively: a client-side redirect can destroy
      // the execution context here, and we must not let that drop the capture.
      const dims = await raceTimeout(
        page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        })),
        PAGE_OP_TIMEOUT_MS,
        { width: 0, height: 0 }
      );
      const width = dims.width || VIEWPORT.width;
      // Always capture with an explicit, bounded clip via captureBeyondViewport
      // — never `fullPage: true`. fullPage forces Chromium to resize the
      // viewport to the ENTIRE content height, which can hang indefinitely on
      // very tall, lazy-loading, or continuously-reflowing pages. A fixed clip
      // (capped at MAX_HEIGHT, and falling back to one viewport when the page
      // height is unknown) keeps capture fast and predictable.
      const height = Math.min(dims.height || VIEWPORT.height, MAX_HEIGHT);

      const raw = await raceTimeout<Buffer | Uint8Array | null>(
        page.screenshot({
          type: "jpeg",
          // Slightly lower quality trims the base64 payload (LLM request + the
          // sessionStorage round-trip) with negligible impact on audit fidelity.
          quality: 72,
          clip: { x: 0, y: 0, width, height, scale: 1 },
          captureBeyondViewport: true,
        }),
        SCREENSHOT_TIMEOUT_MS,
        null
      );

      if (raw) {
        const base64 = Buffer.from(raw).toString("base64");
        screenshots.push({
          device: "desktop",
          base64,
          mimeType: "image/jpeg",
          dataUri: `data:image/jpeg;base64,${base64}`,
          width,
          height,
        });
      }

      // Above-the-fold seed for the deferred mockup: a single viewport-sized
      // frame (top of page) keeps the payload small and gives the image model
      // a crisp, focused reference to redesign. Also time-bounded so a pegged
      // page can't hang here after we've already captured the main screenshot.
      try {
        await raceTimeout(
          page.evaluate(() => window.scrollTo(0, 0)),
          PAGE_OP_TIMEOUT_MS,
          undefined
        );
        const heroRaw = await raceTimeout<Buffer | Uint8Array | null>(
          page.screenshot({ type: "jpeg", quality: 82, fullPage: false }),
          SCREENSHOT_TIMEOUT_MS,
          null
        );
        if (!heroRaw) throw new Error("hero capture timed out");
        const heroBase64 = Buffer.from(heroRaw).toString("base64");
        heroShot = {
          device: "desktop",
          base64: heroBase64,
          mimeType: "image/jpeg",
          dataUri: `data:image/jpeg;base64,${heroBase64}`,
          width: VIEWPORT.width,
          height: VIEWPORT.height,
        };
      } catch {
        // Non-fatal — the report still works without the mockup seed.
      }
    }
  } catch (err) {
    console.error("[screenshot] capture failed:", err);
  } finally {
    if (browser) await browser.close().catch(() => {});
    releaseSlot();
  }

  return { screenshots, heroShot, blockedReason, rendered, renderedHtml };
}
