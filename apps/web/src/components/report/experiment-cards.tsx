"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FlaskConical,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Layers,
} from "lucide-react";

import {
  estimateRealisticLift,
  groundedLiftLabel,
  type IssueDto,
  type ScreenshotDto,
  type MockupDto,
} from "@cro/shared";
import { SEVERITY_META } from "@/lib/report-ui";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ExperimentEvidence } from "./experiment-evidence";

// Friendly, page-oriented labels for the raw issue categories so each group
// reads like a section of the page (mirrors Coframe's per-section experiments).
const SECTION_LABELS: Record<string, string> = {
  hero: "Hero & Above the Fold",
  trust: "Trust & Social Proof",
  cta: "Calls to Action",
  copy: "Copywriting & Messaging",
  design: "Visual Design",
  forms: "Forms & Lead Capture",
  accessibility: "Accessibility",
  performance: "Performance & Speed",
  mobile: "Mobile Experience",
  psychology: "Persuasion & Psychology",
  seo: "SEO & Discoverability",
  navigation: "Navigation & Structure",
};

function sectionLabel(category: string): string {
  return SECTION_LABELS[category] ?? category;
}

type SectionGroup = {
  category: string;
  label: string;
  issues: IssueDto[];
  order: number;
};

function groupBySection(issues: IssueDto[]): SectionGroup[] {
  const map = new Map<string, IssueDto[]>();
  for (const issue of issues) {
    const list = map.get(issue.category) ?? [];
    list.push(issue);
    map.set(issue.category, list);
  }

  const groups: SectionGroup[] = [];
  for (const [category, list] of map) {
    const sorted = [...list].sort(
      (a, b) => SEVERITY_META[a.severity].order - SEVERITY_META[b.severity].order
    );
    groups.push({
      category,
      label: sectionLabel(category),
      issues: sorted,
      // Rank the section by its most severe issue so critical areas lead.
      order: SEVERITY_META[sorted[0].severity].order,
    });
  }
  return groups.sort((a, b) => a.order - b.order);
}

export function ExperimentCards({
  issues,
  screenshots,
  mockups,
}: {
  issues: IssueDto[];
  screenshots: ScreenshotDto[];
  mockups: MockupDto[];
}) {
  const groups = React.useMemo(() => groupBySection(issues), [issues]);

  // Running experiment number across all sections (Experiment 01, 02, ...).
  let experimentIndex = 0;

  return (
    <div className="space-y-10">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FlaskConical className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-lg font-semibold">Suggested experiments by section</h3>
          <p className="text-sm text-muted-foreground">
            Each finding becomes a testable experiment — grouped by page section,
            with a before/after concept, expected lift, and the evidence behind
            it. We recommend the fix; our team can ship it for you.
          </p>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.category} className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Layers className="h-4 w-4" />
            </span>
            <h4 className="text-base font-semibold">{group.label}</h4>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {group.issues.length} experiment
              {group.issues.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {group.issues.map((issue) => {
              experimentIndex += 1;
              const before =
                screenshots.find((s) => s.device === issue.device && s.url) ??
                screenshots.find((s) => s.url);
              const after =
                mockups.find((m) => m.device === issue.device && m.url) ??
                mockups.find((m) => m.url);
              return (
                <ExperimentCard
                  key={issue.id}
                  index={experimentIndex}
                  issue={issue}
                  beforeUrl={before?.url}
                  afterUrl={after?.url}
                />
              );
            })}
          </div>

          {/* Evidence-backed alternate experiments for this component, drawn
              from Spiralyze's proven win-pattern library. Renders nothing for
              categories with no comparable pattern data. */}
          <ExperimentEvidence category={group.category} />
        </section>
      ))}
    </div>
  );
}

