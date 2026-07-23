"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mail,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Rocket,
  ShieldCheck,
  Clock,
  Star,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { ContactContext } from "@/components/contact/types";

const STATS = [
  { value: "+30%", label: "avg. lift in 90 days" },
  { value: "3X", label: "higher win rate" },
  { value: "78,000", label: "A/B tests analyzed" },
];

// Relocated from the old contact modal — shown next to the ratings row.
const VALUE_PROPS = [
  { icon: TrendingUp, text: "30% conversion lift in 90 days — guaranteed" },
  { icon: Rocket, text: "Winning A/B tests predicted from 78,000 websites" },
  { icon: ShieldCheck, text: "Performance pricing — no fee until we deliver" },
  { icon: Clock, text: "First test live in 2 weeks · we reply within 1 business day" },
];

export function AgencyCta({
  context,
  title = "Don't just read the report — fix it and grow revenue",
  description = `${config.brandName} turns audits like this into measurable conversion lifts. Get a tailored plan and we'll implement the highest-impact fixes for you.`,
}: {
  context?: ContactContext;
  title?: string;
  description?: string;
}) {
  const score = context?.score;
  const hasScore = typeof score === "number" && Number.isFinite(score);

  return (
    <motion.section
      id="contact"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-brand/10 p-8 shadow-xl shadow-primary/5 sm:p-12"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-pattern bg-[size:32px_32px] opacity-[0.1] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      {/* Glow accents */}
      <div className="pointer-events-none absolute -left-20 -top-20 -z-10 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 -z-10 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />

      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Done-for-you CRO
        </span>

        <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>

        {hasScore ? (
          <p className="mx-auto mt-4 max-w-xl text-balance text-base leading-relaxed text-foreground/90">
            Your page scored a{" "}
            <span
              className={cn(
                "font-bold",
                score! >= 80
                  ? "text-success"
                  : score! >= 60
                    ? "text-warning"
                    : "text-destructive"
              )}
            >
              {score}/100
            </span>
            . Fixing these high-impact bottlenecks requires expert UX and
            copywriting strategy. Let&rsquo;s execute these fixes together—book
            your 15-minute strategy session now.
          </p>
        ) : (
          <p className="mt-3 text-balance text-muted-foreground">{description}</p>
        )}

        {/* Social proof stats */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border bg-background/50 p-4 backdrop-blur"
            >
              <div className="flex items-center justify-center gap-1 text-xl font-semibold text-foreground sm:text-2xl">
                {s.value === "+30%" ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : null}
                {s.value}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="gradient" size="xl" className="w-full sm:w-auto">
            <Link href={config.bookCallUrl} target="_blank">
              <Sparkles className="h-4 w-4" />
              {hasScore ? "Book my strategy session" : "Get a demo"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl" className="w-full sm:w-auto">
            <Link href={config.contactUrl}>
              <Mail className="h-4 w-4" />
              Email us
            </Link>
          </Button>
        </div>

        {/* What you get + ratings */}
        {/* <div className="mt-8 grid gap-4 rounded-2xl border bg-background/40 p-5 text-left backdrop-blur sm:grid-cols-2">
          {VALUE_PROPS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-2.5 text-sm">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-foreground/90">{text}</span>
            </div>
          ))}
        </div> */}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              ))}
            </span>
            30% guaranteed in 90 days
          </span>
          <span className="hidden sm:inline">·</span>
          <span>No fee until we deliver</span>
          <span className="hidden sm:inline">·</span>
          <span>Free demo</span>
        </div>
      </div>
    </motion.section>
  );
}
