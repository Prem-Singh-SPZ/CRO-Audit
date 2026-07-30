"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import type { RecommendationDto } from "@cro/shared";

export function PriorityMatrix({
  recommendations,
}: {
  recommendations: RecommendationDto[];
}) {
  // Jitter overlapping points slightly so multiple recs at the same coords show.
  const data = recommendations.map((r, i) => ({
    x: r.effort + ((i % 3) - 1) * 0.12,
    y: r.impact + ((Math.floor(i / 3) % 3) - 1) * 0.12,
    title: r.title,
    category: r.category,
    impact: r.impact,
    effort: r.effort,
  }));

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-12 inset-y-8 grid grid-cols-2 grid-rows-2 gap-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
        <span className="flex items-start justify-start p-2">Quick wins</span>
        <span className="flex items-start justify-end p-2 text-right">
          Major projects
        </span>
        <span className="flex items-end justify-start p-2">Fill-ins</span>
        <span className="flex items-end justify-end p-2 text-right">
          Thankless
        </span>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 10 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name="Effort"
            domain={[0.5, 5.5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            label={{
              value: "Implementation effort →",
              position: "bottom",
              fill: "hsl(var(--muted-foreground))",
              fontSize: 12,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Impact"
            domain={[0.5, 5.5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            label={{
              value: "Business impact →",
              angle: -90,
              position: "insideLeft",
              fill: "hsl(var(--muted-foreground))",
              fontSize: 12,
            }}
          />
          <ZAxis range={[120, 120]} />
          <ReferenceLine x={3} stroke="hsl(var(--border))" />
          <ReferenceLine y={3} stroke="hsl(var(--border))" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]!.payload as (typeof data)[number];
              return (
                <div className="max-w-[220px] rounded-lg border bg-popover p-3 text-xs shadow-xl">
                  <p className="font-semibold">{p.title}</p>
                  <p className="mt-1 text-muted-foreground">
                    {p.category} · Impact {p.impact}/5 · Effort {p.effort}/5
                  </p>
                </div>
              );
            }}
          />
          <Scatter data={data} fill="hsl(var(--primary))" fillOpacity={0.75} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
