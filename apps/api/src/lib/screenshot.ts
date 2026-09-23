import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

import type { LandmarkBox } from "@cro/shared";
import { detectChallenge, isAutoClearingChallenge } from "./challenge";
import { assertSafeExternalUrl, isBlockedUrlSync } from "./net-guard";
import { measureLandmarks } from "./landmarks";
import {
  assessCaptureQuality,
  collectCaptureSignalsInPage,
  collectLayoutSnapshotInPage,
  dismissConsentInPage,
  emptySignals,
  finalizeIncompleteFlag,
  hideConsentOverlaysInPage,
  isLiveCaptureUsable,
  layoutSnapshotsEqual,
  collectImageLoadInventory,
  countVisibleLeadFields,
  documentImagesMostlyDecoded,
  eagerDecodeDocumentImages,
  hideKnownConsentSdkInPage,
  imagesTooIncomplete,
  inlineZeroNaturalSvgImages,
  isDeadPageError,
  leadFieldWaitDecision,
  pageFontsReady,
  pageIsCaptureReady,
  pageLeadFieldsHaveAuthorCss,
  shouldRetryCapture,
  shouldSkipConsentClick,
} from "./capture-quality";
import { jpegDimensions } from "./jpeg-size";
import {
  inspectAndHideLiveTestInPage,
  urlForcesOriginalControl,
} from "./live-test";
import {
  hideArchiveChromeInPage,
  lookupWayback,
  parseWaybackUrl,
  type WaybackHit,
} from "./wayback";

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

/** Viewport-sized slice of the stitch, sent only to the vision model. */
export interface ScreenshotBand extends Screenshot {
  /** 1-based index in the band set. */
  index: number;
  /** Top of this band as a 0–1 fraction of the full stitch height. */
  startY: number;
  /** Band height as a 0–1 fraction of the full stitch height. */
  heightFraction: number;
}

export interface ScreenshotResult {
  screenshots: Screenshot[];
  // A lightweight above-the-fold (viewport-sized) capture used as the seed for
  // the deferred "after" mockup. Kept small so it can round-trip to the client
  // and back up to the mockup endpoint without hitting request-body limits.
  heroShot: Screenshot | null;
  // Viewport-sized bands used only for the audit LLM. Never sent to the client.
  bands: ScreenshotBand[];
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
  /** Measured H1 / CTA / form / nav boxes on the stitch (0–1 centers). */
  landmarks: LandmarkBox[];
  /** Real page captured, but a late form / empty hero slot never painted. */
  incompleteCapture: boolean;
  captureNote: string | null;
  dismissedConsent: boolean;
  liveTest: { vendor: string } | null;
  /** False when the live viewport is blocked, blank, CMP-covered, or spinner-only. */
  liveUsable: boolean;
  screenshotSource: "live" | "archive";
  archiveCapturedAt: string | null;
}

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 1 } as const;
/** Tall viewport can OOM Cloud Run; clip the first N px instead. */
const CLIP_HEIGHT_CAP = 16_000;
const BAND_HEIGHT = VIEWPORT.height;
const BAND_OVERLAP = 80;
const BAND_STEP = BAND_HEIGHT - BAND_OVERLAP;
const MAX_BANDS = 8;
const SCROLL_SETTLE_MS = 80;
const NAV_TIMEOUT_MS = 18_000;
// Per-operation ceilings. A page whose main thread is pegged by heavy scripts
// (analytics, A/B tools, chat widgets) can make even `page.title()` /
// `page.evaluate()` / `page.screenshot()` hang forever — the CDP call queues
// behind the busy JS thread and never resolves, and `.catch()` does NOT rescue
// a hang (only a rejection). We therefore race every page op against a timeout
// so a stuck page degrades to "no screenshot" instead of hanging the request.
const PAGE_OP_TIMEOUT_MS = 6_000;
const SCREENSHOT_TIMEOUT_MS = 30_000;
/** Chrome native full-page JPEG can be tall; give CDP more room than a fold shot. */
const FULL_PAGE_TIMEOUT_MS = 60_000;
// Max time to wait for a JS-heavy SPA to actually paint real content before we
// capture. Without this, pages that only reach `domcontentloaded` (a blank/
// "Loading…" shell, e.g. some marketing SPAs) get captured white.
const CONTENT_WAIT_MS = 12_000;
/** Wait for a Cloudflare "Just a moment" JS check to clear on its own. */
const CHALLENGE_WAIT_MS = 12_000;
/** All ready-gate signals (author CSS, in-view media, no spinner). */
const READY_WAIT_MS = 25_000;
/** Two matching viewport snapshots this far apart = layout has settled. */
const LAYOUT_STABLE_MS = 500;
const LAYOUT_STABLE_BUDGET_MS = 8_000;

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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function usesLocalChrome(): boolean {
  return Boolean(process.env.CHROME_EXECUTABLE_PATH?.trim());
}

/** Third-party hosts that often SIGILL @sparticuz/chromium during goto. */
const HEAVY_THIRD_PARTY_HOSTS = [
  "google-analytics.com",
  "googletagmanager.com",
  "googlesyndication.com",
  "googleadservices.com",
  "doubleclick.net",
  "facebook.net",
  "facebook.com",
  "hotjar.com",
  "fullstory.com",
  "segment.io",
  "segment.com",
  "amplitude.com",
  "mixpanel.com",
  "intercom.io",
  "intercomcdn.com",
  "hs-analytics.net",
  "hs-scripts.com",
  "hubspot.com",
  "clarity.ms",
  "youtube.com",
  "youtube-nocookie.com",
  "ytimg.com",
  "vimeo.com",
  "wistia.com",
] as const;

function hostIsOrSub(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith(`.${suffix}`);
}

