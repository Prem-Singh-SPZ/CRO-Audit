"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Search,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { storeReport } from "@/lib/report-store";
import type { ReportResponse } from "@/lib/types";

// Approximate pipeline stages, keyed by elapsed seconds. Timings mirror the
// server pipeline (crawl + PageSpeed + screenshot in parallel, then the vision
// LLM), giving honest-feeling feedback without a streaming backend.
const ANALYZE_STAGES = [
  { at: 0, label: "Fetching your page…" },
  { at: 4, label: "Capturing a full-page screenshot…" },
  { at: 12, label: "Measuring performance (Lighthouse)…" },
  { at: 22, label: "Running the AI CRO analysis…" },
  { at: 55, label: "Compiling your prioritized report…" },
] as const;

export function UrlAnalyzerForm({ className }: { className?: string }) {
  const router = useRouter();
  const [url, setUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [targetAudience, setTargetAudience] = React.useState("");
  const [coreProduct, setCoreProduct] = React.useState("");
  const [primaryTrafficSource, setPrimaryTrafficSource] = React.useState("");
  const [elapsed, setElapsed] = React.useState(0);

  // Drive a lightweight staged-progress display while the (long) audit runs so
  // the user gets real feedback instead of a bare spinner.
  React.useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [loading]);

  const stage = ANALYZE_STAGES.reduce(
    (acc, s) => (elapsed >= s.at ? s : acc),
    ANALYZE_STAGES[0]
  );
  // Approach but never reach 100% until the response actually arrives.
  const progressPct = Math.min(95, Math.round((elapsed / 90) * 100));

  async function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Please enter a website URL");
      return;
    }
    setLoading(true);
    setError(null);

    // The audit can run up to ~120s server-side; guard the client so a hung
    // request never leaves the form stuck disabled forever.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 130_000);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          url: trimmed,
          targetAudience: targetAudience.trim() || undefined,
          coreProduct: coreProduct.trim() || undefined,
          primaryTrafficSource: primaryTrafficSource.trim() || undefined,
        }),
      });

      // Parse defensively — a proxy/error page may not return JSON.
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.error ?? "Something went wrong. Please try again."
        );
      }
      if (!data) {
        throw new Error("Unexpected response from the server. Please try again.");
      }

      const stored = storeReport(data as ReportResponse);
      if (!stored.ok) {
        throw new Error(
          "Your report was generated but is too large to open in this browser. Try a different browser or disable private mode, then run it again."
        );
      }
      router.push("/report");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("The audit timed out. Please try again.");
      } else {
        setError(
          err instanceof Error ? err.message : "Something went wrong. Try again."
        );
      }
      setLoading(false);
    } finally {
      clearTimeout(timeout);
    }
  }

  return (
    <div className={cn("w-full max-w-2xl", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(url);
        }}
        className="group relative"
      >
        <div className="glass-strong flex items-center gap-2 rounded-2xl border-2 border-primary/50 p-2 shadow-xl shadow-primary/10 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20">
          <div className="flex flex-1 items-center gap-3 pl-3">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              inputMode="url"
              autoComplete="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              placeholder="Enter your website URL..."
              aria-label="Website URL"
              className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground disabled:opacity-60"
            />
          </div>
          <Button
            type="submit"
            variant="gradient"
            size="lg"
            disabled={loading}
            className="shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analyze
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        <div className="mt-3" id="audit-context-panel">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Add context for a sharper audit
            <span className="text-xs text-primary/70">(optional)</span>
          </p>

          <div className="mt-3 grid gap-3 rounded-2xl border bg-background/50 p-4 text-left sm:grid-cols-3">
            <ContextField
              label="Target audience"
              placeholder="e.g. B2B SaaS founders"
              value={targetAudience}
              onChange={setTargetAudience}
              disabled={loading}
            />
            <ContextField
              label="Core product / service"
              placeholder="e.g. AI invoicing tool"
              value={coreProduct}
              onChange={setCoreProduct}
              disabled={loading}
            />
            <ContextField
              label="Primary traffic source"
              placeholder="e.g. Google Ads, LinkedIn"
              value={primaryTrafficSource}
              onChange={setPrimaryTrafficSource}
              disabled={loading}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            We use this to judge message-match and relevance — not just generic
            best practice.
          </p>
        </div>
      </form>

      {error ? (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-sm font-medium text-destructive"
          role="alert"
        >
          {error}
        </motion.p>
      ) : loading ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2 font-medium">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              {stage.label}
            </span>
            <span className="tabular-nums text-xs text-muted-foreground">
              {elapsed}s
            </span>
          </div>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500 transition-[width] duration-1000 ease-linear"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Running a full CRO audit — this usually takes 30–90 seconds.
          </p>
        </motion.div>
      ) : null}
    </div>
  );
}

function ContextField({
  label,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={300}
        className="h-10 w-full rounded-xl border-2 border-primary/50 bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
      />
    </label>
  );
}
