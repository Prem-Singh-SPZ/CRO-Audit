import { Link2, ScanSearch, Sparkles, LayoutDashboard } from "lucide-react";

import { Reveal } from "@/components/reveal";

const STEPS = [
  {
    icon: Link2,
    step: "01",
    title: "Enter your URL",
    description:
      "Paste any website URL. No signup, no credit card, no setup required.",
  },
  {
    icon: ScanSearch,
    step: "02",
    title: "We crawl & capture",
    description:
      "We fetch your page, capture a full-page desktop screenshot, and extract your content and structure.",
  },
  {
    icon: Sparkles,
    step: "03",
    title: "We run the audit",
    description:
      "Google PageSpeed Insights plus a senior CRO consultant's framework analyze copy, design, trust, psychology, and conversion friction.",
  },
  {
    icon: LayoutDashboard,
    step: "04",
    title: "Get your report",
    description:
      "An interactive dashboard with your score, annotated screenshots, and a prioritized plan to convert more.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y bg-muted/30 py-24">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            From URL to insight in four steps
          </h2>
        </Reveal>

        <div className="relative mt-16 grid gap-8 md:grid-cols-4">
          <div className="absolute left-0 right-0 top-[34px] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
          {STEPS.map((step, i) => (
            <Reveal key={step.step} delay={i}>
              <div className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex h-[68px] w-[68px] items-center justify-center rounded-2xl border bg-card shadow-sm">
                  <step.icon className="h-7 w-7 text-primary" />
                </div>
                <span className="mt-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Step {step.step}
                </span>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
