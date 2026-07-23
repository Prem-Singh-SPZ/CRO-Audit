"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

import { SCORE_CATEGORY_LABELS, type CategoryScores } from "@/lib/cro";

export function ScoreRadar({ scores }: { scores: CategoryScores }) {
  const data = (Object.keys(scores) as (keyof CategoryScores)[]).map((key) => ({
    category: SCORE_CATEGORY_LABELS[key].split(" ")[0],
    score: scores[key],
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis
          dataKey="category"
          tick={{
            fill: "hsl(var(--foreground))",
            fontSize: 12,
            fontWeight: 600,
          }}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.35}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
