import { Check, X, Clock, Zap } from "lucide-react";

import { Reveal } from "@/components/reveal";

const BENEFITS = [
  "Stop guessing why visitors bounce instead of buying",
  "Uncover hidden conversion friction across your entire page",
  "Get expert CRO recommendations without hiring a consultant",
  "Prioritize fixes by impact vs. effort - not gut feeling",
  "Benchmark against SaaS, ecommerce, and landing-page best practices",
  "Share a polished, credible report with your team or clients",
];

const MANUAL_STEPS = [
  "Book a consultant (1-2 week wait)",
  "Manual heuristic walkthrough",
  "Wait days for a slide deck",
  "Generic, un-prioritized advice",
  "Pay $$$$ per audit",
];

const AI_STEPS = [
  "Paste your URL — no signup",
  "Full-page capture + Lighthouse",
  "Expert analysis in under 60s",
  "Ranked by impact vs. effort",
  "Free to run, anytime",
];

export function Benefits() {
  return (
    <section className="py-24">
      <div className="container space-y-20">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Why it matters
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Every visitor you don&apos;t convert is revenue left on the table
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Most sites lose conversions to problems the owners can&apos;t see.
              CRO Audit AI surfaces them - and tells you exactly how to fix them.
            </p>
            <ul className="mt-8 space-y-4">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="text-[15px]">{benefit}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={1}>
            <div className="grid gap-5 sm:grid-cols-2">
              {[
                { value: "34+", label: "CRO categories analyzed" },
                { value: "<60s", label: "Average audit time" },
                { value: "Full-page", label: "Desktop screenshot analyzed" },
                { value: "12", label: "Score dimensions" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="card-premium flex flex-col justify-center p-8"
                >
                  <span className="text-4xl font-semibold tracking-tight text-gradient-primary">
                    {stat.value}
                  </span>
                  <span className="mt-2 text-sm text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Process contrast — manual audit vs. CRO Audit AI */}
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Insight in minutes, not weeks
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Replace the slow, expensive audit cycle
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border bg-muted/30 p-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-5 w-5" />
                <span className="font-semibold">The manual way</span>
              </div>
              <ul className="mt-6 space-y-3">
                {MANUAL_STEPS.map((step) => (
                  <li key={step} className="flex items-start gap-3 text-sm">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-transparent p-8 shadow-lg shadow-primary/5">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
              <div className="relative flex items-center gap-2 text-primary">
                <Zap className="h-5 w-5" />
                <span className="font-semibold">With CRO Audit AI</span>
              </div>
              <ul className="relative mt-6 space-y-3">
                {AI_STEPS.map((step) => (
                  <li key={step} className="flex items-start gap-3 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span className="font-medium">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
