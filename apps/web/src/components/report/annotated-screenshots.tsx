"use client";

import * as React from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  Sparkles,
  CalendarClock,
  Loader2,
} from "lucide-react";

import type { IssueDto, ScreenshotDto, MockupDto } from "@/lib/types";
import { SEVERITY_META, scrollToBooking } from "@/lib/report-ui";
import { estimateRealisticLift } from "@/lib/win-patterns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Device = "desktop" | "tablet" | "mobile";
type ViewMode = "issues" | "fixes";

const DEVICE_TABS: { key: Device; icon: typeof Monitor; label: string }[] = [
  { key: "desktop", icon: Monitor, label: "Desktop" },
  { key: "tablet", icon: Tablet, label: "Tablet" },
  { key: "mobile", icon: Smartphone, label: "Mobile" },
];

export function AnnotatedScreenshots({
  screenshots,
  issues,
  mockups = [],
  mockupPending = false,
}: {
  screenshots: ScreenshotDto[];
  issues: IssueDto[];
  mockups?: MockupDto[];
  mockupPending?: boolean;
}) {
  const available = DEVICE_TABS.filter((t) =>
    screenshots.some((s) => s.device === t.key)
  );
  const [device, setDevice] = React.useState<Device>(
    available[0]?.key ?? "desktop"
  );
  const [view, setView] = React.useState<ViewMode>("issues");

  const active = screenshots.find((s) => s.device === device);
  const mockup = mockups.find((m) => m.device === device);
  // The "after" concept only exists (or is being generated) for desktop.
  const pending = mockupPending && device === "desktop" && !mockup;
  const canShowFixes = !!mockup || pending;

  // Snap back to the annotated view whenever the current device has neither a
  // finished mockup nor one in flight.
  React.useEffect(() => {
    if (view === "fixes" && !mockup && !pending) setView("issues");
  }, [mockup, pending, view]);

  // Only pin annotations when there's an image to pin them onto.
  const pins = active
    ? issues.filter(
        (i) =>
          i.device === device &&
          i.annotationX != null &&
          i.annotationY != null
      )
    : [];

  const showingFixes = view === "fixes" && canShowFixes;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border bg-muted/50 p-1">
          {available.map((t) => (
            <button
              key={t.key}
              onClick={() => setDevice(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                device === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {canShowFixes ? (
          <div className="inline-flex rounded-full border bg-muted/50 p-1">
            <button
              onClick={() => setView("issues")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                view === "issues"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Eye className="h-4 w-4" />
              Issues
            </button>
            <button
              onClick={() => setView("fixes")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                view === "fixes"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              With fixes
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {pins.length} annotation{pins.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {showingFixes ? (
        mockup ? (
          <FixMockup mockup={mockup} device={device} issues={issues} />
        ) : (
          <GeneratingMockup device={device} />
        )
      ) : (
        <div
          className={cn(
            "relative mx-auto overflow-hidden rounded-xl border bg-muted/30",
            device === "mobile" ? "max-w-[360px]" : "max-w-full"
          )}
        >
          {active ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={active.url}
              alt={`${device} screenshot`}
              className="block h-auto w-full"
            />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No screenshot available
            </div>
          )}

          {pins.map((issue, idx) => {
            const meta = SEVERITY_META[issue.severity];
            return (
              <Tooltip key={issue.id}>
                <TooltipTrigger asChild>
                  <button
                    className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${(issue.annotationX ?? 0) * 100}%`,
                      top: `${(issue.annotationY ?? 0) * 100}%`,
                    }}
                    aria-label={issue.title}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-lg ring-2 ring-white/70 transition-transform group-hover:scale-125",
                        meta.dot
                      )}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className={cn(
                        "absolute inset-0 -z-10 animate-ping rounded-full opacity-40",
                        meta.dot
                      )}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="w-80 max-w-[85vw] space-y-2 p-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={meta.badge}>{meta.label}</Badge>
                    <span className="text-xs font-medium text-success">
                      {issue.estimatedConversionImpact}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold">{issue.title}</h4>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {issue.description}
                  </p>
                  <div className="rounded-lg bg-accent/50 p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      Recommended fix
                    </p>
                    <p className="mt-1 text-xs leading-relaxed">
                      {issue.suggestedFix}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GeneratingMockup({ device }: { device: Device }) {
  return (
    <div
      className={cn(
        "mx-auto flex aspect-video flex-col items-center justify-center gap-3 rounded-xl border bg-muted/30 text-center",
        device === "mobile" ? "max-w-[360px]" : "max-w-full"
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <div className="px-6">
        <p className="text-sm font-medium">Generating your redesign concept…</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Our AI is applying the top fixes to your hero. This usually takes under
          a minute.
        </p>
      </div>
    </div>
  );
}

function FixMockup({
  mockup,
  device,
  issues,
}: {
  mockup: MockupDto;
  device: Device;
  issues: IssueDto[];
}) {
  // Surface the same reasoning the image model was briefed on: the highest-
  // severity issues that drove this redesign, most urgent first.
  const topFixes = React.useMemo(
    () =>
      [...issues]
        .sort(
          (a, b) =>
            SEVERITY_META[a.severity].order - SEVERITY_META[b.severity].order
        )
        .slice(0, 3),
    [issues]
  );

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "relative mx-auto overflow-hidden rounded-xl border bg-muted/30",
          device === "mobile" ? "max-w-[360px]" : "max-w-full"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mockup.url}
          alt={`${device} redesign concept with conversion fixes applied`}
          className="block h-auto w-full"
        />
        <Badge className="absolute left-3 top-3 gap-1 bg-primary/90 text-primary-foreground shadow-lg backdrop-blur">
          <Sparkles className="h-3 w-3" />
          AI concept
        </Badge>
      </div>

      {/* The "logic" behind the redesign: what changed, the CRO rationale, and
          the realistic lift grounded in Spiralyze's proven A/B-test patterns. */}
      {topFixes.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Why we made these changes
          </p>
          <ul className="mt-3 space-y-4">
            {topFixes.map((issue) => {
              const lift = estimateRealisticLift(issue.category);
              const liftLabel = lift
                ? `+${lift.low}-${lift.high}%`
                : issue.estimatedConversionImpact;
              return (
                <li key={issue.id} className="flex items-start gap-2.5">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    {/* Distinct issue name as the headline (no repeated copy) */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="text-sm font-medium">{issue.title}</p>
                      {liftLabel && liftLabel !== "n/a" && (
                        <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                          {liftLabel} lift
                        </span>
                      )}
                    </div>
                    {/* The reason itself, no longer duplicated in the title */}
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {issue.whyItMatters || issue.psychology}
                    </p>
                    {/* Evidence: grounds the lift in real Spiralyze test data */}
                    {lift && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/80">
                        Based on Spiralyze {lift.categoryLabel} winners — e.g.{" "}
                        <span className="font-medium text-foreground/80">
                          &ldquo;{lift.topPattern.name}&rdquo; +
                          {lift.topPattern.uplift}%
                        </span>{" "}
                        · {lift.winRate}% win rate across{" "}
                        {lift.sampleSize.toLocaleString()} A/B tests.
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5 sm:flex-row sm:items-center">
        <p className="text-xs leading-relaxed text-muted-foreground">
          An AI-generated concept of your above-the-fold hero with the top fixes
          applied — a clearer value proposition, stronger hierarchy, and a
          focused CTA. Your production-ready redesign is built and validated by
          our team.
        </p>
        <Button
          type="button"
          size="sm"
          variant="gradient"
          onClick={scrollToBooking}
          className="shrink-0"
        >
          <CalendarClock className="h-4 w-4" />
          Book a call to build it
        </Button>
      </div>
    </div>
  );
}
