import type { LighthouseSummary, PageContext } from "@/lib/cro";

export interface PageSpeedScreenshot {
  device: "desktop" | "mobile";
  dataUrl: string;
  width: number;
  height: number;
}

export interface PageSpeedResult {
  lighthouse: LighthouseSummary | null;
  screenshots: PageSpeedScreenshot[];
}

const PSI_ENDPOINT =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

type Strategy = "mobile" | "desktop";

interface RawStrategyResult {
  strategy: Strategy;
  summary: LighthouseSummary;
  screenshot: PageSpeedScreenshot | null;
}

function pct(score: number | null | undefined): number {
  return Math.round(((score ?? 0) as number) * 100);
}

async function runStrategy(
  url: string,
  strategy: Strategy
): Promise<RawStrategyResult | null> {
  const params = new URLSearchParams({ url, strategy });
  for (const cat of ["performance", "accessibility", "best-practices", "seo"]) {
    params.append("category", cat);
  }
  const key = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (key) params.append("key", key);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const res = await fetch(`${PSI_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const json = (await res.json()) as any;
    const lhr = json?.lighthouseResult;
    if (!lhr) return null;

    const categories = lhr.categories ?? {};
    const audits = lhr.audits ?? {};
    const num = (id: string): number | undefined => {
      const v = audits?.[id]?.numericValue;
      return typeof v === "number" ? Math.round(v) : undefined;
    };

    const summary: LighthouseSummary = {
      performance: pct(categories.performance?.score),
      accessibility: pct(categories.accessibility?.score),
      bestPractices: pct(categories["best-practices"]?.score),
      seo: pct(categories.seo?.score),
      metrics: {
        lcp: num("largest-contentful-paint"),
        fcp: num("first-contentful-paint"),
        cls: audits?.["cumulative-layout-shift"]?.numericValue as
          | number
          | undefined,
        tbt: num("total-blocking-time"),
        si: num("speed-index"),
        tti: num("interactive"),
      },
    };

    const device: "desktop" | "mobile" =
      strategy === "desktop" ? "desktop" : "mobile";

    // Prefer the full-page screenshot (includes dimensions); fall back to the
    // above-the-fold final screenshot audit.
    let screenshot: PageSpeedScreenshot | null = null;
    const fps = lhr.fullPageScreenshot?.screenshot;
    if (fps?.data) {
      screenshot = {
        device,
        dataUrl: fps.data,
        width: fps.width ?? (device === "mobile" ? 390 : 1440),
        height: fps.height ?? 0,
      };
    } else {
      const finalData = audits?.["final-screenshot"]?.details?.data;
      if (typeof finalData === "string") {
        screenshot = {
          device,
          dataUrl: finalData,
          width: device === "mobile" ? 390 : 1440,
          height: 0,
        };
      }
    }

    return { strategy, summary, screenshot };
  } catch {
    return null;
  }
}

/**
 * Runs Google PageSpeed Insights for mobile + desktop in parallel and returns
 * a Lighthouse summary (mobile-first, matching Lighthouse's default emulation)
 * plus screenshots for each strategy. Returns lighthouse: null if both fail so
 * the caller can fall back to a heuristic estimate.
 */
export async function getPageSpeed(url: string): Promise<PageSpeedResult> {
  const [mobile, desktop] = await Promise.all([
    runStrategy(url, "mobile"),
    runStrategy(url, "desktop"),
  ]);

  const screenshots: PageSpeedScreenshot[] = [];
  if (desktop?.screenshot) screenshots.push(desktop.screenshot);
  if (mobile?.screenshot) screenshots.push(mobile.screenshot);

  // Mobile summary is preferred (Lighthouse defaults to mobile), else desktop.
  const lighthouse = mobile?.summary ?? desktop?.summary ?? null;

  return { lighthouse, screenshots };
}

/**
 * Heuristic Lighthouse estimate from crawl signals, used when the PageSpeed
 * API is unavailable so the pipeline always produces a report.
 */
export function fallbackLighthouse(ctx: PageContext): LighthouseSummary {
  const loadPenalty = Math.min(50, Math.max(0, (ctx.loadTimeMs - 1500) / 100));
  const altCoverage =
    ctx.images.total === 0 ? 1 : ctx.images.withAlt / ctx.images.total;
  return {
    performance: Math.round(Math.max(30, 92 - loadPenalty)),
    accessibility: Math.round(60 + altCoverage * 30),
    bestPractices: ctx.isHttps ? 83 : 62,
    seo: Math.round(
      (ctx.metaDescription ? 85 : 65) + (ctx.headings.h1.length ? 5 : -10)
    ),
    metrics: {
      lcp: Math.round(ctx.loadTimeMs * 0.8),
      fcp: Math.round(ctx.loadTimeMs * 0.5),
      cls: 0.05,
      tbt: 120,
      si: Math.round(ctx.loadTimeMs * 0.7),
      tti: ctx.loadTimeMs,
    },
  };
}
