import { Hono } from "hono";
import { randomUUID } from "node:crypto";

import {
  scanRequestSchema,
  safeHost,
  groundedLiftLabel,
  type ReportResponse,
} from "@cro/shared";
import { analyzePage, analyzeRenderedHtml } from "../lib/analyzer";
import { getPageSpeed, fallbackLighthouse } from "../lib/pagespeed";
import { captureScreenshots } from "../lib/screenshot";
import { applyCaptureOutcome } from "../lib/capture-quality";
import { generateReport } from "../lib/ai";
import { buildCompetitorCompare } from "../lib/compare-dimensions";
import { assertSafeExternalUrl, UnsafeUrlError } from "../lib/net-guard";
import { getClientIp, rateLimit, RATE_LIMITS } from "../lib/rate-limit";
import { logEvent, logError } from "../lib/logger";
import {
  getCachedResult,
  setCachedResult,
  resultCacheKey,
} from "../lib/result-cache";

const analyze = new Hono();

// Deduplicate overlapping POSTs for the same URL+context (React StrictMode
// remounts, double-clicks). The first job runs; later callers await it.
const inflight = new Map<string, Promise<ReportResponse>>();

analyze.post("/", async (c) => {
  const { limit, windowMs } = RATE_LIMITS.analyze;
  const rl = rateLimit(`analyze:${getClientIp(c.req.raw)}`, limit, windowMs);
  if (!rl.success) {
    c.header(
      "Retry-After",
      String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)))
    );
    return c.json(
      { error: "Too many audits. Please wait a moment and try again." },
      429
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const parsed = scanRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Please enter a valid website URL";
    return c.json({ error: message }, 400);
  }

  const url = parsed.data.url;
  const auditContext = {
    targetAudience: parsed.data.targetAudience,
    coreProduct: parsed.data.coreProduct,
    primaryTrafficSource: parsed.data.primaryTrafficSource,
    competitorUrl: parsed.data.competitorUrl,
  };
  const competitorUrl = parsed.data.competitorUrl
    ? /^https?:\/\//i.test(parsed.data.competitorUrl)
      ? parsed.data.competitorUrl
      : `https://${parsed.data.competitorUrl}`
    : undefined;

  try {
    await assertSafeExternalUrl(url);
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return c.json({ error: err.message }, 400);
    }
    return c.json({ error: "Please enter a valid website URL." }, 400);
  }

  const startedAt = Date.now();
  const host = safeHost(url);

  const cacheKey = resultCacheKey(
    url,
    (process.env.AI_PROVIDER || "mock").toLowerCase(),
    auditContext
  );
  const cached = getCachedResult(cacheKey);
  if (cached) {
    logEvent("analyze.cache_hit", { host });
    return c.json(cached);
  }

  const existing = inflight.get(cacheKey);
  if (existing) {
    logEvent("analyze.coalesce", { host });
    try {
      return c.json(await existing);
    } catch {
      return c.json({ error: "Analysis failed. Please try again." }, 500);
    }
  }

  let resolveJob!: (value: ReportResponse) => void;
  let rejectJob!: (reason: unknown) => void;
  const job = new Promise<ReportResponse>((resolve, reject) => {
    resolveJob = resolve;
    rejectJob = reject;
  });
  inflight.set(cacheKey, job);

  logEvent("analyze.start", { host });

  try {
    let competitorSafe = false;
    if (competitorUrl) {
      try {
        await assertSafeExternalUrl(competitorUrl);
        competitorSafe = safeHost(competitorUrl) !== host;
      } catch {
        // Invalid competitor URL should not fail the primary audit.
      }
    }

    const [crawlContext, pageSpeed, screenshotResult, competitorContext] =
      await Promise.all([
        analyzePage(url),
        getPageSpeed(url),
        captureScreenshots(url),
        competitorSafe && competitorUrl
          ? analyzePage(competitorUrl).catch(() => null)
          : Promise.resolve(null),
      ]);
    let pageContext = crawlContext;
    const screenshots = screenshotResult.screenshots;
    const heroShot = screenshotResult.heroShot;

    const renderedRich =
      !!screenshotResult.rendered &&
      (screenshotResult.rendered.textLength > 400 ||
        screenshotResult.rendered.h1Count > 0);

    if (
      pageContext.blocked &&
      !screenshotResult.blockedReason &&
      renderedRich &&
      screenshotResult.renderedHtml
    ) {
      const recovered = analyzeRenderedHtml(
        screenshotResult.renderedHtml,
        url,
        pageContext.finalUrl || url,
        pageContext.loadTimeMs
      );
      if (!recovered.blocked) {
        logEvent("analyze.recovered_from_block", {
          host,
          fetchBlockReason: pageContext.blockReason,
        });
        pageContext = recovered;
      }
    }

    pageContext = applyCaptureOutcome(pageContext, screenshotResult);

    const crawlThin =
      pageContext.wordCount < 60 || pageContext.headings.h1.length === 0;
    if (!pageContext.blocked && crawlThin && renderedRich) {
      pageContext.clientRendered = true;
    }

    const lighthouse = pageSpeed.lighthouse ?? fallbackLighthouse(pageContext);
    const { report, provider, fallbackReason } = await generateReport({
      pageContext,
      lighthouse,
      screenshots,
      bands: screenshotResult.bands,
      auditContext,
      landmarks: screenshotResult.landmarks,
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
      incompleteCapture: !!pageContext.incompleteCapture,
      liveTest: pageContext.liveTest?.vendor ?? null,
      screenshotSource: screenshotResult.screenshotSource,
      archiveCapturedAt: screenshotResult.archiveCapturedAt,
      issues: report.issues.length,
      hasScreenshot: screenshots.length > 0,
      bands: screenshotResult.bands.length,
      landmarks: screenshotResult.landmarks.length,
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
      blocked: pageContext.blocked,
      blockReason: pageContext.blocked ? pageContext.blockReason : null,
      incompleteCapture: pageContext.incompleteCapture,
      captureNote: pageContext.incompleteCapture
        ? pageContext.captureNote ?? null
        : null,
      liveTest: pageContext.liveTest ?? null,
      screenshotSource: screenshotResult.screenshotSource,
      archiveCapturedAt: screenshotResult.archiveCapturedAt,
      report: {
        id: randomUUID(),
        overallScore: report.overallScore,
        primaryBottleneck: report.primaryBottleneck ?? "",
        categoryScores: report.categoryScores,
        summary: report.summary,
        strengths: report.strengths,
        weaknesses: report.weaknesses,
        priority: pageContext.liveTest ? "low" : report.priority,
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
        severity: pageContext.liveTest ? "INFO" : i.severity,
        confidence: i.confidence,
        businessImpact: i.businessImpact,
        suggestedFix: i.suggestedFix,
        estimatedConversionImpact: groundedLiftLabel(
          i.category,
          i.estimatedConversionImpact
        ),
        complexity: i.complexity ?? null,
        riskOfDiy: i.riskOfDiy ?? null,
        device: i.annotation?.device ?? null,
        annotationX: i.annotation?.x ?? null,
        annotationY: i.annotation?.y ?? null,
        annotationW: i.annotation?.width ?? null,
        annotationH: i.annotation?.height ?? null,
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
      competitorCompare:
        competitorContext && !competitorContext.blocked
          ? buildCompetitorCompare(pageContext, competitorContext)
          : null,
    };

    if (!pageContext.blocked) {
      setCachedResult(cacheKey, response);
    }

    resolveJob(response);
    return c.json(response);
  } catch (err) {
    rejectJob(err);
    logError("analyze.failed", err, {
      host,
      durationMs: Date.now() - startedAt,
    });
    return c.json({ error: "Analysis failed. Please try again." }, 500);
  } finally {
    inflight.delete(cacheKey);
  }
});

export default analyze;
