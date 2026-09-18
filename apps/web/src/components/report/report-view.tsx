"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Globe,
  Calendar,
  Gauge,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  ScanSearch,
  AlignLeft,
} from "lucide-react";
import Link from "next/link";

import type { IssueDto, ReportResponse } from "@cro/shared";
import {
  SEVERITY_META,
  PRIORITY_META,
  BOOKING_ANCHOR_ID,
  firstSentence,
  liftEvidence,
} from "@/lib/report-ui";
import { formatDate, safeHost, scoreColor, scoreLabel } from "@/lib/utils";
import { config } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryBars } from "./category-bars";
import { AnnotatedScreenshots } from "./annotated-screenshots";
import { PriorityMatrix } from "./priority-matrix";
import { LighthousePanel } from "./lighthouse-panel";
import { IssuesExplorer } from "./issues-explorer";
import { RecommendationCards } from "./recommendation-cards";
import { ExperimentCards } from "./experiment-cards";
import { AgencyCta } from "./agency-cta";
import { ReportHeader } from "./report-header";
import { ConversionImpactPanel } from "./conversion-impact-panel";
import { CompetitorCompare } from "./competitor-compare";
import { ReportGateProvider, Locked } from "./report-gate";
import { EmailReportButton } from "./email-report-button";
import { Reveal } from "@/components/reveal";
import { FloatingContact } from "@/components/contact/floating-contact";
import type { ContactContext } from "@/components/contact/types";

