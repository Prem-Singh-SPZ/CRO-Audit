"use client";

import { motion } from "framer-motion";
import { Zap, ShieldCheck, Gauge } from "lucide-react";

import { UrlAnalyzerForm } from "@/components/url-analyzer-form";
import { config } from "@/lib/config";

const TRUST = [
  { icon: Zap, label: "Results in under 60s" },
  { icon: Gauge, label: "Lighthouse + expert review" },
  { icon: ShieldCheck, label: "No signup required" },
];

export function Hero() {
  return (
    <section
      id="analyze"
      className="relative overflow-hidden pt-36 pb-20 sm:pt-44 sm:pb-28"
    >
      {/* Background flourishes */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/20 opacity-30 blur-[130px]" />
        <div className="absolute inset-0 bg-grid-pattern bg-[size:44px_44px] opacity-[0.15] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      </div>

      <div className="container flex flex-col items-center text-center">
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
          className="max-w-4xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
        >
          Know Why Your Website{" "}
          <span className="text-gradient-primary">Isn&apos;t Converting.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl"
        >
          Get a complete CRO audit in under 60 seconds. Screenshots,
          Lighthouse, and expert-level analysis with a prioritized action plan.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10 flex w-full justify-center"
        >
          <UrlAnalyzerForm />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground"
        >
          {TRUST.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <item.icon className="h-4 w-4 text-primary" />
              {item.label}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
