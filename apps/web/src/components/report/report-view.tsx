"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Globe, Calendar, Gauge, TrendingUp, AlertTriangle } from "lucide-react";

import type { ReportResponse } from "@cro/shared";
import { SEVERITY_META, PRIORITY_META, BOOKING_ANCHOR_ID } from "@/lib/report-ui";
import { formatDate, safeHost } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "./score-gauge";
import { ScoreRadar } from "./score-radar";
import { CategoryBars } from "./category-bars";
import { AnnotatedScreenshots } from "./annotated-screenshots";
import { PriorityMatrix } from "./priority-matrix";
import { LighthousePanel } from "./lighthouse-panel";
import { IssuesExplorer } from "./issues-explorer";
import { RecommendationCards } from "./recommendation-cards";
import { AgencyCta } from "./agency-cta";
import { ReportHeader } from "./report-header";
import { ConversionImpactPanel } from "./conversion-impact-panel";
import { FloatingContact } from "@/components/contact/floating-contact";
import type { ContactContext } from "@/components/contact/types";

export function ReportView({
  data,
  readOnly = false,
  mockupPending = false,
  mockupError = false,
}: {
  data: ReportResponse;
  readOnly?: boolean;
  mockupPending?: boolean;
  mockupError?: boolean;
}) {
  const { scan, report, issues, recommendations, screenshots, lighthouse } = data;
  // `mockups` was added later; default so older/shared payloads still render.
  const mockups = data.mockups ?? [];
  const host = safeHost(scan.url);

  const contactContext: ContactContext = {
    websiteUrl: scan.url,
    score: report.overallScore,
    scanId: scan.id,
    source: readOnly ? "shared-report" : "report",
  };

  const topOpportunities = [...issues]
    .sort((a, b) => SEVERITY_META[a.severity].order - SEVERITY_META[b.severity].order)
    .slice(0, 4);

  // A slimmed (quota-degraded) payload keeps screenshot rows but blanks their
  // data URIs — only treat the tab as available when we actually have an image.
  const hasScreenshots = screenshots.some((s) => s.url);

  return (
    <div className="min-h-screen pb-24">
      {readOnly ? (
        <ReadOnlyHeader host={host} />
      ) : (
        <ReportHeader data={data} />
      )}

      <main id="main-content" tabIndex={-1} className="container mt-10">
        <div className="space-y-10">
        {/* Summary hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid gap-6 lg:grid-cols-[auto_1fr]"
        >
          <Card className="flex flex-col items-center justify-center p-8">
            <ScoreGauge score={report.overallScore} />
            <Badge className={`mt-4 ${PRIORITY_META[report.priority].className}`}>
              {PRIORITY_META[report.priority].label}
            </Badge>
          </Card>

          <Card className="p-8">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-4 w-4" />
                {host}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDate(scan.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="h-4 w-4" />
                Confidence {report.confidence}%
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-success">
                <TrendingUp className="h-4 w-4" />
                Est. {report.estimatedImpact}
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              Executive summary
            </h1>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {report.summary}
            </p>
            {report.primaryBottleneck && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                    Primary bottleneck
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                    {report.primaryBottleneck}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Evidence-based conversion snapshot — real audit counts + measured
            page speed framed against Google's published research. */}
        <ConversionImpactPanel issues={issues} lighthouse={lighthouse} />

        {/* Detailed tabs — screenshots first when available, else categories */}
        <Tabs
          defaultValue={hasScreenshots ? "screenshots" : "categories"}
          className="w-full"
        >
          <div className="overflow-x-auto pb-1">
            <TabsList>
              {hasScreenshots && (
                <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
              )}
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="issues">Issues ({issues.length})</TabsTrigger>
              <TabsTrigger value="plan">Action plan</TabsTrigger>
            </TabsList>
          </div>

          {hasScreenshots && (
            <TabsContent value="screenshots">
              <Card>
                <CardHeader>
                  <CardTitle>Annotated screenshots</CardTitle>
                </CardHeader>
                <CardContent>
                  <AnnotatedScreenshots
                    screenshots={screenshots}
                    issues={issues}
                    mockups={mockups}
                    mockupPending={mockupPending}
                    mockupError={mockupError}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>Category breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBars scores={report.categoryScores} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle>Lighthouse performance</CardTitle>
              </CardHeader>
              <CardContent>
                {lighthouse ? (
                  <LighthousePanel lighthouse={lighthouse} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Lighthouse data unavailable for this scan.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="issues">
            <IssuesExplorer issues={issues} />
          </TabsContent>

          <TabsContent value="plan">
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Priority matrix</CardTitle>
                </CardHeader>
                <CardContent>
                  <PriorityMatrix recommendations={recommendations} />
                </CardContent>
              </Card>
              <div>
                <h3 className="mb-4 text-lg font-semibold">
                  Prioritized recommendations
                </h3>
                <RecommendationCards recommendations={recommendations} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Radar + top opportunities */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Category scores</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreRadar scores={report.categoryScores} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top opportunities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topOpportunities.map((issue) => {
                const meta = SEVERITY_META[issue.severity];
                return (
                  <div
                    key={issue.id}
                    className="flex items-start gap-3 rounded-xl border p-3.5"
                  >
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{issue.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {issue.category}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-success">
                      {issue.estimatedConversionImpact}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          </div>
        </div>

        <div id={BOOKING_ANCHOR_ID} className="mt-12 scroll-mt-24">
          <AgencyCta context={contactContext} />
        </div>
      </main>

      {/* Sticky lead-gen CTA — mirrors the homepage so visitors can reach our
          CRO team from anywhere in the report. */}
      <FloatingContact context={contactContext} />
    </div>
  );
}

function ReadOnlyHeader({ host }: { host: string }) {
  return (
    <header className="border-b bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Shared CRO report · {host}
        </div>
      </div>
    </header>
  );
}
