import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

import { detectChallenge } from "@/lib/challenge";

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

export interface ScreenshotResult {
  screenshots: Screenshot[];
  // Set when the renderer was served a bot-protection / verification wall
  // instead of the real page. The HTML analysis may still be valid.
  blockedReason: string | null;
}

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 1 } as const;
// Bound the in-memory image (and the sessionStorage payload) for very tall
// pages by clipping the capture height.
const MAX_HEIGHT = 12000;
const NAV_TIMEOUT_MS = 30_000;

async function launchBrowser(): Promise<Browser> {
  // Local dev: point at an installed Chrome/Edge. The serverless Chromium args
  // (e.g. --single-process) can crash a desktop Chrome, so use a minimal set.
  const localPath = process.env.CHROME_EXECUTABLE_PATH;
  if (localPath) {
    return puppeteer.launch({
      executablePath: localPath,
      headless: true,
      defaultViewport: VIEWPORT,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
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
  let blockedReason: string | null = null;
  let browser: Browser | null = null;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(DESKTOP_UA);
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    let status = 0;
    try {
      const response = await page.goto(url, { waitUntil: "networkidle2" });
      status = response?.status() ?? 0;
    } catch {
      // Navigation timed out or aborted — capture whatever rendered anyway.
    }

    // Let late-loading hero animations / lazy content settle.
    await new Promise((r) => setTimeout(r, 1500));

    // Detect bot walls from the rendered page before trusting the screenshot.
    const title = await page.title().catch(() => "");
    const bodySample = await page
      .evaluate(() => document.body?.innerText?.slice(0, 600) ?? "")
      .catch(() => "");
    const challenge = detectChallenge(`${title} ${bodySample}`);
    if (challenge) {
      blockedReason = challenge;
    } else if (status >= 400) {
      blockedReason = status === 403 || status === 429 ? "WAF block" : `HTTP ${status}`;
    }

    if (!blockedReason) {
      const dims = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      }));
      const width = dims.width || VIEWPORT.width;
      const clipped = dims.height > MAX_HEIGHT;
      const height = clipped ? MAX_HEIGHT : dims.height || VIEWPORT.height;

      const raw = await page.screenshot(
        clipped
          ? {
              type: "jpeg",
              quality: 80,
              clip: { x: 0, y: 0, width, height, scale: 1 },
              captureBeyondViewport: true,
            }
          : { type: "jpeg", quality: 80, fullPage: true }
      );

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
  } catch (err) {
    console.error("[screenshot] capture failed:", err);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return { screenshots, blockedReason };
}
