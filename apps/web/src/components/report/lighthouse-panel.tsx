"use client";

import type { LighthouseDto } from "@cro/shared";
import { ScoreGauge } from "./score-gauge";

const CATEGORIES: { key: keyof Omit<LighthouseDto, "metrics">; label: string }[] =
  [
    { key: "performance", label: "Performance" },
    { key: "accessibility", label: "Accessibility" },
    { key: "bestPractices", label: "Best Practices" },
    { key: "seo", label: "SEO" },
  ];

const METRICS: { key: string; label: string; unit: string }[] = [
  { key: "lcp", label: "Largest Contentful Paint", unit: "ms" },
  { key: "fcp", label: "First Contentful Paint", unit: "ms" },
  { key: "tbt", label: "Total Blocking Time", unit: "ms" },
  { key: "cls", label: "Cumulative Layout Shift", unit: "" },
  { key: "si", label: "Speed Index", unit: "ms" },
  { key: "tti", label: "Time to Interactive", unit: "ms" },
];

export function LighthousePanel({ lighthouse }: { lighthouse: LighthouseDto }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {CATEGORIES.map((c) => (
          <div key={c.key} className="flex flex-col items-center gap-2">
            <ScoreGauge
              score={lighthouse[c.key]}
              size={104}
              strokeWidth={9}
              label={false}
            />
            <span className="text-sm font-medium">{c.label}</span>
          </div>
        ))}
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold text-muted-foreground">
          Core metrics
        </h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {METRICS.map((m) => {
            const value = lighthouse.metrics[m.key];
            return (
              <div
                key={m.key}
                className="rounded-xl border bg-muted/20 p-4"
              >
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {value != null
                    ? m.key === "cls"
                      ? value.toFixed(3)
                      : `${value.toLocaleString()}${m.unit}`
                    : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="rounded-xl bg-accent/40 p-4 text-sm leading-relaxed text-muted-foreground">
        Speed is a conversion multiplier: slower pages increase bounce and drop
        conversions, especially on mobile. Improving LCP and reducing blocking
        time directly shortens the path from landing to action.
      </p>
    </div>
  );
}
