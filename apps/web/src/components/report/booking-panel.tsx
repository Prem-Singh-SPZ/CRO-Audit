"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarClock,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";
import { BOOKING_ANCHOR_ID } from "@/lib/report-ui";
import type { ContactContext } from "@/components/contact/types";

const LAUNCH_OPTIONS = [
  "As soon as possible",
  "Within 2 weeks",
  "This month",
  "This quarter",
  "Just exploring",
];

const TRUST = [
  { icon: TrendingUp, text: "30% conversion lift guaranteed in 90 days" },
  { icon: ShieldCheck, text: "Performance pricing — no fee until we deliver" },
];

export function BookingPanel({ context }: { context?: ContactContext }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [launch, setLaunch] = React.useState(LAUNCH_OPTIONS[0]!);
  const [submitted, setSubmitted] = React.useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = name.trim().length > 1 && emailValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    // No lead backend yet: capture intent client-side, confirm, then hand off
    // to the real scheduling calendar so the booking always completes.
    setSubmitted(true);
    const url = new URL(config.bookCallUrl);
    if (context?.websiteUrl) url.searchParams.set("site", context.websiteUrl);
    if (name) url.searchParams.set("name", name);
    if (email) url.searchParams.set("email", email);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  return (
    <motion.section
      id={BOOKING_ANCHOR_ID}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-amber-500/10 p-6 shadow-xl shadow-primary/5"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 -z-10 h-48 w-48 rounded-full bg-amber-500/20 blur-3xl" />

      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Done-for-you CRO
      </span>

      <h2 className="mt-4 text-xl font-bold tracking-tight text-balance">
        Want us to execute these fixes for you?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        We will plug these conversion leaks on your site and guarantee a
        conversion lift. Schedule a quick call below to secure your custom
        mockups.
      </p>

      {/* Calendly embed placeholder — drop the widget script/container here.
          Until then, the inline 3-field booking form below captures intent. */}
      <div data-calendly-placeholder className="hidden" />

      {submitted ? (
        <div className="mt-5 rounded-2xl border border-success/30 bg-success/10 p-5 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
          <p className="mt-2 text-sm font-semibold">You&rsquo;re all set, {name.split(" ")[0]}.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            We opened our calendar in a new tab — pick a slot and we&rsquo;ll
            bring your custom mockups.
          </p>
          <Button asChild variant="gradient" size="sm" className="mt-4">
            <Link href={config.bookCallUrl} target="_blank">
              <CalendarClock className="h-4 w-4" />
              Reopen calendar
            </Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <Field
            label="Name"
            value={name}
            onChange={setName}
            placeholder="Jane Cooper"
            type="text"
            autoComplete="name"
          />
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="jane@company.com"
            type="email"
            autoComplete="email"
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              When do you want to launch these fixes?
            </span>
            <select
              value={launch}
              onChange={(e) => setLaunch(e.target.value)}
              className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/40"
            >
              {LAUNCH_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>

          <Button
            type="submit"
            size="lg"
            disabled={!canSubmit}
            className={cn(
              "w-full bg-amber-500 text-white shadow-lg shadow-amber-500/25",
              "hover:bg-amber-600 hover:shadow-amber-500/40"
            )}
          >
            <CalendarClock className="h-4 w-4" />
            Secure my strategy call
          </Button>
        </form>
      )}

      <div className="mt-4 space-y-2 border-t pt-4">
        {TRUST.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-start gap-2 text-xs text-muted-foreground">
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{text}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/40"
      />
    </label>
  );
}
