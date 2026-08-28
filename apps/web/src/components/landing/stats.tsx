import { Reveal } from "@/components/reveal";
import { CountUpStat } from "./count-up-stat";

const STATS = [
  {
    value: 30,
    suffix: "%",
    label: "Avg. conversion lift in the first 90 days",
  },
  {
    value: 78000,
    label: "Websites powering our prediction engine",
  },
  { value: 170, label: "A/B testing specialists on the team" },
  { value: 3, suffix: "X", label: "Higher win rate than legacy A/B testing" },
];

export function Stats() {
  return (
    <section className="border-y bg-primary/5 py-16">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Predictive CRO that delivers
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Results guaranteed — 30% lift in 90 days
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i}>
              <div className="rounded-2xl border bg-card p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10">
                <CountUpStat
                  value={s.value}
                  suffix={s.suffix}
                  className="text-3xl font-semibold text-primary sm:text-4xl"
                />
                <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
