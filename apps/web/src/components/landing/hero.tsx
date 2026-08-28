"use client";

import { motion } from "framer-motion";
import { TrendingUp, ArrowUpRight } from "lucide-react";

import { UrlAnalyzerForm } from "@/components/url-analyzer-form";
import { AnimatedBackground } from "@/components/animated-background";
import { config } from "@/lib/config";

export function Hero() {
  return (
    <section
      id="analyze"
      className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28"
    >
      {/* Animated aurora backdrop */}
      <AnimatedBackground intensity="default" />

      <div className="container grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left column — copy + form */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/50 px-4 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur"
          >
            <span className="flex h-2 w-2 rounded-full bg-success" />
            {config.heroBadge}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="max-w-2xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-[4rem]"
          >
            Know Why Your Website{" "}
            <span className="text-gradient-primary">Isn&apos;t Converting.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-6 max-w-xl text-balance text-lg text-muted-foreground sm:text-xl"
          >
            Get a complete CRO audit in under 60 seconds. Screenshots,
            Lighthouse, and expert-level analysis with a prioritized action plan.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-9 flex w-full justify-center lg:justify-start"
          >
            <UrlAnalyzerForm />
          </motion.div>
        </div>

        {/* Right column — animated report preview */}
        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          <div className="animate-float">
            <HeroPreview />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// A decorative, static mock of the report dashboard — purely illustrative copy
// so the hero shows the product at a glance (like Coframe's hero dashboard).
function HeroPreview() {
  const bars = [
    { label: "Clarity & Messaging", value: 82, tone: "bg-success" },
    { label: "Design & Performance", value: 67, tone: "bg-warning" },
    { label: "Conversion & Growth", value: 44, tone: "bg-destructive" },
  ];

  return (
    <div className="glass-strong ring-gradient glow relative rounded-3xl border p-5 shadow-2xl shadow-primary/10">
      {/* Floating lift badge */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="absolute -right-3 -top-3 z-10 flex items-center gap-1.5 rounded-full border border-success/30 bg-background px-3 py-1.5 text-sm font-semibold text-success shadow-lg"
      >
        <TrendingUp className="h-4 w-4" />
        +38% est. lift
      </motion.div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          CRO report · yoursite.com
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl border bg-card p-4">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="hsl(var(--warning))"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 42}
              initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - 0.64) }}
              transition={{ duration: 1.3, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums text-warning">64</span>
            <span className="text-[10px] text-muted-foreground">of 100</span>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Conversion score
          </p>
          <p className="mt-1 text-lg font-semibold">Needs work</p>
          <p className="mt-1 text-xs text-muted-foreground">
            9 issues found · 4 quick wins
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border bg-card p-4">
        {bars.map((bar, i) => (
          <div key={bar.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">{bar.label}</span>
              <span className="tabular-nums text-muted-foreground">{bar.value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className={`h-full rounded-full ${bar.tone}`}
                initial={{ width: 0 }}
                animate={{ width: `${bar.value}%` }}
                transition={{ duration: 0.9, delay: 0.7 + i * 0.15, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-3.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <ArrowUpRight className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Weak primary CTA above the fold</p>
          <p className="text-xs text-muted-foreground">Conversion &amp; Growth · High impact</p>
        </div>
      </div>
    </div>
  );
}
