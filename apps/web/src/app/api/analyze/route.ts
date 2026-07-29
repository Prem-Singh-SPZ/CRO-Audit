import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { scanRequestSchema } from "@/lib/cro";
import { analyzePage } from "@/lib/analyzer";
import { getPageSpeed, fallbackLighthouse } from "@/lib/pagespeed";
import { captureScreenshots } from "@/lib/screenshot";
import { generateReport } from "@/lib/ai";
import { assertSafeExternalUrl, UnsafeUrlError } from "@/lib/net-guard";
import { getClientIp, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { groundedLiftLabel } from "@/lib/win-patterns";
import { logEvent, logError } from "@/lib/logger";
import { safeHost } from "@/lib/utils";
import {
  getCachedResult,
  setCachedResult,
  resultCacheKey,
} from "@/lib/result-cache";
import type { ReportResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// PageSpeed (15-45s) runs before a vision-LLM call (Opus can take 60-90s), so
// allow generous headroom. On Vercel this needs a plan whose function limit is
// >= this value (Pro/Enterprise); Hobby caps at 10s.
export const maxDuration = 120;

export async function POST(request: Request) {
  const { limit, windowMs } = RATE_LIMITS.analyze;
  const rl = rateLimit(`analyze:${getClientIp(request)}`, limit, windowMs);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many audits. Please wait a moment and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))),
        },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = scanRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Please enter a valid website URL";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const url = parsed.data.url;
  const auditContext = {
    targetAudience: parsed.data.targetAudience,
    coreProduct: parsed.data.coreProduct,
    primaryTrafficSource: parsed.data.primaryTrafficSource,
  };

  // SSRF guard: reject internal/private/reserved targets (and DNS-rebinding)
  // before we fetch or launch a browser against the URL.
  try {
    await assertSafeExternalUrl(url);
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Please enter a valid website URL." },
      { status: 400 }
    );
  }

  const startedAt = Date.now();
  const host = safeHost(url);

  // Serve a recent identical audit from the opt-in cache (no-op unless
  // ENABLE_RESULT_CACHE=true) to cut cost/latency on repeat scans.
  const cacheKey = resultCacheKey(
    url,
    (process.env.AI_PROVIDER || "mock").toLowerCase(),
    auditContext
  );
  const cached = getCachedResult(cacheKey);
  if (cached) {
    logEvent("analyze.cache_hit", { host });
    return NextResponse.json(cached);
  }

  logEvent("analyze.start", { host });

  try {
    // Crawl (cheerio), PageSpeed metrics, and screenshots run in parallel.
    const [pageContext, pageSpeed, screenshotResult] = await Promise.all([
      analyzePage(url),
      getPageSpeed(url),
      captureScreenshots(url),
    ]);
    const screenshots = screenshotResult.screenshots;
    const heroShot = screenshotResult.heroShot;

    // Merge the two independent "blocked" signals: the cheerio fetch and the
    // headless browser can disagree (one gets a WAF wall, the other real HTML).
    // If EITHER says blocked, treat the page as unread so we never audit a
    // challenge page as if it were the real landing page.
    if (screenshotResult.blockedReason && !pageContext.blocked) {
      pageContext.blocked = true;
      pageContext.blockReason = screenshotResult.blockedReason;
    }

    // SPA detection: static HTML crawl looks empty but the rendered page has
    // real content → client-rendered. Flag it so the LLM trusts the screenshot
    // instead of reporting false "missing headline/CTA" issues from empty DOM.
    const crawlThin = pageContext.wordCount < 60 || pageContext.headings.h1.length === 0;
    const renderedRich =
      !!screenshotResult.rendered &&
      (screenshotResult.rendered.textLength > 400 ||
        screenshotResult.rendered.h1Count > 0);
    if (!pageContext.blocked && crawlThin && renderedRich) {
      pageContext.clientRendered = true;
    }

    const lighthouse = pageSpeed.lighthouse ?? fallbackLighthouse(pageContext);
    const { report, provider, fallbackReason } = await generateReport({
      pageContext,
      lighthouse,
      screenshots,
      auditContext,
    });

    const now = new Date().toISOString();
    const scanId = randomUUID();

    logEvent("analyze.complete", {
      scanId,
      host,
      provider,
      ...(fallbackReason ? { fallbackReason } : {}),
      blocked: pageContext.blocked,
      clientRendered: !!pageContext.clientRendered,
      issues: report.issues.length,
      hasScreenshot: screenshots.length > 0,
      durationMs: Date.now() - startedAt,
    });

    const response: ReportResponse = {
      scan: {
        id: scanId,
        url: pageContext.finalUrl || url,
        status: "COMPLETE",
        progress: 100,
        stage: "complete",
        error: null,
        createdAt: now,
        completedAt: now,
        shareId: null,
      },
      report: {
        id: randomUUID(),
        overallScore: report.overallScore,
        primaryBottleneck: report.primaryBottleneck ?? "",
        categoryScores: report.categoryScores,
        summary: report.summary,
        strengths: report.strengths,
        weaknesses: report.weaknesses,
        priority: report.priority,
        confidence: report.confidence,
        estimatedImpact: report.estimatedImpact,
        aiProvider: provider,
      },
      issues: report.issues.map((i) => ({
        id: randomUUID(),
        category: i.category,
        title: i.title,
        description: i.description,
        whyItMatters: i.whyItMatters,
        psychology: i.psychology || i.whyItMatters,
        severity: i.severity,
        confidence: i.confidence,
        businessImpact: i.businessImpact,
        suggestedFix: i.suggestedFix,
        // Ground the displayed lift in Spiralyze's proven A/B pattern data where
        // the issue category has a comparable bucket; otherwise keep the
        // model/heuristic estimate. Avoids presenting ungrounded guesses as fact.
        estimatedConversionImpact: groundedLiftLabel(
          i.category,
          i.estimatedConversionImpact
        ),
        complexity: i.complexity ?? null,
        riskOfDiy: i.riskOfDiy ?? null,
        device: i.annotation?.device ?? null,
        annotationX: i.annotation?.x ?? null,
        annotationY: i.annotation?.y ?? null,
      })),
      recommendations: report.recommendations.map((r) => ({
        id: randomUUID(),
        title: r.title,
        description: r.description,
        impact: r.impact,
        effort: r.effort,
        category: r.category,
      })),
      screenshots: screenshots.map((s) => ({
        id: randomUUID(),
        device: s.device,
        url: s.dataUri,
        width: s.width,
        height: s.height,
      })),
      // The "after" mockup is generated out-of-band by /api/mockup (see the
      // report page) so the slow image model never blocks this audit request.
      mockups: [],
      mockupSeed: heroShot
        ? { image: heroShot.base64, mimeType: heroShot.mimeType }
        : null,
      lighthouse: {
        performance: lighthouse.performance,
        accessibility: lighthouse.accessibility,
        bestPractices: lighthouse.bestPractices,
        seo: lighthouse.seo,
        metrics: lighthouse.metrics,
      },
    };

    // Cache successful, non-blocked audits only (blocked/degraded results are
    // cheap to recompute and may resolve on a retry). No-op unless enabled.
    if (!pageContext.blocked) {
      setCachedResult(cacheKey, response);
    }

    return NextResponse.json(response);
  } catch (err) {
    // Log the full error server-side; return a generic message so we never leak
    // internal implementation details (Puppeteer paths, API errors, etc.).
    logError("analyze.failed", err, { host, durationMs: Date.now() - startedAt });
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
