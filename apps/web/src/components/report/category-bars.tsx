"use client";

import { motion } from "framer-motion";
import {
  SCORE_CATEGORIES,
  SCORE_CATEGORY_LABELS,
  type CategoryScores,
} from "@cro/shared";
import { scoreColor } from "@/lib/utils";

export function CategoryBars({
  scores,
  compact = false,
}: {
  scores: CategoryScores;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "grid gap-y-2"
          : "grid gap-x-8 gap-y-4 sm:grid-cols-2"
      }
    >
      {SCORE_CATEGORIES.map((cat, i) => {
        const value = scores[cat];
        return (
          <div key={cat}>
            <div
              className={
                compact
                  ? "mb-1 flex items-center justify-between gap-2 text-xs"
                  : "mb-1.5 flex items-center justify-between text-sm"
              }
            >
              <span className="min-w-0 font-medium leading-tight">
                {SCORE_CATEGORY_LABELS[cat]}
              </span>
              <span
                className="shrink-0 tabular-nums font-semibold"
                style={{ color: scoreColor(value) }}
              >
                {value}
              </span>
            </div>
            <div
              className={
                compact
                  ? "h-1.5 overflow-hidden rounded-full bg-muted"
                  : "h-2 overflow-hidden rounded-full bg-muted"
              }
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: scoreColor(value) }}
                initial={{ width: 0 }}
                whileInView={{ width: `${value}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: i * 0.04, ease: "easeOut" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
