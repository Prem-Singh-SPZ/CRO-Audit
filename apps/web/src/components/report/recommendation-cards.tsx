"use client";

import { Zap } from "lucide-react";

import type { RecommendationDto } from "@/lib/types";
import { Reveal } from "@/components/reveal";

function scoreFor(r: RecommendationDto): number {
  // Prioritize high-impact, low-effort ("quick wins") first.
  return r.impact * 2 - r.effort;
}

export function RecommendationCards({
  recommendations,
}: {
  recommendations: RecommendationDto[];
}) {
  const sorted = [...recommendations].sort((a, b) => scoreFor(b) - scoreFor(a));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sorted.map((r, i) => (
        <Reveal key={r.id} delay={i % 2}>
          <div className="card-premium h-full p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Zap className="h-4 w-4" />
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {r.category}
              </span>
            </div>
            <h3 className="mt-4 font-semibold leading-snug">{r.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{r.description}</p>
            <div className="mt-4 flex items-center gap-4 text-xs">
              <Meter label="Impact" value={r.impact} className="text-success" />
              <Meter label="Effort" value={r.effort} className="text-warning" />
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function Meter({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${
              i < value ? "bg-current" : "bg-muted"
            } ${i < value ? className : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
