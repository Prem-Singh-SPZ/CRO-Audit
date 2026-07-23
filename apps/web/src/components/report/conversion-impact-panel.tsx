"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Gauge, ExternalLink, Zap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { config } from "@/lib/config";
import { SEVERITY_META } from "@/lib/report-ui";
import type { IssueDto, LighthouseDto } from "@/lib/types";
import type { SeverityLevel } from "@/lib/cro";

// Order severities from most to least urgent for the breakdown row.
const SEVERITY_ORDER: SeverityLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

// Official Google Core Web Vitals thresholds for Largest Contentful Paint.
// https://web.dev/articles/lcp — Good ≤ 2.5s, Poor > 4.0s.
const LCP_GOOD_MS = 2500;
const LCP_POOR_MS = 4000;

function lcpVerdict(lcpMs: number): {
  label: string;
  tone: "good" | "warn" | "bad";
} {
  if (lcpMs <= LCP_GOOD_MS) return { label: "Good", tone: "good" };
  if (lcpMs <= LCP_POOR_MS) return { label: "Needs improvement", tone: "warn" };
  return { label: "Poor", tone: "bad" };
}

const TONE_CLASSES: Record<"good" | "warn" | "bad", string> = {
  good: "border-success/30 bg-success/10 text-success",
  warn: "border-warning/30 bg-warning/10 text-warning",
  bad: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function ConversionImpactPanel({
  issues,
  lighthouse,
}: {
  issues: IssueDto[];
  lighthouse: LighthouseDto | null;
}) {
  const counts = React.useMemo(() => {
    const acc: Record<SeverityLevel, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
    };
    for (const i of issues) acc[i.severity] += 1;
    return acc;
  }, [issues]);

  const total = issues.length;
  const highImpact = counts.CRITICAL + counts.HIGH;
  const present = SEVERITY_ORDER.filter((s) => counts[s] > 0);

  const lcpMs = lighthouse?.metrics?.lcp;
  const hasLcp = typeof lcpMs === "number" && Number.isFinite(lcpMs);
  const verdict = hasLcp ? lcpVerdict(lcpMs!) : null;

  return (
    <Card className="relative overflow-hidden border-amber-500/30 p-6">
      <div className="pointer-events-none absolute -left-16 -top-16 -z-10 h-44 w-44 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h3 className="text-lg font-semibold tracking-tight">
          What we found on your page
        </h3>
      </div>

      {/* Severity-weighted issue summary — driven by the real audit output. */}
      <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="text-4xl font-bold tabular-nums leading-none">
          {total}
        </span>
        <p className="text-sm leading-relaxed text-muted-foreground">
          conversion {total === 1 ? "leak" : "leaks"} identified
          {highImpact > 0 && (
            <>
              {" "}
              —{" "}
              <span className="font-semibold text-destructive">
                {highImpact} high-impact
              </span>{" "}
              {highImpact === 1 ? "issue needs" : "issues need"} attention first
            </>
          )}
          .
        </p>
      </div>

      {present.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {present.map((s) => {
            const meta = SEVERITY_META[s];
            return (
              <span
                key={s}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  meta.badge
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                {counts[s]} {meta.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Measured page speed vs. Google's published research — no guesswork. */}
      {hasLcp && verdict && (
        <div className="mt-6 rounded-2xl border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Gauge className="h-4 w-4" />
              Largest Contentful Paint (measured)
            </div>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                TONE_CLASSES[verdict.tone]
              )}
            >
              {verdict.label}
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {(lcpMs! / 1000).toFixed(1)}
            <span className="text-base font-medium text-muted-foreground">
              {" "}
              s to load main content
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Google Core Web Vitals rates LCP as Good at ≤ 2.5s and Poor above
            4.0s.
          </p>

          <div className="mt-4 space-y-2 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
            <ResearchStat
              stat="+8.4% retail conversions"
              detail="from a 0.1-second improvement in mobile load time"
              source="Deloitte & Google, “Milliseconds Make Millions,” 2020"
              href="https://www.thinkwithgoogle.com/consumer-insights/consumer-trends/mobile-site-load-time-statistics/"
            />
            <ResearchStat
              stat="53% of mobile visits abandoned"
              detail="when a page takes longer than 3 seconds to load"
              source="Google / Think with Google, 2017"
              href="https://www.thinkwithgoogle.com/marketing-strategies/app-and-mobile/mobile-page-speed-new-industry-benchmarks/"
            />
          </div>
        </div>
      )}

      <Button
        asChild
        size="lg"
        className={cn(
          "mt-5 w-full bg-amber-500 text-white shadow-lg shadow-amber-500/25",
          "hover:bg-amber-600 hover:shadow-amber-500/40"
        )}
      >
        <Link href={config.bookCallUrl} target="_blank" rel="noopener noreferrer">
          <Zap className="h-4 w-4" />
          {highImpact > 0
            ? "Fix these high-impact leaks"
            : "Get help fixing these"}
        </Link>
      </Button>
    </Card>
  );
}

function ResearchStat({
  stat,
  detail,
  source,
  href,
}: {
  stat: string;
  detail: string;
  source: string;
  href: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span>
        <span className="font-semibold text-foreground">{stat}</span> {detail}.{" "}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline"
        >
          {source}
          <ExternalLink className="h-3 w-3" />
        </a>
      </span>
    </div>
  );
}