export function ReportView({
  data,
  readOnly = false,
  mockupPending = false,
}: {
  data: ReportResponse;
  readOnly?: boolean;
  mockupPending?: boolean;
}) {
  const { scan, report, issues, recommendations, screenshots, lighthouse } = data;
  const mockups = data.mockups ?? [];
  const host = safeHost(scan.url);

  const contactContext: ContactContext = {
    websiteUrl: scan.url,
    score: report.overallScore,
    scanId: scan.id,
    source: readOnly ? "shared-report" : "report",
  };

  const topFixes = [...issues]
    .sort((a, b) => SEVERITY_META[a.severity].order - SEVERITY_META[b.severity].order)
    .slice(0, 3);

  const hasScreenshots = screenshots.some((s) => s.url);
  const isLiveTest = Boolean(data.liveTest);
  const hideCritique =
    isLiveTest || Boolean(data.incompleteCapture);

  const primaryDevice = "desktop" as const;

  const [tab, setTab] = React.useState("findings");
  const [selectedIssueId, setSelectedIssueId] = React.useState<string | null>(
    null
  );

  return (
    <ReportGateProvider
      issueCount={issues.length}
      readOnly={readOnly}
      host={host}
      url={scan.url}
      score={report.overallScore}
      device={primaryDevice}
      primaryBottleneck={report.primaryBottleneck}
      topIssueTitle={topFixes[0]?.title}
    >
    <div className="min-h-screen pb-24">
      {readOnly ? (
        <ReadOnlyHeader host={host} />
      ) : (
        <ReportHeader data={data} />
      )}

      <main id="main-content" tabIndex={-1} className="container mt-10">
        <div className="space-y-10">
        {data.screenshotSource === "archive" ? (
          <Card className="border-warning/40 bg-warning/10 p-5">
            <p className="text-sm font-semibold">
              This picture is from the Internet Archive
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              We could not use the live page, so this control shot is an
              archived snapshot
              {data.archiveCapturedAt
                ? ` from ${data.archiveCapturedAt}`
                : ""}{" "}
              — not what visitors see today.
            </p>
          </Card>
        ) : null}
        {data.blocked ? (
          <Card className="border-warning/40 bg-warning/10 p-5">
            <p className="text-sm font-semibold">We could not read the real page</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This site served a bot check, captcha, or firewall instead of the
              page visitors see. We do not bypass those shields, so this is not
              a full conversion audit.
            </p>
            {data.blockReason ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Detected: {data.blockReason}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button asChild size="sm" variant="gradient">
                <Link
                  href={config.bookCallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fix My Page
                </Link>
              </Button>
              {!readOnly ? (
                <Button asChild size="sm" variant="outline">
                  <Link href="/#analyze">Try again</Link>
                </Button>
              ) : null}
            </div>
          </Card>
        ) : isLiveTest ? (
            <Card className="border-primary/30 bg-primary/5 p-5">
              <p className="text-sm font-semibold">
                A live test is running on this page
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                We can&apos;t audit this variant as your control. Drop the
                original control URL so we can audit the page properly.
              </p>
              {!readOnly ? (
                <div className="mt-4">
                  <Button asChild size="sm" variant="gradient">
                    <Link href="/#analyze">Analyze the control URL</Link>
                  </Button>
                </div>
              ) : null}
            </Card>
          ) : data.incompleteCapture ? (
              <Card className="border-warning/40 bg-warning/10 p-5">
                <p className="text-sm font-semibold">
                  We could not capture a usable control
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.captureNote ??
                    "Part of the page had not loaded when we captured it. This is not a conversion audit."}
                </p>
                {!readOnly ? (
                  <div className="mt-4">
                    <Button asChild size="sm" variant="gradient">
                      <Link href="/#analyze">Try again</Link>
                    </Button>
                  </div>
                ) : null}
              </Card>
          ) : !hasScreenshots ? (
              <Card className="border-border p-5">
                <p className="text-sm font-semibold">
                  Screenshot preview not available
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.captureNote ??
                    "We could not capture a usable picture of the page."}
                </p>
              </Card>
          ) : null}
        {hideCritique ? (
          hasScreenshots ? (
            <Card>
              <CardHeader>
                <CardTitle>Your page</CardTitle>
              </CardHeader>
              <CardContent>
                <AnnotatedScreenshots
                  screenshots={screenshots}
                  issues={issues}
                  mockups={mockups}
                  mockupPending={false}
                  forceView="issues"
                  skipRedesign
                />
              </CardContent>
            </Card>
          ) : null
        ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <p
                  className="text-5xl font-semibold leading-none tabular-nums tracking-tight sm:text-6xl"
                  style={{ color: scoreColor(report.overallScore) }}
                  aria-label={`CRO score: ${report.overallScore} out of 100 — ${scoreLabel(report.overallScore)}`}
                >
                  {report.overallScore}
                  <span className="ml-1 text-lg font-medium text-muted-foreground">
                    /100
                  </span>
                </p>
                <div className="mb-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    {scoreLabel(report.overallScore)}
                  </span>
                  <Badge className={PRIORITY_META[report.priority].className}>
                    {PRIORITY_META[report.priority].label}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
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
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              What is killing conversions
            </h1>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {firstSentence(report.summary)}
            </p>
            {report.primaryBottleneck ? (
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
            ) : null}

            {topFixes.length > 0 ? (
              <ol className="mt-5 space-y-3">
                {topFixes.map((issue, i) => (
                  <TeaserFix key={issue.id} index={i + 1} issue={issue} />
                ))}
              </ol>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-5">
              <Button asChild size="sm" variant="gradient">
                <Link
                  href={config.bookCallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Sparkles className="h-4 w-4" />
                  Fix My Page
                </Link>
              </Button>
              {!readOnly ? <EmailReportButton data={data} /> : null}
            </div>
          </Card>
        </motion.div>
        )}

        {hideCritique ? null : data.competitorCompare ? (
          <Reveal>
            <CompetitorCompare compare={data.competitorCompare} />
          </Reveal>
        ) : null}

        {hideCritique ? null : (
        <Locked
          title={`Unlock all ${issues.length} issues, the redesign, and the action plan`}
          description="Verify your email to see every finding, the before/after concept, and prioritized experiments. It's free."
        >
          <div className="space-y-10">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 rounded-2xl border-2 bg-muted/60 p-1.5">
              <TabsTrigger
                value="findings"
                className="h-12 w-full gap-2 rounded-xl text-sm font-semibold sm:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
              >
                <ScanSearch className="h-4 w-4" />
                Visual
              </TabsTrigger>
              <TabsTrigger
                value="more"
                className="h-12 w-full gap-2 rounded-xl text-sm font-semibold sm:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
              >
                <AlignLeft className="h-4 w-4" />
                Details
              </TabsTrigger>
            </TabsList>

            <TabsContent value="findings">
              <div className="space-y-8">
                {hasScreenshots ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Your page</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <AnnotatedScreenshots
                        screenshots={screenshots}
                        issues={issues}
                        mockups={mockups}
                        mockupPending={mockupPending}
                        selectedIssueId={selectedIssueId}
                        onSelectIssue={setSelectedIssueId}
                        forceView="issues"
                        skipRedesign={Boolean(data.liveTest)}
                      />
                    </CardContent>
                  </Card>
                ) : null}
                <Card>
                  <CardContent className="pt-6">
                    <ExperimentCards
                      issues={issues}
                      screenshots={screenshots}
                      mockups={mockups}
                      mockupPending={mockupPending}
                      skipRedesign={Boolean(data.liveTest)}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="more">
              <div className="space-y-8">
                <IssuesExplorer
                  issues={issues}
                  selectedIssueId={selectedIssueId}
                  onSelectIssue={setSelectedIssueId}
                  pageUrl={scan.url}
                />
                <ConversionImpactPanel issues={issues} lighthouse={lighthouse} />
                <Card>
                  <CardHeader>
                    <CardTitle>Category breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CategoryBars scores={report.categoryScores} />
                  </CardContent>
                </Card>
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
          </div>
        </Locked>
        )}
        </div>

        <div id={BOOKING_ANCHOR_ID} className="mt-12 scroll-mt-24">
          <AgencyCta context={contactContext} />
        </div>
      </main>

      <FloatingContact context={contactContext} />
    </div>
    </ReportGateProvider>
  );
}

function TeaserFix({ index, issue }: { index: number; issue: IssueDto }) {
  const evidence = liftEvidence(issue.category);
  return (
    <li className="flex items-start gap-3 rounded-xl border p-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{issue.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {issue.psychology || issue.whyItMatters || issue.description}
        </p>
        {evidence ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{evidence}</p>
        ) : null}
      </div>
      {issue.estimatedConversionImpact &&
      issue.estimatedConversionImpact !== "n/a" ? (
        <span className="shrink-0 text-xs font-semibold text-success">
          {issue.estimatedConversionImpact}
        </span>
      ) : null}
    </li>
  );
}

function ReadOnlyHeader({ host }: { host: string }) {
  return (
    <header className="border-b bg-background/80 backdrop-blur-xl print:hidden">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">Shared CRO report · {host}</span>
        </div>
      </div>
    </header>
  );
}
