"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Full-bleed animated backdrop: slow-drifting gradient "aurora" orbs over an
 * optional grid, for a Coframe-style premium dark feel. Purely decorative and
 * non-interactive; motion is disabled automatically via the global
 * MotionConfig reducedMotion="user" setting.
 */
export function AnimatedBackground({
  className,
  grid = true,
  intensity = "default",
}: {
  className?: string;
  grid?: boolean;
  intensity?: "subtle" | "default" | "strong";
}) {
  const opacity =
    intensity === "strong" ? 0.6 : intensity === "subtle" ? 0.28 : 0.42;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className
      )}
    >
      {grid ? (
        <div className="absolute inset-0 bg-grid-pattern bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] opacity-[0.35]" />
      ) : null}

      <motion.div
        className="absolute -left-24 -top-32 h-[42rem] w-[42rem] rounded-full blur-[110px]"
        style={{
          opacity,
          background:
            "radial-gradient(circle at center, hsl(var(--primary) / 0.55), transparent 60%)",
        }}
        animate={{
          x: [0, 60, -30, 0],
          y: [0, 40, 20, 0],
          scale: [1, 1.12, 0.96, 1],
        }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-28 top-1/3 h-[38rem] w-[38rem] rounded-full blur-[120px]"
        style={{
          opacity: opacity * 0.9,
          background:
            "radial-gradient(circle at center, hsl(var(--brand) / 0.5), transparent 60%)",
        }}
        animate={{
          x: [0, -50, 30, 0],
          y: [0, -30, 30, 0],
          scale: [1, 0.95, 1.1, 1],
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-14rem] left-1/3 h-[34rem] w-[34rem] rounded-full blur-[120px]"
        style={{
          opacity: opacity * 0.7,
          background:
            "radial-gradient(circle at center, hsl(var(--accent-foreground) / 0.28), transparent 60%)",
        }}
        animate={{ x: [0, 30, -20, 0], y: [0, 20, -10, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
