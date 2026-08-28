import { Link2, ScanSearch, Sparkles, LayoutDashboard } from "lucide-react";

import { Reveal } from "@/components/reveal";

const STEPS = [
  {
    icon: Link2,
    step: "01",
    title: "Enter your URL",
    description:
      "Paste any website URL. No signup, no credit card, no setup required.",
    visual: "url",
  },
  {
    icon: ScanSearch,
    step: "02",
    title: "We crawl & capture",
    description:
      "We fetch your page, capture a full-page desktop screenshot, and extract your content and structure.",
    visual: "capture",
  },
  {
    icon: Sparkles,
    step: "03",
    title: "We run the audit",
    description:
      "Google PageSpeed Insights plus a senior CRO consultant's framework analyze copy, design, trust, psychology, and conversion friction.",
    visual: "analyze",
  },
  {
    icon: LayoutDashboard,
    step: "04",
    title: "Get your report",
    description:
      "An interactive dashboard with your score, annotated screenshots, and a prioritized plan to convert more.",
    visual: "report",
  },
] as const;

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
          <div className="absolute left-0 right-0 top-[104px] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
          {STEPS.map((step, i) => (
            <Reveal key={step.step} delay={i}>
              <div className="group relative flex flex-col items-center text-center">
                <StepVisual kind={step.visual} />
                <div className="relative z-10 -mt-9 flex h-[68px] w-[68px] items-center justify-center rounded-2xl border bg-card shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/10">
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

function StepVisual({ kind }: { kind: (typeof STEPS)[number]["visual"] }) {
  return (
    <div className="flex h-24 w-full items-center justify-center rounded-2xl border bg-card/60 p-4 shadow-sm">
      {kind === "url" && (
        <div className="flex w-full items-center gap-2 rounded-lg border bg-background px-2.5 py-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-[11px] text-muted-foreground">https://</span>
          <span className="text-[11px] font-medium">yoursite.com</span>
          <span className="ml-auto h-4 w-6 rounded bg-primary/80" />
        </div>
      )}
      {kind === "capture" && (
        <div className="relative w-full">
          <div className="space-y-1.5 rounded-lg border bg-background p-2">
            <div className="h-2 w-1/2 rounded bg-muted" />
            <div className="h-2 w-3/4 rounded bg-muted" />
            <div className="h-2 w-2/3 rounded bg-muted" />
          </div>
          <div className="absolute inset-y-0 -left-1 w-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
        </div>
      )}
      {kind === "analyze" && (
        <div className="flex w-full items-end justify-center gap-1.5">
          {[40, 70, 55, 85, 60, 45].map((h, i) => (
            <span
              key={i}
              className="w-2.5 rounded-t bg-primary/60"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      )}
      {kind === "report" && (
        <div className="flex w-full items-center gap-3">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-4 border-warning/70">
            <span className="text-xs font-semibold text-warning">64</span>
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="h-2 w-full rounded bg-success/60" />
            <div className="h-2 w-4/5 rounded bg-warning/60" />
            <div className="h-2 w-3/5 rounded bg-destructive/60" />
          </div>
        </div>
      )}
    </div>
  );
}
