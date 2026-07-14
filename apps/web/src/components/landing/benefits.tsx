import { Check } from "lucide-react";

import { Reveal } from "@/components/reveal";

const BENEFITS = [
  "Stop guessing why visitors bounce instead of buying",
  "Uncover hidden conversion friction across every device",
  "Get expert CRO recommendations without hiring a consultant",
  "Prioritize fixes by impact vs. effort - not gut feeling",
  "Benchmark against SaaS, ecommerce, and landing-page best practices",
  "Share a polished, credible report with your team or clients",
];

const STATS = [
  { value: "34+", label: "CRO categories analyzed" },
  { value: "<60s", label: "Average audit time" },
  { value: "3", label: "Device viewports captured" },
  { value: "12", label: "Score dimensions" },
];

export function Benefits() {
  return (
    <section className="py-24">
      <div className="container grid items-center gap-16 lg:grid-cols-2">
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
          <div className="grid grid-cols-2 gap-5">
            {STATS.map((stat) => (
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
    </section>
  );
}
