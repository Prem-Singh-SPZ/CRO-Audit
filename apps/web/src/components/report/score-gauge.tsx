"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { scoreColor, scoreLabel } from "@/lib/utils";

export function ScoreGauge({
  score,
  size = 200,
  strokeWidth = 14,
  label = true,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`CRO score: ${score} out of 100 — ${scoreLabel(score)}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-4xl font-semibold tabular-nums"
          style={{ color }}
        >
          {score}
        </motion.span>
        {label && (
          <span className="mt-0.5 text-xs font-medium text-muted-foreground">
            {scoreLabel(score)}
          </span>
        )}
      </div>
    </div>
  );
}
