"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  Loader2,
  Search,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { storeReport } from "@/lib/report-store";
import type { ReportResponse } from "@/lib/types";

const EXAMPLES = ["stripe.com", "notion.so", "linear.app", "vercel.com"];

export function UrlAnalyzerForm({ className }: { className?: string }) {
  const router = useRouter();
  const [url, setUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showContext, setShowContext] = React.useState(false);
  const [targetAudience, setTargetAudience] = React.useState("");
  const [coreProduct, setCoreProduct] = React.useState("");
  const [primaryTrafficSource, setPrimaryTrafficSource] = React.useState("");

  async function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Please enter a website URL");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmed,
          targetAudience: targetAudience.trim() || undefined,
          coreProduct: coreProduct.trim() || undefined,
          primaryTrafficSource: primaryTrafficSource.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }
      storeReport(data as ReportResponse);
      router.push("/report");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
      setLoading(false);
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
        <div className="glass-strong flex items-center gap-2 rounded-2xl p-2 shadow-xl shadow-black/5 transition-all focus-within:ring-2 focus-within:ring-primary/40">
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

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowContext((v) => !v)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Add context for a sharper audit
            <span className="text-xs text-muted-foreground/70">(optional)</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                showContext && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence initial={false}>
            {showContext && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
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
                  We use this to judge message-match and relevance — not just
                  generic best practice.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
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
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Running your CRO audit — analyzing conversion signals. This can take up
          to a minute.
        </motion.p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={loading}
              onClick={() => {
                setUrl(ex);
                void submit(ex);
              }}
              className="rounded-full border bg-background/50 px-3 py-1 font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
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
        className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
      />
    </label>
  );
}
