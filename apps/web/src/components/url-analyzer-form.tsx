"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, Sparkles, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setPendingScan } from "@/lib/pending-scan";

export function UrlAnalyzerForm({ className }: { className?: string }) {
  const router = useRouter();
  const [url, setUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [targetAudience, setTargetAudience] = React.useState("");
  const [coreProduct, setCoreProduct] = React.useState("");
  const [primaryTrafficSource, setPrimaryTrafficSource] = React.useState("");

  function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Please enter a website URL");
      return;
    }
    setError(null);
    // Hand the request to the animated scan screen, which runs the audit.
    setPendingScan({
      url: trimmed,
      targetAudience: targetAudience.trim() || undefined,
      coreProduct: coreProduct.trim() || undefined,
      primaryTrafficSource: primaryTrafficSource.trim() || undefined,
    });
    router.push("/analyzing");
  }

  return (
    <div className={cn("w-full max-w-2xl", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(url);
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
              placeholder="Enter your website URL..."
              aria-label="Website URL"
              className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Button type="submit" variant="gradient" size="lg" className="shrink-0">
            <Sparkles className="h-4 w-4" />
            Analyze
            <ArrowRight className="h-4 w-4" />
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
            />
            <ContextField
              label="Core product / service"
              placeholder="e.g. AI invoicing tool"
              value={coreProduct}
              onChange={setCoreProduct}
            />
            <ContextField
              label="Primary traffic source"
              placeholder="e.g. Google Ads, LinkedIn"
              value={primaryTrafficSource}
              onChange={setPrimaryTrafficSource}
            />
          </div>
        </div>
      </form>

      {error ? (
        <p className="mt-3 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ContextField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={300}
        className="h-10 w-full rounded-xl border-2 border-primary/50 bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
