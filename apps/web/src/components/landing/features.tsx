import {
  Eye,
  Gauge,
  Brain,
  Target,
  Monitor,
  BarChart3,
  ShieldCheck,
  FileDown,
} from "lucide-react";

import { Reveal } from "@/components/reveal";

// The three headline capabilities, shown as large gradient cards.
const HERO_FEATURES = [
  {
    icon: Eye,
    tag: "Visual",
    title: "Visual UX review",
    description:
      "We inspect layout, whitespace, contrast, CTA prominence, and above-the-fold clarity like a seasoned designer.",
    gradient: "from-amber-400/20 via-primary/10 to-transparent",
  },
  {
    icon: Brain,
    tag: "Reasoning",
    title: "Senior CRO reasoning",
    description:
      "Evaluated with Nielsen, Baymard, CXL, Fogg, Hick's Law, AIDA, PAS, and proven persuasion psychology.",
    gradient: "from-brand/20 via-brand/10 to-transparent",
  },
  {
    icon: Target,
    tag: "Plan",
    title: "Prioritized action plan",
    description:
      "Every issue ranked by business impact vs. implementation effort so you know exactly what to fix first.",
    gradient: "from-success/20 via-success/10 to-transparent",
  },
] as const;

// The remaining supporting features, shown as a compact grid.
const FEATURES = [
  {
    icon: Gauge,
    title: "Lighthouse, enhanced",
    description:
      "Performance, accessibility, SEO, and best practices - explained in terms of conversion impact, not just scores.",
  },
  {
    icon: Monitor,
    title: "Full-page desktop review",
    description:
      "A full-page desktop screenshot analyzed top to bottom - hero, mid-page, and footer - where conversions are won or lost.",
  },
  {
    icon: BarChart3,
    title: "Beautiful reports",
    description:
      "Score gauges, radar charts, annotated screenshots, and category breakdowns you can share with your team.",
  },
  {
    icon: ShieldCheck,
    title: "Trust & objections",
    description:
      "Detects missing social proof, trust signals, risk reversal, and the objections quietly killing your conversions.",
  },
  {
    icon: FileDown,
    title: "Export & share",
    description:
      "Download a polished PDF or export the raw JSON to share your report with stakeholders in one click.",
  },
] as const;

export function Features() {
  return (
    <section id="features" className="py-24">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Everything you need
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            A complete CRO team, in one audit
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Not a generic scanner. Genuine, expert-level analysis of the things
            that actually move your conversion rate.
          </p>
        </Reveal>

        {/* Headline gradient cards */}
        <div className="mt-16 grid gap-5 lg:grid-cols-3">
          {HERO_FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i}>
              <div
                className={`group relative h-full overflow-hidden rounded-3xl border bg-card p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
              >
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-70`}
                />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full border bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                      {feature.tag}
                    </span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Supporting grid */}
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i % 3}>
              <div className="card-premium group h-full p-6 hover:-translate-y-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
