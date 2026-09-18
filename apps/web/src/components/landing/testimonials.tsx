import { Star } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const TESTIMONIALS = [
  {
    quote: `Most of the tests we've run have improved conversion rates by 20-50%.`,
    name: "Matt Boyce",
    role: "Sr. Director of Demand Generation",
  },
  {
    quote: "We saw a 125% increase in conversion rate for demo requests.",
    name: "Megan Gouveia",
    role: "Sr. Manager, Personalization & Optimization",
  },
  {
    quote: "On our landing pages, we've seen over a 30% conversion rate increase.",
    name: "Pat Oldenburg",
    role: "VP of Demand Marketing & Ops",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="border-y bg-muted/30 py-24">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Client results
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Trusted by leading B2B SaaS teams
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i}>
              <figure className="card-premium flex h-full flex-col p-8 hover:-translate-y-1">
                <div className="flex gap-0.5 text-warning">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-5 flex-1 text-[15px] leading-relaxed text-foreground/90">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{t.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
