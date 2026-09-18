"use client";

import * as React from "react";
import {
  Check,
  Loader2,
  Globe,
  Camera,
  Gauge,
  Brain,
  ListChecks,
} from "lucide-react";

import type { ReportResponse } from "@cro/shared";
import { apiUrl } from "@/lib/api";
import { safeHost, scoreColor, scoreLabel } from "@/lib/utils";
import type { PendingScan } from "@/lib/pending-scan";
import { DidYouKnow } from "./did-you-know";

// Scripted stages mirror the real server pipeline timings so the animation
// feels honest even though /api/analyze returns everything in one response.
const STAGES = [
  { at: 0, icon: Globe, label: "Fetching your page" },
  { at: 8, icon: Camera, label: "Capturing screenshot" },
  { at: 28, icon: Gauge, label: "Measuring speed" },
  { at: 42, icon: Brain, label: "Running CRO analysis" },
  { at: 75, icon: ListChecks, label: "Prioritizing fixes" },
] as const;

const MIN_SCAN_MS = 3800;

export function ScanExperience({
  scan,
  onComplete,
  onError,
}: {
  scan: PendingScan;
  onComplete: (data: ReportResponse) => void;
  onError: (message: string) => void;
}) {
  const [elapsed, setElapsed] = React.useState(0);
  const [result, setResult] = React.useState<ReportResponse | null>(null);
  const [revealing, setRevealing] = React.useState(false);
  const startedAt = React.useRef(Date.now());
  const host = safeHost(scan.url);

  React.useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    const timedOut = { current: false };
    const timeout = setTimeout(() => {
      timedOut.current = true;
      controller.abort();
    }, 200_000);

    (async () => {
      try {
        const res = await fetch(apiUrl("/api/analyze"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            url: scan.url,
            targetAudience: scan.targetAudience,
            coreProduct: scan.coreProduct,
            primaryTrafficSource: scan.primaryTrafficSource,
            competitorUrl: scan.competitorUrl,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error ?? "Something went wrong. Please try again.");
        }
        if (!data) throw new Error("Unexpected response. Please try again.");
        setResult(data as ReportResponse);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          if (timedOut.current) {
            onError("The audit timed out. Please try again.");
          }
        } else {
          onError(err instanceof Error ? err.message : "Something went wrong.");
        }
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!result) return;
    const remaining = Math.max(0, MIN_SCAN_MS - (Date.now() - startedAt.current));
    const revealTimer = setTimeout(() => setRevealing(true), remaining);
    return () => clearTimeout(revealTimer);
  }, [result]);

  React.useEffect(() => {
    if (!revealing || !result) return;
    const done = setTimeout(() => onComplete(result), 1600);
    return () => clearTimeout(done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealing, result]);

  const activeStageIndex = STAGES.reduce(
    (acc, s, i) => (elapsed >= s.at ? i : acc),
    0
  );
  const countdown = revealing ? 0 : Math.max(0, 90 - elapsed);
  const overall = result?.report.overallScore ?? 0;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_4fr]">
      <section className="flex flex-col justify-center border-b bg-background px-5 py-8 lg:border-b-0 lg:border-r lg:px-6 lg:py-10">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground">
            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{host}</span>
          </span>
          {revealing ? (
            <span className="inline-flex items-center gap-1 font-medium text-success">
              <Check className="h-3.5 w-3.5" />
              Opening
            </span>
          ) : (
            <span className="tabular-nums">
              {countdown > 0 ? `~${countdown}s` : "Still going…"}
            </span>
          )}
        </div>

        <h1 className="mt-4 text-lg font-semibold tracking-tight lg:text-xl">
          {revealing ? "Your report is ready" : "Reading the page"}
        </h1>

        {revealing ? (
          <p
            className="mt-3 text-4xl font-semibold tabular-nums tracking-tight"
            style={{ color: scoreColor(overall) }}
            aria-label={`CRO score: ${overall} out of 100 — ${scoreLabel(overall)}`}
          >
            {overall}
            <span className="ml-1 text-base font-medium text-muted-foreground">
              /100
            </span>
          </p>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Fetch, screenshot, Lighthouse, then the audit.
          </p>
        )}

        <ol className="mt-6 space-y-1">
          {STAGES.map((stage, i) => {
            const complete = revealing || i < activeStageIndex;
            const active = !revealing && i === activeStageIndex;
            return (
              <li
                key={stage.label}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${
                  active ? "bg-muted/60" : ""
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    complete
                      ? "bg-success/15 text-success"
                      : active
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {complete ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <stage.icon className="h-3.5 w-3.5" />
                  )}
                </span>
                <span
                  className={
                    complete || active ? "font-medium" : "text-muted-foreground"
                  }
                >
                  {stage.label}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <DidYouKnow paused={revealing} />
    </div>
  );
}
