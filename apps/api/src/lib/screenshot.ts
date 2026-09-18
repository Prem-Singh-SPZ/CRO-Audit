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
  imagesTooIncomplete,
  inlineZeroNaturalSvgImages,
  lockDesktopShotWidth,
  pageIsCaptureReady,
  shouldRetryCapture,
} from "./capture-quality";
import { jpegDimensions } from "./jpeg-size";
import { inspectAndHideLiveTestInPage } from "./live-test";
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

/** Scroll tops for viewport bands that tile the stitch with a small overlap. */
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

  return puppeteer.launch({
    args: [
      ...chromium.args,
      "--disable-dev-shm-usage",
      "--disable-crash-reporter",
      "--disable-gpu",
    ],
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
  if (!shouldRetryCapture(first)) return first;
  console.warn("[screenshot] retrying empty capture");
  return captureScreenshotsOnce(url, archiveLookup);
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
    const page: Page = await browser.newPage();
    desktopUa = await desktopUserAgent(browser);
    await page.setUserAgent(desktopUa);
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
    // Basic fingerprint hardening: hide the headless `navigator.webdriver`
    // flag so naive bot checks don't wall us. Won't defeat geo-blocks or
    // advanced (DataDome-class) protection.
    // String source: tsx/esbuild keepNames injects `__name()` into compiled
    // functions. page.evaluate serializes that source, and the page has no
    // `__name` — consent dismiss, form-ready, and hide-overlay all no-op'd.
    await page.evaluateOnNewDocument(`
      Object.defineProperty(navigator, "webdriver", { get: function () { return undefined; } });
      globalThis.__name = function (fn) { return fn; };
    `);
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    // SSRF guard for the browser: abort any request (including redirects and
    // subresources) that targets a disallowed scheme, internal host, or
    // private/reserved IP literal. The primary target's DNS is already checked
    // upstream via assertSafeExternalUrl.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const href = req.url();
      if (href.startsWith("data:") || href.startsWith("blob:")) {
        req.continue().catch(() => {});
        return;
      }
      if (isBlockedUrlSync(href)) {
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

    await waitUntilDocumentComplete(page);
    await page
      .waitForNetworkIdle({ idleTime: 800, timeout: 8000 })
      .catch(() => {});

    await waitOutAutoChallenge(page);
    // Consent first — always, even when the form already has fields. Fastly
    // OneTrust ("Accept default settings") otherwise stays on the desktop shot.
    dismissedConsent = await raceTimeout(
      page.evaluate(dismissConsentInPage),
      PAGE_OP_TIMEOUT_MS,
      false
    );
    if (dismissedConsent) await sleep(400);
    const hiddenOverlays = await raceTimeout(
      page.evaluate(hideConsentOverlaysInPage),
      PAGE_OP_TIMEOUT_MS,
      0
    );
    if (hiddenOverlays > 0) dismissedConsent = true;
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
      if (live.vendor) {
        liveTest = { vendor: live.vendor };
        console.log(
          `[screenshot] live test ${live.vendor} (hid ${live.hidden} chrome nodes)`
        );
      }

      // Grab the post-JS DOM so the caller can recover CRO signals if the plain
      // HTTP crawl was walled by a WAF. Bounded (~2MB) so a giant document can't
      // balloon function memory; time-boxed like every other page op.
      const html = await raceTimeout(page.content(), PAGE_OP_TIMEOUT_MS, "");
      renderedHtml = html ? html.slice(0, 2_000_000) : null;

      // Fold JPEG = mockup seed only. Control / Your page is Chrome's native
      // full-page capture after a lazy-load walk (and a second CMP hide).
      await raceTimeout(
        page.evaluate(() => window.scrollTo(0, 0)),
        PAGE_OP_TIMEOUT_MS,
        undefined
      );
      const gateReady = await prepareViewportForShot(page);
      if (gateReady.dismissedConsent) dismissedConsent = true;
      const viewportShot = await captureViewportJpeg(page);
      if (viewportShot) heroShot = viewportShot;

      const control = await captureControlFullPage(page);
      const controlShot = control.shot;
      if (controlShot) {
        screenshots.push(controlShot);
      } else if (viewportShot) {
        screenshots.push(viewportShot);
      }

      const stitchW = controlShot?.width ?? VIEWPORT.width;
      const stitchH = controlShot?.height ?? VIEWPORT.height;
      landmarks = await measureLandmarks(
        page,
        stitchW,
        stitchH,
        PAGE_OP_TIMEOUT_MS
      );

      const signals = await raceTimeout(
        page.evaluate(collectCaptureSignalsInPage),
        PAGE_OP_TIMEOUT_MS,
        emptySignals()
      );
      const copySample = await raceTimeout(
        page.evaluate(() => document.body?.innerText?.slice(0, 4000) ?? ""),
        PAGE_OP_TIMEOUT_MS,
        ""
      );
      const quality = assessCaptureQuality({
        signals,
        hasFormLandmark: landmarks.some((l) => l.id === "form"),
        copyText: copySample,
        dismissedConsent,
      });
      const hasCollapsedIframe = signals.formIframes.some(
        (f) => f.width >= 80 && f.height < 40
      );
      if (!control.ready) {
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

      // Bands for the audit model only — never sent as "Your page".
      await captureBands(
        page,
        bands,
        Math.max(1, Math.floor(stitchH || VIEWPORT.height))
      );
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
  } catch (err) {
    console.error("[screenshot] capture failed:", (err as Error)?.message ?? err);
    console.error("[screenshot] stack:", (err as Error)?.stack);
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
  await page
    .waitForNetworkIdle({ idleTime: 800, timeout: 8000 })
    .catch(() => {});
  const clicked = await raceTimeout(
    page.evaluate(dismissConsentInPage),
    PAGE_OP_TIMEOUT_MS,
    false
  );
  if (clicked) {
    dismissedConsent = true;
    await sleep(350);
  }
  const hidden = await raceTimeout(
    page.evaluate(hideConsentOverlaysInPage),
    PAGE_OP_TIMEOUT_MS,
    0
  );
  if (hidden > 0) dismissedConsent = true;
  await waitForFonts(page);
  let ready = false;
  try {
    await page.waitForFunction(pageIsCaptureReady, { timeout: READY_WAIT_MS });
    ready = true;
  } catch {
    ready = false;
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
    SCREENSHOT_TIMEOUT_MS,
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
      FULL_PAGE_TIMEOUT_MS,
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

async function walkUntilPageSettled(
  page: Page
): Promise<{ width: number; height: number }> {
  const first = await raceTimeout(
    page.evaluate(measurePageExtent),
    PAGE_OP_TIMEOUT_MS,
    { width: VIEWPORT.width, height: VIEWPORT.height }
  );
  await scrollThrough(page, Math.max(1, first.height));
  const second = await raceTimeout(
    page.evaluate(measurePageExtent),
    PAGE_OP_TIMEOUT_MS,
    first
  );
  if (second.height > first.height) {
    await scrollThrough(page, second.height);
    return raceTimeout(
      page.evaluate(measurePageExtent),
      PAGE_OP_TIMEOUT_MS,
      second
    );
  }
  return second;
}

async function captureControlFullPage(
  page: Page
): Promise<{ shot: Screenshot | null; ready: boolean }> {
  await walkUntilPageSettled(page);
  const hidden = await raceTimeout(
    page.evaluate(hideConsentOverlaysInPage),
    PAGE_OP_TIMEOUT_MS,
    0
  );
  if (hidden > 0) {
    console.log(`[screenshot] hid ${hidden} consent nodes after full-page walk`);
  }
  await raceTimeout(
    page.evaluate(() => window.scrollTo(0, 0)),
    PAGE_OP_TIMEOUT_MS,
    undefined
  );
  await sleep(5_000);
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
  await raceTimeout(
    page.evaluate(lockDesktopShotWidth, VIEWPORT.width),
    PAGE_OP_TIMEOUT_MS,
    undefined
  );
  const shot = await captureNativeFullPageJpeg(page);
  let ready = !undecode && gateReady;
  // A real desktop JPEG is enough. The style/blank probe false-fails short
  // pages (example.com) and sparse heroes; only fail when visible images
  // never decoded.
  if (!ready && !undecode && shot) ready = true;
  return { shot, ready };
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
  await page
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
    .catch(() => {});
}

async function scrollThrough(page: Page, maxY: number): Promise<void> {
  let y = 0;
  while (y < maxY) {
    await raceTimeout(page.evaluate((top) => window.scrollTo(0, top), y), PAGE_OP_TIMEOUT_MS, undefined);
    await waitInViewImages(page);
    y += BAND_STEP;
  }
  await raceTimeout(page.evaluate(() => window.scrollTo(0, 0)), PAGE_OP_TIMEOUT_MS, undefined);
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
