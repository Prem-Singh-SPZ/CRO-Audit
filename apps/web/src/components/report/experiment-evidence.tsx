"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TrendingUp, FlaskConical } from "lucide-react";

import {
  WIN_PATTERN_LIBRARY,
  patternCategoryForIssue,
  estimateRealisticLift,
} from "@cro/shared";

// Evidence-backed "alternate experiments" for a component: a ranked chart of
// proven Spiralyze winning patterns (real uplift, win rate, sample size) drawn
// from the shared win-pattern library. Renders nothing for categories with no
// comparable pattern data (e.g. performance / SEO / accessibility).
export function ExperimentEvidence({
  category,
  limit = 6,
}: {
  category: string;
  limit?: number;
}) {
  const key = patternCategoryForIssue(category);
  if (!key) return null;

  const bucket = WIN_PATTERN_LIBRARY[key];
  if (!bucket || bucket.patterns.length === 0) return null;

  const lift = estimateRealisticLift(category);

  const data = [...bucket.patterns]
    .sort((a, b) => b.uplift - a.uplift)
    .slice(0, limit)
    .map((p) => ({
      name: p.name,
      uplift: p.uplift,
      winRate: p.winRate,
      sampleSize: p.sampleSize,
    }));

  const maxUplift = Math.max(...data.map((d) => d.uplift), 1);
  const totalTests = bucket.patterns.reduce((sum, p) => sum + p.sampleSize, 0);

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Alternate experiments to test</p>
            <p className="text-xs text-muted-foreground">
              Proven {bucket.label} experiments across{" "}
              {totalTests.toLocaleString()} A/B tests
            </p>
          </div>
        </div>

        {lift && (
          <div className="rounded-xl border border-success/20 bg-success/5 px-3 py-2 text-right">
            <p className="inline-flex items-center gap-1 text-lg font-semibold text-success">
              <TrendingUp className="h-4 w-4" />+{lift.low}-{lift.high}%
            </p>
            <p className="text-[11px] text-muted-foreground">
              typical winner · {lift.winRate}% win rate
            </p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 38)}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
            barCategoryGap={8}
          >
            <CartesianGrid
              horizontal={false}
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
            />
            <XAxis
              type="number"
              domain={[0, Math.ceil(maxUplift / 5) * 5]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]!.payload as (typeof data)[number];
                return (
                  <div className="max-w-[220px] rounded-lg border bg-popover p-3 text-xs shadow-xl">
                    <p className="font-semibold">{p.name}</p>
                    <p className="mt-1 text-muted-foreground">
                      +{p.uplift}% uplift · {p.winRate}% win rate
                    </p>
                    <p className="text-muted-foreground">
                      {p.sampleSize.toLocaleString()} A/B tests
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="uplift" radius={[0, 4, 4, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.55 + 0.45 * (entry.uplift / maxUplift)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/80">
        Ranked by measured conversion lift. Our team can run these as prioritized
        A/B tests on your page.
      </p>
    </div>
  );
}
