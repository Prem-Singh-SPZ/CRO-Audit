import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { scanRequestSchema } from "@/lib/cro";
import { analyzePage } from "@/lib/analyzer";
import { getPageSpeed, fallbackLighthouse } from "@/lib/pagespeed";
import { captureScreenshots } from "@/lib/screenshot";
import { generateReport } from "@/lib/ai";
import type { ReportResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// PageSpeed (15-45s) runs before a vision-LLM call (Opus can take 60-90s), so
// allow generous headroom. On Vercel this needs a plan whose function limit is
// >= this value (Pro/Enterprise); Hobby caps at 10s.
export const maxDuration = 120;

export async function POST(request: Request) {
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

  try {
    // Crawl (cheerio), PageSpeed metrics, and screenshots run in parallel.
    const [pageContext, pageSpeed, screenshotResult] = await Promise.all([
      analyzePage(url),
      getPageSpeed(url),
      captureScreenshots(url),
    ]);
    const screenshots = screenshotResult.screenshots;
    const heroShot = screenshotResult.heroShot;

    const lighthouse = pageSpeed.lighthouse ?? fallbackLighthouse(pageContext);
    const { report, provider } = await generateReport({
      pageContext,
      lighthouse,
      screenshots,
      auditContext,
    });

    const now = new Date().toISOString();
    const scanId = randomUUID();

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
        estimatedConversionImpact: i.estimatedConversionImpact,
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

    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Analysis failed. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