/** Drop media/wasm/trackers on Cloud Run so Chromium survives navigation. */
function shouldAbortHeavyCaptureRequest(
  href: string,
  resourceType: string,
  pageHost: string
): boolean {
  if (resourceType === "media" || resourceType === "websocket") return true;
  if (/\.wasm(\?|#|$)/i.test(href)) return true;
  try {
    const host = new URL(href).hostname.toLowerCase();
    if (!host || host === pageHost || host.endsWith(`.${pageHost}`)) {
      return false;
    }
    return HEAVY_THIRD_PARTY_HOSTS.some((suffix) => hostIsOrSub(host, suffix));
  } catch {
    return false;
  }
}

/** Keep Sparticuz --single-process. Dropping it caused SIGSEGV and hung analyze. */
function serverlessChromeArgs(): string[] {
  return [
    ...chromium.args,
    "--disable-dev-shm-usage",
    "--disable-crash-reporter",
    "--disable-gpu",
    "--disable-webgl",
    "--disable-webgl2",
    "--disable-accelerated-2d-canvas",
    "--mute-audio",
  ];
}

function shotTimeoutMs(): number {
  return usesLocalChrome() ? SCREENSHOT_TIMEOUT_MS : 8_000;
}

async function openCaptureTab(
  browser: Browser,
  url: string,
  desktopUa: string,
  jsEnabled: boolean
): Promise<Page> {
  const page = await browser.newPage();
  let pageHost = "";
  try {
    pageHost = new URL(url).hostname.toLowerCase();
  } catch {
    pageHost = "";
  }
  await page.setUserAgent(desktopUa);
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  await page.setJavaScriptEnabled(jsEnabled);
  if (jsEnabled) {
    await page.evaluateOnNewDocument(`
      Object.defineProperty(navigator, "webdriver", { get: function () { return undefined; } });
      globalThis.__name = function (fn) { return fn; };
    `);
  }
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const href = req.url();
    if (href.startsWith("data:") || href.startsWith("blob:")) {
      req.continue().catch(() => {});
      return;
    }
    if (isBlockedUrlSync(href)) {
      req.abort().catch(() => {});
      return;
    }
    if (
      !usesLocalChrome() &&
      shouldAbortHeavyCaptureRequest(href, req.resourceType(), pageHost)
    ) {
      req.abort().catch(() => {});
      return;
    }
    req.continue().catch(() => {});
  });
  page.on("dialog", (d) => {
    d.dismiss().catch(() => {});
  });
  return page;
}

function fullPageTimeoutMs(): number {
  return usesLocalChrome() ? FULL_PAGE_TIMEOUT_MS : 10_000;
}

function pageStillOpen(page: Page): boolean {
  try {
    return !page.isClosed() && !page.mainFrame().detached;
  } catch {
    return false;
  }
}

async function clearVisitorConsent(
  page: Page,
  skipOneTrustAccept: boolean
): Promise<boolean> {
  let dismissed = false;
  const hiddenSdk = await raceTimeout(
    page.evaluate(hideKnownConsentSdkInPage),
    PAGE_OP_TIMEOUT_MS,
    0
  );
  if (hiddenSdk > 0) dismissed = true;
  const clicked = await raceTimeout(
    page.evaluate(dismissConsentInPage, skipOneTrustAccept),
    PAGE_OP_TIMEOUT_MS,
    false
  );
  if (clicked) {
    dismissed = true;
    await sleep(350);
  }
  const hidden = await raceTimeout(
    page.evaluate(hideConsentOverlaysInPage),
    PAGE_OP_TIMEOUT_MS,
    0
  );
  if (hidden > 0) dismissed = true;
  return dismissed;
}

/** Scroll tops for viewport bands that tile the stitch with a small overlap. */
/** Clamp a measured document height for a single-screen clip capture. */
export function clampShotHeight(
  raw: number,
  cap = CLIP_HEIGHT_CAP
): number {
  const h = Math.floor(raw);
  if (!Number.isFinite(h) || h < 1) return VIEWPORT.height;
  return Math.min(h, cap);
}

export function bandScrollTops(captureHeight: number): number[] {
  if (captureHeight <= BAND_HEIGHT) return [0];
  const tops: number[] = [];
  let y = 0;
  while (tops.length < MAX_BANDS - 1 && y + BAND_HEIGHT < captureHeight) {
    tops.push(y);
    y += BAND_STEP;
  }
  const last = Math.max(0, captureHeight - BAND_HEIGHT);
  const prev = tops[tops.length - 1];
  if (prev == null || last !== prev) {
    tops.push(last);
  }
  return tops.slice(0, MAX_BANDS);
}

function emptyResult(
  extra: Partial<ScreenshotResult> = {}
): ScreenshotResult {
  return {
    screenshots: [],
    heroShot: null,
    bands: [],
    blockedReason: null,
    rendered: null,
    renderedHtml: null,
    landmarks: [],
    incompleteCapture: false,
    captureNote: null,
    dismissedConsent: false,
    liveTest: null,
    liveUsable: false,
    screenshotSource: "live",
    archiveCapturedAt: null,
    ...extra,
  };
}

// Local desktop Chrome/Edge flags (Windows/macOS/Linux). Keep these minimal —
// serverless flags like --single-process can crash a full desktop Chrome.
const LOCAL_CHROME_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

/**
 * Launch strategy:
 * - Local / explicit: CHROME_EXECUTABLE_PATH → installed Chrome/Edge
 * - Cloud Run / Docker: @sparticuz/chromium (Debian system Chromium SIGTRAPs
 *   on Cloud Run — signal 5 + crashpad — so we do NOT auto-detect /usr/bin/chromium)
 */
async function launchBrowser(): Promise<Browser> {
  const localPath = process.env.CHROME_EXECUTABLE_PATH?.trim();

  if (localPath) {
    console.log(`[screenshot] launching local Chrome at ${localPath}`);
    return puppeteer.launch({
      executablePath: localPath,
      headless: true,
      defaultViewport: VIEWPORT,
      dumpio: process.env.CHROME_DUMPIO === "1",
      args: LOCAL_CHROME_ARGS,
      ignoreDefaultArgs: ["--enable-automation"],
    });
  }

  console.log("[screenshot] launching @sparticuz/chromium (serverless binary)");
  chromium.setGraphicsMode = false;
  const executablePath = await chromium.executablePath();
  console.log(`[screenshot] sparticuz binary: ${executablePath}`);

  const args = serverlessChromeArgs();
  return puppeteer.launch({
    args,
    defaultViewport: VIEWPORT,
    executablePath,
    headless: true,
    dumpio: process.env.CHROME_DUMPIO === "1",
    ignoreDefaultArgs: ["--enable-automation"],
  });
}

