"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Loader2,
  Globe,
  Camera,
  Gauge,
  Brain,
  ListChecks,
  Sparkles,
} from "lucide-react";

import type { ReportResponse } from "@cro/shared";
import { apiUrl } from "@/lib/api";
import { safeHost, scoreColor } from "@/lib/utils";
import { groupCategoryScores } from "@/lib/report-ui";
import type { PendingScan } from "@/lib/pending-scan";

// Scripted stages mirror the real server pipeline timings so the animation
// feels honest even though /api/analyze returns everything in one response.
const STAGES = [
  { at: 0, icon: Globe, label: "Fetching your page" },
  { at: 5, icon: Camera, label: "Capturing full-page screenshot" },
  { at: 13, icon: Gauge, label: "Measuring performance (Lighthouse)" },
  { at: 24, icon: Brain, label: "Running the CRO analysis" },
  { at: 50, icon: ListChecks, label: "Prioritizing your fixes" },
] as const;

const AGENTS = [
  { at: 2, name: "UX Reviewer", role: "Scanning layout & hierarchy" },
  { at: 14, name: "Performance Engineer", role: "Auditing speed & Core Web Vitals" },
  { at: 26, name: "CRO Strategist", role: "Applying conversion frameworks" },
  { at: 40, name: "Data Analyst", role: "Estimating impact & effort" },
] as const;

// Even a cached result should show the experience briefly, not flash past.
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

  // Tick the elapsed clock while scanning.
  React.useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Kick off the real audit once.
  React.useEffect(() => {
    const controller = new AbortController();
    const timedOut = { current: false };
    const timeout = setTimeout(() => {
      timedOut.current = true;
      controller.abort();
    }, 130_000);

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
          // Only a real timeout should surface an error. An abort without the
          // timeout flag means the component unmounted (e.g. React StrictMode's
          // double-invoked effect in dev) — ignore it.
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

  // Once we have a result and the minimum display time has passed, reveal the
  // real score, then hand off to the report.
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
  const countdown = revealing ? 0 : Math.max(1, 60 - elapsed);
  const groups = result ? groupCategoryScores(result.report.categoryScores) : null;
  const overall = result?.report.overallScore ?? 0;

  return (
    <div className="grid min-h-screen lg:grid-cols-[360px_1fr]">
      {/* Sidebar */}
      <aside className="flex flex-col border-b bg-muted/30 p-6 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Globe className="h-4 w-4" />
          {host}
        </div>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          {revealing ? "Your report is ready" : "Scanning…"}
        </h1>

        {/* Gauge */}
        <div className="mt-6 flex items-center gap-4 rounded-2xl border bg-card p-4">
          <ScanGauge value={revealing ? overall : null} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Conversion score
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {revealing ? "Analysis complete" : "Calculating…"}
            </p>
          </div>
        </div>

        {/* Grouped category tiles */}
        <div className="mt-4 space-y-2.5">
          {(groups ??
            [
              { key: "clarity", label: "Clarity & Messaging" },
              { key: "design", label: "Design & Performance" },
              { key: "conversion", label: "Conversion & Growth" },
            ]).map((g) => {
            const real = groups && "score" in g ? g : null;
            return (
              <div
                key={g.key}
                className="flex items-center justify-between rounded-xl border bg-card px-3.5 py-2.5 text-sm"
              >
                <span className="font-medium">{g.label}</span>
                {revealing && real ? (
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: scoreColor(real.score) }}
                  >
                    {real.grade}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Calculating…</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Countdown */}
        <div className="mt-auto pt-6 text-sm text-muted-foreground">
          {revealing ? (
            <span className="inline-flex items-center gap-2 font-medium text-success">
              <Check className="h-4 w-4" /> Done — opening your report
            </span>
          ) : (
            <span className="tabular-nums">~{countdown} seconds remaining</span>
          )}
        </div>
      </aside>

      {/* Main stage */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden p-6">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

        {/* Browser mock */}
        <div className="relative z-10 w-full max-w-xl">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-primary/10">
            <div className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
              <span className="ml-3 truncate text-xs text-muted-foreground">
                {scan.url}
              </span>
            </div>
            <div className="relative h-64 p-5">
              <div className="space-y-3">
                <div className="h-6 w-2/3 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted/70" />
                <div className="h-3 w-5/6 rounded bg-muted/70" />
                <div className="mt-4 h-9 w-32 rounded-lg bg-primary/30" />
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="h-16 rounded-lg bg-muted/60" />
                  <div className="h-16 rounded-lg bg-muted/60" />
                  <div className="h-16 rounded-lg bg-muted/60" />
                </div>
              </div>
              {/* Scanning sweep */}
              {!revealing ? (
                <motion.div
                  className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-primary/20 to-transparent"
                  initial={{ top: "-10%" }}
                  animate={{ top: ["-10%", "100%"] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                />
              ) : null}
            </div>
          </div>

          {/* Stage list */}
          <div className="mt-6 space-y-2">
            {STAGES.map((stage, i) => {
              const complete = revealing || i < activeStageIndex;
              const active = !revealing && i === activeStageIndex;
              return (
                <div
                  key={stage.label}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                    active ? "border-primary/40 bg-primary/5" : "bg-card"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${
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
                  <span className={complete || active ? "font-medium" : "text-muted-foreground"}>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI agents ticker */}
        <div className="relative z-10 mt-6 h-10">
          <AnimatePresence mode="popLayout">
            {(() => {
              const shown = revealing
                ? AGENTS[AGENTS.length - 1]
                : [...AGENTS].reverse().find((a) => elapsed >= a.at) ?? AGENTS[0];
              return (
                <motion.div
                  key={shown.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="inline-flex items-center gap-2.5 rounded-full border bg-card px-4 py-2 text-sm shadow-sm"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-medium">{shown.name}</span>
                  <span className="text-muted-foreground">· {shown.role}</span>
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ScanGauge({ value }: { value: number | null }) {
  const size = 72;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value ?? 0;
  const color = value == null ? "hsl(var(--primary))" : scoreColor(value);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        {value == null ? (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * 0.25} ${c}`}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "center" }}
          />
        ) : (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - (pct / 100) * c }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {value == null ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <span className="text-lg font-semibold tabular-nums" style={{ color }}>
            {value}
          </span>
        )}
      </div>
    </div>
  );
}
