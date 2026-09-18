"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FlaskConical,
  TrendingUp,
  ArrowRight,
  Sparkles,
  ChevronDown,
  Loader2,
} from "lucide-react";

import {
  estimateRealisticLift,
  groundedLiftLabel,
  type IssueDto,
  type ScreenshotDto,
  type MockupDto,
} from "@cro/shared";
import { COMPLEXITY_META, SEVERITY_META } from "@/lib/report-ui";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExperimentEvidence } from "./experiment-evidence";
import { experimentPreviewFrame } from "@/lib/experiment-preview";

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
  mockupPending = false,
  skipRedesign = false,
}: {
  issues: IssueDto[];
  screenshots: ScreenshotDto[];
  mockups: MockupDto[];
  mockupPending?: boolean;
  skipRedesign?: boolean;
}) {
  const groups = React.useMemo(() => groupBySection(issues), [issues]);
  const [section, setSection] = React.useState(groups[0]?.category ?? "");

  React.useEffect(() => {
    if (groups.length > 0 && !groups.some((g) => g.category === section)) {
      setSection(groups[0].category);
    }
  }, [groups, section]);

  const startIndex = React.useMemo(() => {
    const map = new Map<string, number>();
    let offset = 0;
    for (const group of groups) {
      map.set(group.category, offset);
      offset += group.issues.length;
    }
    return map;
  }, [groups]);

  const renderGroup = (group: SectionGroup) => (
    <div className="grid gap-4 lg:grid-cols-2">
      {group.issues.map((issue, i) => {
        const before =
          screenshots.find((s) => s.device === "desktop" && s.url) ??
          screenshots.find((s) => s.url);
        const after = skipRedesign
          ? undefined
          : mockups.find((m) => m.device === "desktop" && m.url) ??
            mockups.find((m) => m.url);
        return (
          <ExperimentCard
            key={issue.id}
            index={(startIndex.get(group.category) ?? 0) + i + 1}
            issue={issue}
            beforeUrl={before?.url}
            afterUrl={after?.url}
            imageWidth={before?.width ?? 1440}
            imageHeight={before?.height ?? 900}
            mockupPending={!skipRedesign && mockupPending}
            skipRedesign={skipRedesign}
          />
        );
      })}
      <ExperimentEvidence category={group.category} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FlaskConical className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-lg font-semibold">Suggested experiments by section</h3>
          <p className="text-sm text-muted-foreground">
            Before/after concepts, grouped by page section.
          </p>
        </div>
      </div>

      {groups.length > 1 ? (
        <Tabs value={section} onValueChange={setSection}>
          <div className="overflow-x-auto pb-1">
            <TabsList>
              {groups.map((group) => (
                <TabsTrigger key={group.category} value={group.category}>
                  {group.label}
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {group.issues.length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {groups.map((group) => (
            <TabsContent key={group.category} value={group.category}>
              {renderGroup(group)}
            </TabsContent>
          ))}
        </Tabs>
      ) : groups[0] ? (
        renderGroup(groups[0])
      ) : null}
    </div>
  );
}

function ExperimentCard({
  index,
  issue,
  beforeUrl,
  afterUrl,
  imageWidth,
  imageHeight,
  mockupPending = false,
  skipRedesign = false,
}: {
  index: number;
  issue: IssueDto;
  beforeUrl?: string;
  afterUrl?: string;
  imageWidth: number;
  imageHeight: number;
  mockupPending?: boolean;
  skipRedesign?: boolean;
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
        w={issue.annotationW}
        h={issue.annotationH}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        mockupPending={mockupPending}
        skipRedesign={skipRedesign}
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

        <WhyExperiment
          rationale={issue.whyItMatters || issue.psychology}
          suggestedFix={issue.suggestedFix}
          lift={lift}
        />

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

        <div className="mt-auto flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
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
            {issue.complexity && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  COMPLEXITY_META[issue.complexity].badge
                )}
              >
                {COMPLEXITY_META[issue.complexity].label}
              </span>
            )}
          </div>
          <Button asChild variant="ghost" size="sm" className="self-start sm:self-auto">
            <Link href={config.bookCallUrl} target="_blank">
              Fix My Page
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function WhyExperiment({
  rationale,
  suggestedFix,
  lift,
}: {
  rationale?: string;
  suggestedFix?: string;
  lift: ReturnType<typeof estimateRealisticLift>;
}) {
  const [open, setOpen] = React.useState(false);
  const hasBody = Boolean(rationale || suggestedFix || lift);
  if (!hasBody) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
        Why this experiment
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {rationale && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {rationale}
            </p>
          )}
          {suggestedFix && (
            <div className="rounded-xl bg-accent/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                Proposed change
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                {suggestedFix}
              </p>
            </div>
          )}
          {lift && (
            <p className="text-[11px] leading-relaxed text-muted-foreground/80">
              Based on {lift.categoryLabel} winners — e.g.{" "}
              <span className="font-medium text-foreground/80">
                &ldquo;{lift.topPattern.name}&rdquo; +{lift.topPattern.uplift}%
              </span>{" "}
              · {lift.winRate}% win rate across{" "}
              {lift.sampleSize.toLocaleString()} A/B tests.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BeforeAfter({
  beforeUrl,
  afterUrl,
  x,
  y,
  w,
  h,
  imageWidth,
  imageHeight,
  mockupPending = false,
  skipRedesign = false,
}: {
  beforeUrl?: string;
  afterUrl?: string;
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
  imageWidth: number;
  imageHeight: number;
  mockupPending?: boolean;
  skipRedesign?: boolean;
}) {
  const [mode, setMode] = React.useState<"before" | "after">("before");
  const hasAfter = !skipRedesign && !!afterUrl;
  const pending = !skipRedesign && mockupPending && !hasAfter;
  const showAfter = mode === "after" && hasAfter;
  const showPendingConcept = mode === "after" && pending;
  const active = showAfter ? afterUrl : beforeUrl;
  const frame = experimentPreviewFrame({
    x: showAfter ? null : x,
    y: showAfter ? null : y,
    w: showAfter ? null : w,
    h: showAfter ? null : h,
    imageWidth,
    imageHeight,
  });

  React.useEffect(() => {
    if (mode === "after" && !hasAfter && !pending) {
      setMode("before");
    }
  }, [mode, hasAfter, pending]);

  return (
    <div className="relative border-b bg-muted/30">
      <div
        className="relative aspect-video w-full overflow-hidden"
        role="img"
        aria-label={
          showAfter
            ? "Redesign concept"
            : showPendingConcept
              ? "Generating redesign concept"
              : "Current design"
        }
      >
        {beforeUrl && active ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active}
              alt=""
              className="absolute max-w-none origin-top-left"
              style={{
                width: `${100 / frame.width}%`,
                height: "auto",
                transform: `translate(${-frame.left * 100}%, ${-frame.top * 100}%)`,
              }}
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No preview available
          </div>
        )}
        {showPendingConcept ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 text-center backdrop-blur-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="px-4 text-xs font-medium">
              Generating your redesign concept…
            </p>
          </div>
        ) : null}
      </div>
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

      {skipRedesign ? null : (
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
          onClick={() => {
            if (!hasAfter && !pending) return;
            setMode("after");
          }}
          aria-pressed={mode === "after"}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
            mode === "after"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Concept
        </button>
      </div>
      )}
    </div>
  );
}