async function desktopUserAgent(browser: Browser): Promise<string> {
  try {
    const raw = await browser.version();
    const match = raw.match(/(\d+\.\d+\.\d+\.\d+)/);
    const ver = match?.[1] ?? "125.0.0.0";
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`;
  } catch {
    return DESKTOP_UA;
  }
}

async function unregisterServiceWorkers(page: Page): Promise<void> {
  await raceTimeout(
    page.evaluate(async () => {
      try {
        if (!("serviceWorker" in navigator)) return;
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      } catch {
        // Hygiene only — never block capture on SW teardown.
      }
    }),
    PAGE_OP_TIMEOUT_MS,
    undefined
  );
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
  const archiveLookup = lookupWayback(url).catch(() => null);
  const first = await captureScreenshotsOnce(url, archiveLookup);
  // Cloud Run retry doubles a dead Chromium and blows the 200s client budget.
  if (usesLocalChrome() && shouldRetryCapture(first)) {
    console.warn("[screenshot] retrying empty capture");
    return captureScreenshotsOnce(url, archiveLookup);
  }
  return first;
}

async function captureScreenshotsOnce(
  url: string,
  archiveLookup: Promise<WaybackHit | null>
): Promise<ScreenshotResult> {
  const screenshots: Screenshot[] = [];
  let heroShot: Screenshot | null = null;
  const bands: ScreenshotBand[] = [];
  let blockedReason: string | null = null;
  let rendered: RenderedSignals | null = null;
  let renderedHtml: string | null = null;
  let landmarks: LandmarkBox[] = [];
  let incompleteCapture = false;
  let captureNote: string | null = null;
  let dismissedConsent = false;
  let liveTest: { vendor: string } | null = null;
  let liveUsable = false;
  let screenshotSource: "live" | "archive" = "live";
  let archiveCapturedAt: string | null = null;
  let browser: Browser | null = null;
  let desktopUa = DESKTOP_UA;

  // Bound concurrent Chromium instances. If we can't get a slot in time, skip
  // the capture — the audit still runs on crawl + PageSpeed + text.
  const acquired = await acquireSlot();
  if (!acquired) {
    console.warn("[screenshot] skipped — capture concurrency limit reached");
    return emptyResult();
  }

  try {
    browser = await launchBrowser();
    desktopUa = await desktopUserAgent(browser);
    // Cloud Run: first paint with JS off. Blue J / Webflow SIGILL's V8 during
    // goto; SSR HTML still screenshots. Local Chrome keeps JS on.
    // A force-original preview param only works if the testing snippet runs.
    const forceOriginal = urlForcesOriginalControl(url);
    const firstJs = usesLocalChrome() || forceOriginal;
    const page = await openCaptureTab(browser, url, desktopUa, firstJs);

    let status = 0;
    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
      });
      status = response?.status() ?? 0;
    } catch (err) {
      console.warn("[screenshot] navigation issue (continuing):", err);
    }

    await waitUntilDocumentComplete(page);
    if (usesLocalChrome()) {
      await page
        .waitForNetworkIdle({ idleTime: 800, timeout: 8000 })
        .catch(() => {});
    }

    // Cloud Run: shoot the fold before consent / page.content() can crash Chromium.
    if (!usesLocalChrome() && pageStillOpen(page)) {
      try {
        const early = await captureViewportJpeg(page);
        if (early) {
          screenshots.push(early);
          heroShot = early;
        }
      } catch (err) {
        console.warn(
          "[screenshot] early fold failed:",
          (err as Error)?.message ?? err
        );
      }
    }

    // Upgrade to a JS-painted control when Chromium survives. If V8 SIGILL's,
    // the no-JS fold already in `screenshots` is kept. Skip when this visit
    // already ran JavaScript so a preview param can select the original.
    if (!usesLocalChrome() && !forceOriginal && browser) {
      try {
        const upgrade = await openCaptureTab(browser, url, desktopUa, true);
        try {
          await upgrade.goto(url, { waitUntil: "domcontentloaded" });
          const pack = await captureServerlessControl(upgrade);
          if (pack.control) {
            screenshots.length = 0;
            screenshots.push(pack.control);
            heroShot = pack.viewport ?? pack.control;
          }
        } finally {
          await upgrade.close().catch(() => {});
        }
      } catch (err) {
        console.warn(
          "[screenshot] js upgrade failed, keeping no-js fold:",
          (err as Error)?.message ?? err
        );
      }
    }

    await waitOutAutoChallenge(page);
    if (usesLocalChrome()) {
      await page
        .waitForFunction(countVisibleLeadFields, { timeout: 10_000 })
        .catch(() => {});
    }
    const leadFieldsBeforeConsent = await raceTimeout(
      page.evaluate(countVisibleLeadFields),
      PAGE_OP_TIMEOUT_MS,
      0
    );
    const skipConsentClick = shouldSkipConsentClick(leadFieldsBeforeConsent);
    // Skip only the OneTrust Accept click when a lead field is already
    // painted (Fastly remount). Still click Accept All / hide other CMPs.
    if (await clearVisitorConsent(page, skipConsentClick)) {
      dismissedConsent = true;
    }
    await unregisterServiceWorkers(page);

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
    const pastedArchive = parseWaybackUrl(url) ?? parseWaybackUrl(finalUrl);
    if (pastedArchive) {
      screenshotSource = "archive";
      archiveCapturedAt = pastedArchive.capturedAt;
      await raceTimeout(
        page.evaluate(hideArchiveChromeInPage),
        PAGE_OP_TIMEOUT_MS,
        0
      );
    }
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

      // If the page still rendered essentially no content after waiting (a blank
      // SPA shell or a stuck "Loading…" screen), treat it as a non-rendered page
      // instead of capturing — and scoring — a white frame. Conservative
      // thresholds avoid false-positives on legitimately sparse pages.
      if (rendered && rendered.textLength < 40 && rendered.h1Count === 0) {
        blockedReason = "Empty / non-rendered page";
        console.warn(
          `[screenshot] blank render for ${url} — marking as non-rendered`
        );
      }
    }

    if (!blockedReason) {
      const live = await raceTimeout(
        page.evaluate(inspectAndHideLiveTestInPage),
        PAGE_OP_TIMEOUT_MS,
        { vendor: null, hidden: 0 }
      );
      const forcedOriginal =
        forceOriginal || urlForcesOriginalControl(finalUrl);
      if (live.vendor && !forcedOriginal) {
        liveTest = { vendor: live.vendor };
        console.log(
          `[screenshot] live test ${live.vendor} (hid ${live.hidden} chrome nodes)`
        );
      } else if (live.vendor && forcedOriginal) {
        console.log(
          `[screenshot] ${live.vendor} present but URL forces the original control`
        );
      }

      await raceTimeout(
        page.evaluate(() => window.scrollTo(0, 0)),
        PAGE_OP_TIMEOUT_MS,
        undefined
      );
      let viewportShot: Screenshot | null = screenshots[0] ?? null;
      let control = { shot: null as Screenshot | null, ready: false };
      if (!usesLocalChrome()) {
        if (screenshots.length > 0) {
          control = { shot: screenshots[0] ?? null, ready: true };
        } else {
          try {
            const pack = await captureServerlessControl(page);
            if (pack.dismissedConsent) dismissedConsent = true;
            viewportShot = pack.viewport ?? viewportShot;
            if (viewportShot) heroShot = viewportShot;
            if (pack.control) {
              screenshots.length = 0;
              screenshots.push(pack.control);
              control = { shot: pack.control, ready: true };
            }
          } catch (err) {
            console.warn(
              "[screenshot] serverless control failed, keeping early fold:",
              (err as Error)?.message ?? err
            );
          }
          if (!control.shot && screenshots.length > 0) {
            control = { shot: screenshots[0] ?? null, ready: true };
          }
        }
        // HTML after the JPEG so a giant DOM serialize cannot empty the capture.
        if (pageStillOpen(page)) {
          const html = await raceTimeout(page.content(), PAGE_OP_TIMEOUT_MS, "");
          renderedHtml = html ? html.slice(0, 2_000_000) : null;
        }
      } else {
        try {
          const gateReady = await prepareViewportForShot(page);
          if (gateReady.dismissedConsent) dismissedConsent = true;
          viewportShot = await captureViewportJpeg(page);
        } catch (err) {
          console.warn(
            "[screenshot] viewport prepare failed:",
            (err as Error)?.message ?? err
          );
          if (pageStillOpen(page)) {
            viewportShot = await captureViewportJpeg(page);
          }
        }
        if (viewportShot) {
          heroShot = viewportShot;
          screenshots.push(viewportShot);
        }
        try {
          if (pageStillOpen(page)) {
            control = await captureControlFullPage(page);
          }
        } catch (err) {
          console.warn(
            "[screenshot] full-page walk failed, keeping viewport:",
            (err as Error)?.message ?? err
          );
        }
        if (control.shot) {
          screenshots.length = 0;
          screenshots.push(control.shot);
        }
        if (pageStillOpen(page)) {
          const html = await raceTimeout(page.content(), PAGE_OP_TIMEOUT_MS, "");
          renderedHtml = html ? html.slice(0, 2_000_000) : null;
        }
      }
      const controlShot = control.shot;

      const stitchW = controlShot?.width ?? VIEWPORT.width;
      const stitchH = controlShot?.height ?? VIEWPORT.height;
      if (pageStillOpen(page)) {
        landmarks = await measureLandmarks(
          page,
          stitchW,
          stitchH,
          PAGE_OP_TIMEOUT_MS
        );
      }

      const signals = pageStillOpen(page)
        ? await raceTimeout(
            page.evaluate(collectCaptureSignalsInPage),
            PAGE_OP_TIMEOUT_MS,
            emptySignals()
          )
        : emptySignals();
      const copySample = pageStillOpen(page)
        ? await raceTimeout(
            page.evaluate(() => document.body?.innerText?.slice(0, 4000) ?? ""),
            PAGE_OP_TIMEOUT_MS,
            ""
          )
        : "";
      const quality = assessCaptureQuality({
        signals,
        hasFormLandmark: landmarks.some((l) => l.id === "form"),
        copyText: copySample,
        dismissedConsent,
      });
      const hasCollapsedIframe = signals.formIframes.some(
        (f) => f.width >= 80 && f.height < 40
      );
      if (screenshots.length > 0) {
        control.ready = true;
        liveUsable = true;
      }
      if (!control.ready && screenshots.length === 0) {
        incompleteCapture = true;
        captureNote =
          "The viewport had not finished loading (form, images, or spinner) when we captured the page.";
        liveUsable = false;
      } else {
        const finalized = finalizeIncompleteFlag({
          fieldsReady: true,
          quality,
          hasCollapsedIframe,
        });
        incompleteCapture = finalized.incompleteCapture;
        captureNote = finalized.captureNote;
        liveUsable = screenshots.some((s) => s.device === "desktop");
      }

      // Bands walk the page with extra CDP shots. Skip on Cloud Run.
      if (usesLocalChrome() && pageStillOpen(page)) {
        await captureBands(
          page,
          bands,
          Math.max(1, Math.floor(stitchH || VIEWPORT.height))
        );
      }
    }

    if (
      !isLiveCaptureUsable({
        blockedReason,
        screenshots,
        liveUsable,
      })
    ) {
      const hit = await archiveLookup;
      if (hit) {
        const archive = await captureArchivePage(page, hit, desktopUa);
        if (archive) {
          screenshots.length = 0;
          screenshots.push(archive.shot);
          if (archive.hero) heroShot = archive.hero;
          screenshotSource = "archive";
          archiveCapturedAt = hit.capturedAt;
          incompleteCapture = false;
          captureNote = null;
          liveUsable = false;
          landmarks = await measureLandmarks(
            page,
            archive.shot.width,
            archive.shot.height,
            PAGE_OP_TIMEOUT_MS
          );
          console.log(
            `[screenshot] using archive snapshot ${hit.timestamp} for ${url}`
          );
        }
      }
    }

    if (screenshots.length === 0 && pageStillOpen(page)) {
      try {
        const last = await captureViewportJpeg(page);
        if (last) {
          screenshots.push(last);
          heroShot = last;
          liveUsable = true;
          incompleteCapture = false;
          captureNote = null;
        }
      } catch (err) {
        console.warn(
          "[screenshot] last-resort fold failed:",
          (err as Error)?.message ?? err
        );
      }
    }
  } catch (err) {
    console.error("[screenshot] capture failed:", (err as Error)?.message ?? err);
    console.error("[screenshot] stack:", (err as Error)?.stack);
    if (isDeadPageError(err) && screenshots.length === 0 && heroShot) {
      screenshots.push(heroShot);
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    releaseSlot();
  }

  return {
    screenshots,
    heroShot,
    bands,
    blockedReason,
    rendered,
    renderedHtml,
    landmarks,
    incompleteCapture,
    captureNote,
    dismissedConsent,
    liveTest,
    liveUsable,
    screenshotSource,
    archiveCapturedAt,
  };
}

async function sampleChallengeText(page: Page): Promise<string> {
  const title = await raceTimeout(page.title(), PAGE_OP_TIMEOUT_MS, "");
  const body = await raceTimeout(
    page.evaluate(() => document.body?.innerText?.slice(0, 600) ?? ""),
    PAGE_OP_TIMEOUT_MS,
    ""
  );
  return `${title} ${body}`;
}

/** Wait out Cloudflare "Just a moment" / "checking your browser" — never click. */
async function waitOutAutoChallenge(page: Page): Promise<void> {
  const deadline = Date.now() + CHALLENGE_WAIT_MS;
  while (Date.now() < deadline) {
    const reason = detectChallenge(await sampleChallengeText(page));
    if (!isAutoClearingChallenge(reason)) return;
    await sleep(500);
  }
}

async function waitUntilDocumentComplete(page: Page): Promise<void> {
  if (!usesLocalChrome()) {
    await raceTimeout(
      page.evaluate(() => document.readyState === "complete"),
      CONTENT_WAIT_MS,
      false
    );
    return;
  }
  await page
    .waitForFunction(() => document.readyState === "complete", {
      timeout: CONTENT_WAIT_MS,
    })
    .catch(() => {});
}

async function waitForFonts(page: Page): Promise<void> {
  await raceTimeout(
    page.evaluate(() =>
      document.fonts ? document.fonts.ready.then(() => true) : true
    ),
    PAGE_OP_TIMEOUT_MS,
    false
  );
}

async function prepareViewportForShot(
  page: Page
): Promise<{ ready: boolean; dismissedConsent: boolean }> {
  let dismissedConsent = false;
  await raceTimeout(
    page.evaluate(() => window.scrollTo(0, 0)),
    PAGE_OP_TIMEOUT_MS,
    undefined
  );
  await waitUntilDocumentComplete(page);
  if (usesLocalChrome()) {
    await page
      .waitForNetworkIdle({ idleTime: 800, timeout: 8000 })
      .catch(() => {});
    await page
      .waitForFunction(countVisibleLeadFields, { timeout: 10_000 })
      .catch(() => {});
  }
  const fieldsBefore = await raceTimeout(
    page.evaluate(countVisibleLeadFields),
    PAGE_OP_TIMEOUT_MS,
    0
  );
  if (await clearVisitorConsent(page, shouldSkipConsentClick(fieldsBefore))) {
    dismissedConsent = true;
  }
  await waitForFonts(page);
  let ready = false;
  if (usesLocalChrome()) {
    try {
      await page.waitForFunction(pageIsCaptureReady, { timeout: READY_WAIT_MS });
      ready = true;
    } catch {
      ready = false;
    }
  } else {
    ready = await raceTimeout(
      page.evaluate(pageIsCaptureReady),
      PAGE_OP_TIMEOUT_MS,
      false
    );
  }
  if (ready) {
    await waitUntilLayoutStable(page);
  } else {
    await sleep(300);
  }
  const still = await raceTimeout(
    page.evaluate(pageIsCaptureReady),
    PAGE_OP_TIMEOUT_MS,
    false
  );
  return { ready: ready && still, dismissedConsent };
}

/** Progressive forms may remount (6→2). No-form pages exit after a short zero-stable. */
async function waitUntilLeadFieldsStable(page: Page): Promise<number> {
  const started = Date.now();
  const deadline = started + 14_000;
  let prev = await raceTimeout(
    page.evaluate(countVisibleLeadFields),
    PAGE_OP_TIMEOUT_MS,
    0
  );
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    const elapsedMs = Date.now() - started;
    const stableMs = Date.now() - stableSince;
    const phase = leadFieldWaitDecision({
      prev,
      next: prev,
      elapsedMs,
      stableMs,
    });
    if (phase !== "wait") return prev;
    await sleep(500);
    const next = await raceTimeout(
      page.evaluate(countVisibleLeadFields),
      PAGE_OP_TIMEOUT_MS,
      0
    );
    if (next !== prev) {
      stableSince = Date.now();
      prev = next;
    }
  }
  return prev;
}

/** Fonts, optional form CSS, then laid-out images — same path for every URL. */
async function waitUntilDocumentPainted(page: Page): Promise<void> {
  if (!pageStillOpen(page)) return;
  await raceTimeout(
    page.evaluate(() => document.fonts.ready.then(() => true)),
    8_000,
    false
  );
  await raceTimeout(
    page.evaluate(eagerDecodeDocumentImages),
    PAGE_OP_TIMEOUT_MS,
    { promoted: 0, decoded: 0, total: 0 }
  );
  // waitForFunction keeps a CDP binding that Cloud Run Chromium drops.
  if (!usesLocalChrome()) return;
  await page
    .waitForFunction(pageFontsReady, { timeout: 5_000 })
    .catch(() => undefined);
  await page
    .waitForFunction(pageLeadFieldsHaveAuthorCss, { timeout: 8_000 })
    .catch(() => undefined);
  await page
    .waitForFunction(documentImagesMostlyDecoded, { timeout: 8_000 })
    .catch(() => undefined);
}

async function waitUntilLayoutStable(page: Page): Promise<void> {
  const deadline = Date.now() + LAYOUT_STABLE_BUDGET_MS;
  let prev = await raceTimeout(
    page.evaluate(collectLayoutSnapshotInPage),
    PAGE_OP_TIMEOUT_MS,
    null
  );
  if (!prev) return;
  while (Date.now() < deadline) {
    await sleep(LAYOUT_STABLE_MS);
    const next = await raceTimeout(
      page.evaluate(collectLayoutSnapshotInPage),
      PAGE_OP_TIMEOUT_MS,
      null
    );
    if (!next) return;
    if (layoutSnapshotsEqual(prev, next)) return;
    prev = next;
  }
}

async function captureViewportJpeg(page: Page): Promise<Screenshot | null> {
  const raw = await raceTimeout<Buffer | Uint8Array | null>(
    page.screenshot({ type: "jpeg", quality: 82, fullPage: false }),
    shotTimeoutMs(),
    null
  );
  if (!raw) return null;
  const base64 = Buffer.from(raw).toString("base64");
  return {
    device: "desktop",
    base64,
    mimeType: "image/jpeg",
    dataUri: `data:image/jpeg;base64,${base64}`,
    width: VIEWPORT.width,
    height: VIEWPORT.height,
  };
}

/**
 * Proof-style control shot: grow the viewport to the document height so
 * Chromium paints one screen, then clip that box. Do not use fullPage.
 */
async function captureClippedDocumentJpeg(page: Page): Promise<Screenshot | null> {
  const extent = await raceTimeout(
    page.evaluate(measurePageExtent),
    PAGE_OP_TIMEOUT_MS,
    { width: VIEWPORT.width, height: VIEWPORT.height }
  );
  const height = clampShotHeight(extent.height);
  try {
    await raceTimeout(
      page.setViewport({
        width: VIEWPORT.width,
        height,
        deviceScaleFactor: 1,
      }),
      PAGE_OP_TIMEOUT_MS,
      undefined
    );
    await waitUntilLayoutStable(page);
    const raw = await raceTimeout<Buffer | Uint8Array | null>(
      page.screenshot({
        type: "jpeg",
        quality: 75,
        clip: { x: 0, y: 0, width: VIEWPORT.width, height },
      }),
      fullPageTimeoutMs(),
      null
    );
    if (!raw) return null;
    const buf = Buffer.from(raw);
    const base64 = buf.toString("base64");
    const dims = jpegDimensions(buf) ?? {
      width: VIEWPORT.width,
      height,
    };
    return {
      device: "desktop",
      base64,
      mimeType: "image/jpeg",
      dataUri: `data:image/jpeg;base64,${base64}`,
      width: dims.width,
      height: dims.height,
    };
  } catch (err) {
    console.warn(
      "[screenshot] clipped document capture failed:",
      (err as Error)?.message ?? err
    );
    return null;
  } finally {
    await raceTimeout(page.setViewport(VIEWPORT), PAGE_OP_TIMEOUT_MS, undefined);
  }
}

/** DevTools "Capture full size screenshot" — do not resize the 1440 viewport. */
async function captureNativeFullPageJpeg(page: Page): Promise<Screenshot | null> {
  let cdp: Awaited<ReturnType<Page["createCDPSession"]>> | null = null;
  try {
    cdp = await page.createCDPSession();
    const result = await raceTimeout<{ data?: string } | null>(
      cdp.send("Page.captureScreenshot", {
        format: "jpeg",
        quality: 75,
        fromSurface: true,
        captureBeyondViewport: true,
      }),
      fullPageTimeoutMs(),
      null
    );
    if (!result?.data) return null;
    const raw = Buffer.from(result.data, "base64");
    const measured = await raceTimeout(
      page.evaluate(measurePageExtent),
      PAGE_OP_TIMEOUT_MS,
      { width: VIEWPORT.width, height: VIEWPORT.height }
    );
    const dims = jpegDimensions(raw) ?? {
      width: VIEWPORT.width,
      height: Math.max(1, Math.floor(measured.height || VIEWPORT.height)),
    };
    return {
      device: "desktop",
      base64: result.data,
      mimeType: "image/jpeg",
      dataUri: `data:image/jpeg;base64,${result.data}`,
      width: dims.width,
      height: dims.height,
    };
  } catch (err) {
    console.warn(
      "[screenshot] native full-page capture failed:",
      (err as Error)?.message ?? err
    );
    return null;
  } finally {
    if (cdp) await cdp.detach().catch(() => {});
  }
}

/** Puppeteer fullPage fallback when CDP clips the document short. */
async function capturePuppeteerFullPageJpeg(page: Page): Promise<Screenshot | null> {
  const raw = await raceTimeout<Buffer | Uint8Array | null>(
    page.screenshot({ type: "jpeg", quality: 75, fullPage: true }),
    fullPageTimeoutMs(),
    null
  );
  if (!raw) return null;
  const buf = Buffer.from(raw);
  const base64 = buf.toString("base64");
  const dims = jpegDimensions(buf) ?? {
    width: VIEWPORT.width,
    height: VIEWPORT.height,
  };
  return {
    device: "desktop",
    base64,
    mimeType: "image/jpeg",
    dataUri: `data:image/jpeg;base64,${base64}`,
    width: dims.width,
    height: dims.height,
  };
}

async function shootControlJpeg(
  page: Page
): Promise<{ shot: Screenshot | null; method: string }> {
  if (!pageStillOpen(page)) return { shot: null, method: "none" };
  // Cloud Run: CDP first. Clip resizes the viewport and OOMs the container.
  if (!usesLocalChrome()) {
    let shot = await captureNativeFullPageJpeg(page);
    if (shot) return { shot, method: "cdp" };
    shot = await capturePuppeteerFullPageJpeg(page);
    if (shot) return { shot, method: "fullPage" };
    shot = await captureClippedDocumentJpeg(page);
    if (shot) return { shot, method: "clip" };
    return { shot: null, method: "none" };
  }
  let shot = await captureClippedDocumentJpeg(page);
  if (shot) return { shot, method: "clip" };
  shot = await captureNativeFullPageJpeg(page);
  if (shot) return { shot, method: "cdp" };
  shot = await capturePuppeteerFullPageJpeg(page);
  if (shot) return { shot, method: "fullPage" };
  return { shot: null, method: "none" };
}

/** Cloud Run: fold first, then consent / fonts. No walk, no waitForFunction. */
async function captureServerlessControl(page: Page): Promise<{
  viewport: Screenshot | null;
  control: Screenshot | null;
  dismissedConsent: boolean;
  method: string;
}> {
  await raceTimeout(
    page.evaluate(() => window.scrollTo(0, 0)),
    PAGE_OP_TIMEOUT_MS,
    undefined
  );
  const viewport = pageStillOpen(page)
    ? await captureViewportJpeg(page)
    : null;
  const dismissedConsent = await clearVisitorConsent(page, true);
  await waitForFonts(page);
  await raceTimeout(
    page.evaluate(eagerDecodeDocumentImages),
    PAGE_OP_TIMEOUT_MS,
    { promoted: 0, decoded: 0, total: 0 }
  );
  const taken = await shootControlJpeg(page);
  const control = taken.shot ?? viewport;
  return {
    viewport,
    control,
    dismissedConsent,
    method: taken.shot ? taken.method : viewport ? "viewport" : "none",
  };
}

async function walkUntilPageSettled(
  page: Page
): Promise<{ width: number; height: number }> {
  const fallback = { width: VIEWPORT.width, height: VIEWPORT.height };
  if (!pageStillOpen(page)) return fallback;
  try {
    const first = await raceTimeout(
      page.evaluate(measurePageExtent),
      PAGE_OP_TIMEOUT_MS,
      fallback
    );
    await scrollThrough(page, Math.max(1, first.height));
    if (!pageStillOpen(page)) return first;
    const second = await raceTimeout(
      page.evaluate(measurePageExtent),
      PAGE_OP_TIMEOUT_MS,
      first
    );
    if (second.height > first.height && pageStillOpen(page)) {
      await scrollThrough(page, second.height);
      if (!pageStillOpen(page)) return second;
      return raceTimeout(
        page.evaluate(measurePageExtent),
        PAGE_OP_TIMEOUT_MS,
        second
      );
    }
    return second;
  } catch (err) {
    if (!isDeadPageError(err)) {
      console.warn(
        "[screenshot] page walk failed:",
        (err as Error)?.message ?? err
      );
    }
    return fallback;
  }
}

async function captureControlFullPage(
  page: Page
): Promise<{ shot: Screenshot | null; ready: boolean }> {
  try {
    if (!pageStillOpen(page)) {
      return { shot: null, ready: false };
    }
    await clearVisitorConsent(page, true);
    if (!pageStillOpen(page)) {
      return { shot: null, ready: false };
    }
    // Cloud Run: shoot before any scroll walk. The walk is what detaches the frame.
    if (!usesLocalChrome()) {
      await waitUntilDocumentPainted(page);
      const early = await shootControlJpeg(page);
      if (early.shot) return { shot: early.shot, ready: true };
    }
    await raceTimeout(
      page.evaluate(() => window.scrollTo(0, 0)),
      PAGE_OP_TIMEOUT_MS,
      undefined
    );
    const fieldCount = await waitUntilLeadFieldsStable(page);
    await waitUntilDocumentPainted(page);
    // Extra remount walk is local-only. Cloud Run Chromium dies on long walks.
    if (fieldCount > 0 && usesLocalChrome()) {
      await walkUntilPageSettled(page);
      await waitUntilDocumentPainted(page);
    }
    if (!pageStillOpen(page)) {
      return { shot: null, ready: false };
    }
    const gateReady = await raceTimeout(
      page.evaluate(pageIsCaptureReady),
      PAGE_OP_TIMEOUT_MS,
      false
    );
    const afterSettle = await raceTimeout(
      page.evaluate(collectImageLoadInventory),
      PAGE_OP_TIMEOUT_MS,
      null
    );
    const undecode = imagesTooIncomplete(afterSettle);
    await raceTimeout(
      page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight)
      ),
      PAGE_OP_TIMEOUT_MS,
      undefined
    );
    await raceTimeout(
      page.evaluate(inlineZeroNaturalSvgImages),
      PAGE_OP_TIMEOUT_MS,
      0
    );
    await raceTimeout(
      page.evaluate(() => window.scrollTo(0, 0)),
      PAGE_OP_TIMEOUT_MS,
      undefined
    );
    await waitUntilLayoutStable(page);
    if (!pageStillOpen(page)) {
      return { shot: null, ready: false };
    }
    const taken = await shootControlJpeg(page);
    const shot = taken.shot;
    let ready = !undecode && gateReady;
    // A real desktop JPEG is enough. The style/blank probe false-fails short
    // pages (example.com) and sparse heroes; only fail when visible images
    // never decoded.
    if (!ready && !undecode && shot) ready = true;
    return { shot, ready };
  } catch (err) {
    console.warn(
      "[screenshot] control full-page failed:",
      (err as Error)?.message ?? err
    );
    return { shot: null, ready: false };
  }
}

/** Full-page Wayback replay. Never used to evade a live wall. */
async function captureArchivePage(
  page: Page,
  hit: WaybackHit,
  desktopUa: string
): Promise<{ shot: Screenshot; hero: Screenshot | null } | null> {
  try {
    await assertSafeExternalUrl(hit.replayUrl);
  } catch {
    return null;
  }
  try {
    await raceTimeout(
      page.setViewport(VIEWPORT),
      PAGE_OP_TIMEOUT_MS,
      undefined
    );
    await page.setUserAgent(desktopUa);
    await page.goto(hit.replayUrl, { waitUntil: "domcontentloaded" });
    await raceTimeout(
      page.evaluate(hideArchiveChromeInPage),
      PAGE_OP_TIMEOUT_MS,
      0
    );
    const gate = await prepareViewportForShot(page);
    if (!gate.ready) {
      console.warn(
        `[screenshot] archive snapshot ${hit.timestamp} failed the ready gate — keeping live`
      );
      return null;
    }
    const hero = await captureViewportJpeg(page);
    const { shot } = await captureControlFullPage(page);
    if (!shot) return null;
    return { shot, hero };
  } catch (err) {
    console.warn(
      "[screenshot] archive capture failed:",
      (err as Error)?.message ?? err
    );
    return null;
  }
}

/** True content height — scrollHeight alone often misses overflow/lazy tails. */
function measurePageExtent(): { width: number; height: number } {
  const doc = document.documentElement;
  const body = document.body;
  let maxBottom = 0;
  const roots = [
    body,
    ...Array.from(
      document.querySelectorAll("main, article, footer, #__next, #root, [data-footer]")
    ),
  ];
  for (const el of roots) {
    if (!(el instanceof HTMLElement)) continue;
    const r = el.getBoundingClientRect();
    maxBottom = Math.max(maxBottom, r.bottom + window.scrollY);
    for (const child of Array.from(el.children)) {
      if (!(child instanceof HTMLElement)) continue;
      const cr = child.getBoundingClientRect();
      maxBottom = Math.max(maxBottom, cr.bottom + window.scrollY);
    }
  }
  for (const node of Array.from(document.querySelectorAll("img, svg"))) {
    const r = node.getBoundingClientRect();
    if (r.width < 16 && r.height < 16) continue;
    maxBottom = Math.max(maxBottom, r.bottom + window.scrollY);
  }
  return {
    width: Math.max(doc.scrollWidth, body?.scrollWidth ?? 0, window.innerWidth),
    height: Math.max(
      doc.scrollHeight,
      doc.offsetHeight,
      body?.scrollHeight ?? 0,
      body?.offsetHeight ?? 0,
      Math.ceil(maxBottom)
    ),
  };
}

async function waitInViewImages(page: Page): Promise<void> {
  if (!pageStillOpen(page)) return;
  // waitForFunction keeps a CDP binding open. On Cloud Run that binding
  // throws "detached Frame" when Sparticuz Chromium dies mid-scroll.
  if (!usesLocalChrome()) {
    await sleep(120);
    return;
  }
  try {
    await raceTimeout(
      page
        .waitForFunction(() => {
          const vh = window.innerHeight || 900;
          for (const img of Array.from(document.images)) {
            const r = img.getBoundingClientRect();
            if (r.width < 24 && r.height < 16) continue;
            if (r.bottom < 0 || r.top > vh) continue;
            const src = (img.currentSrc || img.src || "").toLowerCase();
            const svg =
              img.complete &&
              (/\.svg(\?|#|$)/.test(src) || src.startsWith("data:image/svg"));
            if ((img.complete && img.naturalWidth > 20) || svg) continue;
            return false;
          }
          return true;
        }, { timeout: 2500 })
        .then(() => undefined),
      2_600,
      undefined
    );
  } catch {
    /* walk must never abort the control shot */
  }
}

async function scrollThrough(page: Page, maxY: number): Promise<void> {
  const cap = usesLocalChrome()
    ? maxY
    : Math.min(maxY, VIEWPORT.height * 4);
  let y = 0;
  while (y < cap) {
    if (!pageStillOpen(page)) return;
    await raceTimeout(
      page.evaluate((top) => window.scrollTo(0, top), y),
      PAGE_OP_TIMEOUT_MS,
      undefined
    );
    await waitInViewImages(page);
    y += BAND_STEP;
  }
  if (pageStillOpen(page)) {
    await raceTimeout(
      page.evaluate(() => window.scrollTo(0, 0)),
      PAGE_OP_TIMEOUT_MS,
      undefined
    );
  }
}

async function captureBands(
  page: Page,
  bands: ScreenshotBand[],
  captureHeight: number
): Promise<void> {
  const tops = bandScrollTops(captureHeight);
  for (let i = 0; i < tops.length; i++) {
    const top = tops[i]!;
    await raceTimeout(page.evaluate((y) => window.scrollTo(0, y), top), PAGE_OP_TIMEOUT_MS, undefined);
    await sleep(SCROLL_SETTLE_MS);
    const raw = await raceTimeout<Buffer | Uint8Array | null>(
      page.screenshot({ type: "jpeg", quality: 72, fullPage: false }),
      SCREENSHOT_TIMEOUT_MS,
      null
    );
    if (!raw) continue;
    const base64 = Buffer.from(raw).toString("base64");
    const bandH = Math.min(BAND_HEIGHT, Math.max(1, captureHeight - top));
    bands.push({
      device: "desktop",
      base64,
      mimeType: "image/jpeg",
      dataUri: `data:image/jpeg;base64,${base64}`,
      width: VIEWPORT.width,
      height: BAND_HEIGHT,
      index: bands.length + 1,
      startY: top / captureHeight,
      heightFraction: bandH / captureHeight,
    });
  }
  await raceTimeout(page.evaluate(() => window.scrollTo(0, 0)), PAGE_OP_TIMEOUT_MS, undefined);
}
