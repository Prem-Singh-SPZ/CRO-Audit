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

const FEATURES = [
  {
    icon: Eye,
    title: "Visual UX review",
    description:
      "We inspect layout, whitespace, contrast, CTA prominence, and above-the-fold clarity like a seasoned designer.",
  },
  {
    icon: Brain,
    title: "Senior CRO reasoning",
    description:
      "Evaluated with Nielsen, Baymard, CXL, Fogg, Hick's Law, AIDA, PAS, and proven persuasion psychology.",
  },
  {
    icon: Gauge,
    title: "Lighthouse, enhanced",
    description:
      "Performance, accessibility, SEO, and best practices - explained in terms of conversion impact, not just scores.",
  },
  {
    icon: Target,
    title: "Prioritized action plan",
    description:
      "Every issue ranked by business impact vs. implementation effort so you know exactly what to fix first.",
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
];

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

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i % 4}>
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