function ExperimentCard({
  index,
  issue,
  beforeUrl,
  afterUrl,
}: {
  index: number;
  issue: IssueDto;
  beforeUrl?: string;
  afterUrl?: string;
}) {
  const meta = SEVERITY_META[issue.severity];
  const lift = estimateRealisticLift(issue.category);
  const liftLabel = groundedLiftLabel(
    issue.category,
    issue.estimatedConversionImpact
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border border-l-4 bg-card transition-shadow hover:shadow-lg hover:shadow-primary/5",
        meta.accent
      )}
    >
      {/* Before / after concept */}
      <BeforeAfter
        beforeUrl={beforeUrl}
        afterUrl={afterUrl}
        x={issue.annotationX}
        y={issue.annotationY}
      />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Experiment {String(index).padStart(2, "0")}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
            <TrendingUp className="h-4 w-4" />
            {issue.estimatedConversionImpact}
          </span>
        </div>

        <h5 className="mt-2 font-semibold leading-snug">{issue.title}</h5>

        {/* Strategic rationale */}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {issue.whyItMatters || issue.psychology}
        </p>

        {/* The proposed change */}
        {issue.suggestedFix && (
          <div className="mt-3 rounded-xl bg-accent/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              Proposed change
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground/90">
              {issue.suggestedFix}
            </p>
          </div>
        )}

        {/* Evidence grounded in Spiralyze test data */}
        {lift && (
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/80">
            Based on {lift.categoryLabel} winners — e.g.{" "}
            <span className="font-medium text-foreground/80">
              &ldquo;{lift.topPattern.name}&rdquo; +{lift.topPattern.uplift}%
            </span>{" "}
            · {lift.winRate}% win rate across{" "}
            {lift.sampleSize.toLocaleString()} A/B tests.
          </p>
        )}

        {/* Confidence */}
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Confidence</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              whileInView={{ width: `${issue.confidence}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <span className="tabular-nums">{issue.confidence}%</span>
        </div>

        <div className="mt-auto flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                meta.badge
              )}
            >
              {meta.label} priority
            </span>
            {liftLabel && liftLabel !== "n/a" && (
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                {liftLabel} lift
              </span>
            )}
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={config.bookCallUrl} target="_blank">
              Ship this fix
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// Before/after visual for a single experiment. "Before" zooms the captured page
// into the finding's annotation region; "After" shows the AI redesign concept
// (shared full-page mockup) when available. A Control/Concept toggle echoes the
// Figma Control/Editable framing.
function BeforeAfter({
  beforeUrl,
  afterUrl,
  x,
  y,
}: {
  beforeUrl?: string;
  afterUrl?: string;
  x?: number | null;
  y?: number | null;
}) {
  const [mode, setMode] = React.useState<"before" | "after">("before");
  const hasAfter = !!afterUrl;
  const active = mode === "after" && hasAfter ? afterUrl : beforeUrl;

  // Zoom into the annotated region when we have coordinates; otherwise frame the
  // top of the page. A larger background-size crops to the point of interest.
  const hasPoint = x != null && y != null;
  const backgroundSize = hasPoint ? "240%" : "cover";
  const backgroundPosition = hasPoint
    ? `${(x as number) * 100}% ${(y as number) * 100}%`
    : "center top";

  if (!beforeUrl) {
    return (
      <div className="flex h-40 items-center justify-center border-b bg-muted/30 text-xs text-muted-foreground">
        No preview available
      </div>
    );
  }

  return (
    <div className="relative border-b bg-muted/30">
      <div
        className="h-44 w-full bg-no-repeat transition-all duration-500"
        style={{
          backgroundImage: `url(${active})`,
          backgroundSize,
          backgroundPosition,
        }}
        role="img"
        aria-label={mode === "after" ? "Redesign concept" : "Current design"}
      />
      {/* Label */}
      <span
        className={cn(
          "absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur",
          mode === "after" && hasAfter
            ? "bg-primary/90 text-primary-foreground"
            : "bg-background/85 text-muted-foreground"
        )}
      >
        {mode === "after" && hasAfter ? (
          <>
            <Sparkles className="h-3 w-3" />
            After (concept)
          </>
        ) : (
          "Before"
        )}
      </span>

      {/* Control / Concept toggle */}
      {hasAfter && (
        <div className="absolute right-3 top-3 inline-flex rounded-full border bg-background/85 p-0.5 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => setMode("before")}
            aria-pressed={mode === "before"}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              mode === "before"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Control
          </button>
          <button
            type="button"
            onClick={() => setMode("after")}
            aria-pressed={mode === "after"}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              mode === "after"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Concept
          </button>
        </div>
      )}
    </div>
  );
}
