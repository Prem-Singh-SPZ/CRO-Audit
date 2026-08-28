import { Gauge, Brain, Eye, Target, ShieldCheck, BarChart3 } from "lucide-react";

import { Reveal } from "@/components/reveal";

// The frameworks + engines that power the audit. Doubling the list lets the
// CSS marquee scroll seamlessly (translateX(-50%) lands on the copy's start).
const BADGES = [
  { icon: Gauge, label: "Google Lighthouse" },
  { icon: BarChart3, label: "PageSpeed Insights" },
  { icon: Brain, label: "Nielsen Norman heuristics" },
  { icon: Target, label: "Baymard benchmarks" },
  { icon: Eye, label: "CXL frameworks" },
  { icon: ShieldCheck, label: "Fogg behavior model" },
];

export function TrustedBy() {
  const items = [...BADGES, ...BADGES];

  return (
    <section className="border-y bg-muted/20 py-10">
      <Reveal className="container">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Powered by the frameworks the best CRO teams trust
        </p>

        <div className="group relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
          <div className="flex w-max animate-marquee items-center gap-10 group-hover:[animation-play-state:paused]">
            {items.map((badge, i) => (
              <div
                key={`${badge.label}-${i}`}
                className="flex shrink-0 items-center gap-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <badge.icon className="h-4 w-4 text-primary/70" />
                {badge.label}
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
