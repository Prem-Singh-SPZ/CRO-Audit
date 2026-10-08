"use client";

import * as React from "react";
import {
  Eye,
  Sparkles,
  CalendarClock,
  Loader2,
  Lock,
} from "lucide-react";

import {
  formPatternStats,
  type IssueDto,
  type MockupDto,
  type ScreenshotDto,
} from "@cro/shared";
import { conceptCopy } from "@/lib/composed-mockup";
import { buildChangeCallouts } from "@/lib/fix-callouts";
import { SEVERITY_META, shortCaption } from "@/lib/report-ui";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";
import Link from "next/link";

type ViewMode = "issues" | "fixes";

const LABEL_W_PX = 208;
const LABEL_H_PX = 34;

export function AnnotatedScreenshots({
  screenshots,
  issues,
  mockups = [],
  mockupPending = false,
  mockupSlow = false,
  selectedIssueId = null,
  onSelectIssue,
  teaser = false,
  forceView,
  skipRedesign = false,
}: {
  screenshots: ScreenshotDto[];
  issues: IssueDto[];
  mockups?: MockupDto[];
  mockupPending?: boolean;
  /** Composed preview has been waiting on Gemini for 30 seconds. */
  mockupSlow?: boolean;
  selectedIssueId?: string | null;
  onSelectIssue?: (id: string | null) => void;
  /** Top leaks only — no redesign toggle. */
  teaser?: boolean;
  forceView?: ViewMode;
  /** Live A/B test already on the page — no pins, no "If we redesigned it". */
  skipRedesign?: boolean;
}) {
  const device = "desktop" as const;
  const [view, setView] = React.useState<ViewMode>(forceView ?? "issues");
  React.useEffect(() => {
    if (forceView) setView(forceView);
  }, [forceView]);
  const [selectedMockupId, setSelectedMockupId] = React.useState<string | null>(
    null
  );

  const active =
    screenshots.find((s) => s.device === "desktop") ?? screenshots[0];
  const deviceMockups = mockups.filter((m) => m.device === "desktop" && m.url);
  const mockup =
    deviceMockups.find((m) => m.id === selectedMockupId) ?? deviceMockups[0];
  const pending = !skipRedesign && mockupPending && deviceMockups.length === 0;
  const canShowFixes = !skipRedesign && (deviceMockups.length > 0 || pending);

  React.useEffect(() => {
    if (
      deviceMockups.length > 0 &&
      selectedMockupId &&
      !deviceMockups.some((m) => m.id === selectedMockupId)
    ) {
      setSelectedMockupId(deviceMockups[0].id);
    }
  }, [deviceMockups, selectedMockupId]);

  React.useEffect(() => {
    if (view === "fixes" && !mockup && !pending) setView("issues");
  }, [mockup, pending, view]);

  const pins =
    active && !skipRedesign
      ? issues.filter(
          (i) =>
            i.device === device &&
            i.annotationX != null &&
            i.annotationY != null &&
            i.annotationElement !== null &&
            i.annotationElement !== "hero"
        )
      : [];
  const heroCutoff = active
    ? Math.min(1, 900 / Math.max(active.height, 1))
    : 0.2;
  const pinsByMockupId = React.useMemo(() => {
    const map = new Map<string, IssueDto[]>();
    for (const m of deviceMockups) {
      map.set(
        m.id,
        buildChangeCallouts(issues, heroCutoff, m.regions, m.id)
      );
    }
    return map;
  }, [deviceMockups, issues, heroCutoff]);
  const changePins = mockup ? (pinsByMockupId.get(mockup.id) ?? []) : [];

  const showingFixes = view === "fixes" && canShowFixes;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        {teaser ? (
          <span className="text-xs text-muted-foreground">
            {pins.length} annotation{pins.length === 1 ? "" : "s"}
          </span>
        ) : skipRedesign ? null : canShowFixes ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border bg-muted/50 p-1">
              <button
                onClick={() => setView("issues")}
                aria-pressed={view === "issues"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  view === "issues"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Eye className="h-4 w-4" />
                Your page
              </button>
              <button
                onClick={() => setView("fixes")}
                aria-pressed={view === "fixes"}
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
                If we redesigned it
              </button>
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {pins.length} annotation{pins.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {showingFixes ? (
        mockup ? (
          <div className="space-y-4">
            {deviceMockups.length > 1 && (
              <PatternCardGallery
                mockups={deviceMockups}
                selectedId={mockup.id}
                onSelect={setSelectedMockupId}
                pinsByMockupId={pinsByMockupId}
              />
            )}
            <FixMockup
              mockup={mockup}
              device={device}
              issues={issues}
              pins={changePins}
              selectedIssueId={selectedIssueId}
              onSelectIssue={onSelectIssue}
            />
          </div>
        ) : (
          <GeneratingMockup slow={mockupSlow} />
        )
      ) : (
        <div className="relative mx-auto overflow-hidden rounded-xl border bg-muted/30">
          {active?.url ? (
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

          {active?.url && pins.length > 0 && (
            <ScreenshotCallouts
              mode="issues"
              pins={pins}
              selectedIssueId={selectedIssueId}
              onSelectIssue={onSelectIssue}
            />
          )}
        </div>
      )}
    </div>
  );
}

function placeLabels(
  pins: IssueDto[],
  containerW: number,
  containerH: number
) {
  const labelW = Math.min(0.42, LABEL_W_PX / Math.max(containerW, 1));
  const labelH = Math.min(0.08, LABEL_H_PX / Math.max(containerH, 1));
  const placed: { id: string; lx: number; ly: number }[] = [];

  const clampX = (lx: number) => Math.max(0.01, Math.min(0.99 - labelW, lx));
  const clampY = (ly: number) => Math.max(0.004, Math.min(0.996 - labelH, ly));
  const overlaps = (lx: number, ly: number) =>
    placed.some(
      (p) =>
        Math.abs(p.lx - lx) < labelW * 0.92 &&
        Math.abs(p.ly - ly) < labelH + 0.004
    );

  for (const issue of pins) {
    if (issue.annotationX == null || issue.annotationY == null) continue;
    const anchorX = clampX(issue.annotationX - labelW / 2);
    const anchorY = clampY(issue.annotationY - labelH / 2);
    let lx = anchorX;
    let ly = anchorY;

    if (overlaps(lx, ly)) {
      const above = anchorY - labelH - 0.006;
      const below = clampY(anchorY + labelH + 0.006);
      if (above >= 0.004 && !overlaps(anchorX, above)) {
        ly = above;
      } else if (below - anchorY <= labelH * 1.25 && !overlaps(anchorX, below)) {
        ly = below;
      } else {
        const right = clampX(anchorX + labelW * 0.35);
        const left = clampX(anchorX - labelW * 0.35);
        if (!overlaps(right, anchorY)) lx = right;
        else if (!overlaps(left, anchorY)) lx = left;
      }
    }

    placed.push({ id: issue.id, lx, ly });
  }

  return { placed, labelW, labelH };
}

function ScreenshotCallouts({
  mode = "issues",
  pins,
  selectedIssueId,
  onSelectIssue,
  interactive = true,
}: {
  mode?: "issues" | "fixes";
  pins: IssueDto[];
  selectedIssueId?: string | null;
  onSelectIssue?: (id: string | null) => void;
  interactive?: boolean;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ w: 800, h: 1200 });

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () =>
      setSize({ w: el.clientWidth || 800, h: el.clientHeight || 1200 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    if (!selectedIssueId) return;
    document
      .getElementById(`callout-${selectedIssueId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedIssueId]);

  const { placed, labelW, labelH } = React.useMemo(
    () => placeLabels(pins, size.w, size.h),
    [pins, size.w, size.h]
  );

  const labels = new Map(placed.map((p) => [p.id, p]));
  const selected = interactive
    ? pins.find((p) => p.id === selectedIssueId) ?? null
    : null;
  const selectedLabel = selected ? labels.get(selected.id) : undefined;

  return (
    <div
      ref={rootRef}
      className={cn("absolute inset-0", !interactive && "pointer-events-none")}
      onClick={() => interactive && onSelectIssue?.(null)}
    >
      {pins.map((issue, idx) => {
        const label = labels.get(issue.id);
        if (!label) return null;
        const meta = SEVERITY_META[issue.severity];
        const isSelected = selectedIssueId === issue.id;
        const dimmed = selected && !isSelected;

        const Mark = interactive ? "button" : "div";
        const markProps = interactive
          ? {
              type: "button" as const,
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation();
                onSelectIssue?.(isSelected ? null : issue.id);
              },
            }
          : {};

        return (
          <Mark
            key={issue.id}
            id={interactive ? `callout-${issue.id}` : undefined}
            aria-label={interactive ? issue.title : undefined}
            aria-pressed={interactive ? isSelected : undefined}
            {...markProps}
            className={cn(
              "absolute z-20 flex max-w-[220px] items-center gap-1.5 rounded-full border-2 bg-background/95 px-2 py-1 text-left shadow-lg ring-2 ring-white backdrop-blur transition-opacity",
              meta.border,
              isSelected && "shadow-xl",
              dimmed && "opacity-25"
            )}
            style={{
              left: `${label.lx * 100}%`,
              top: `${label.ly * 100}%`,
              width: `${labelW * 100}%`,
            }}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                meta.dot
              )}
            >
              {idx + 1}
            </span>
            <span className="min-w-0 truncate text-[11px] font-semibold leading-tight">
              {shortCaption(issue.title, 6)}
            </span>
            {mode !== "fixes" &&
              issue.estimatedConversionImpact &&
              issue.estimatedConversionImpact !== "n/a" && (
                <span className="shrink-0 text-[10px] font-semibold text-success">
                  {issue.estimatedConversionImpact}
                </span>
              )}
          </Mark>
        );
      })}

      {selected && selectedLabel && (
        <div
          className="absolute z-30 w-64 max-w-[80%] rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur"
          style={{
            left: `${Math.min(0.72, selectedLabel.lx) * 100}%`,
            top: `${(selectedLabel.ly + labelH + 0.008) * 100}%`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {mode === "fixes" ? (
            <>
              <Badge className="bg-primary/15 text-primary">Changed</Badge>
              <p className="mt-1.5 text-sm font-semibold">{selected.title}</p>
              <p className="mt-2 text-xs leading-relaxed">
                <span className="font-semibold">What we changed. </span>
                {selected.description}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Why. </span>
                {selected.whyItMatters}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <Badge className={SEVERITY_META[selected.severity].badge}>
                  {SEVERITY_META[selected.severity].label}
                </Badge>
                <span className="text-xs font-semibold text-success">
                  {selected.estimatedConversionImpact}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-semibold">{selected.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {selected.description}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function patternMeta(mockup: MockupDto) {
  const name = mockup.patternName;
  const fromLib = name ? formPatternStats(name) : undefined;
  return {
    name: name ?? (mockup.variant === "hero" ? "Hero" : "Proven pattern"),
    winRate: mockup.winRate ?? fromLib?.winRate,
    sampleSize: mockup.sampleSize ?? fromLib?.sampleSize,
    uplift: mockup.uplift ?? fromLib?.uplift,
  };
}

function PatternCardGallery({
  mockups,
  selectedId,
  onSelect,
  pinsByMockupId,
}: {
  mockups: MockupDto[];
  selectedId: string;
  onSelect: (id: string) => void;
  pinsByMockupId: Map<string, IssueDto[]>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {mockups.map((m) => {
        const meta = patternMeta(m);
        const selected = m.id === selectedId;
        const pins = pinsByMockupId.get(m.id) ?? [];
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            aria-pressed={selected}
            className={cn(
              "overflow-hidden rounded-xl border bg-background text-left transition-shadow",
              selected
                ? "border-primary ring-2 ring-primary/30"
                : "hover:border-foreground/20"
            )}
          >
            <div className="relative aspect-video w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.url}
                alt={meta.name}
                className="h-full w-full object-cover object-top"
              />
              {pins.length > 0 && (
                <ScreenshotCallouts
                  mode="fixes"
                  pins={pins}
                  interactive={false}
                />
              )}
            </div>
            <div className="space-y-1 p-3">
              <p className="text-sm font-semibold leading-snug">{meta.name}</p>
              <p className="text-xs text-muted-foreground">
                {meta.winRate != null && `${meta.winRate}% win rate`}
                {meta.winRate != null && meta.sampleSize != null && " · "}
                {meta.sampleSize != null &&
                  `${meta.sampleSize.toLocaleString()} tests`}
                {meta.uplift != null && ` · +${meta.uplift}% uplift`}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const SLOW_MOCKUP_MESSAGE =
  "This is taking longer than expected. Your redesign is still on the way, and the finished concept will be worth the wait.";

export function MockupGeneratingFrame({
  slow = false,
  className,
}: {
  slow?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 overflow-hidden bg-muted/40 px-6 text-center",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-primary/25 to-transparent"
        style={{ animation: "mockup-sweep 2.8s ease-in-out infinite" }}
      />
      <Loader2 className="relative h-6 w-6 animate-spin text-primary" />
      <p className="relative max-w-md text-sm font-medium leading-relaxed">
        {slow
          ? SLOW_MOCKUP_MESSAGE
          : "Generating your redesign concept…"}
      </p>
      {slow ? null : (
        <p className="relative text-xs text-muted-foreground">
          Our AI is applying the top fixes to your hero.
        </p>
      )}
    </div>
  );
}

function GeneratingMockup({ slow = false }: { slow?: boolean }) {
  return (
    <MockupGeneratingFrame
      slow={slow}
      className="mx-auto aspect-video max-w-full rounded-xl border"
    />
  );
}

function isHeroOnlyMockup(mockup: MockupDto) {
  return mockup.variant === "hero" || !mockup.patternName;
}

function FullPagePlanHook() {
  return (
    <div className="overflow-hidden rounded-xl border border-primary/25 bg-card">
      <div className="relative h-16 border-b bg-muted/40 px-5 pt-3" aria-hidden>
        <div className="h-2.5 w-2/5 rounded-full bg-muted-foreground/15" />
        <div className="mt-2 h-2 w-4/5 rounded-full bg-muted-foreground/10" />
        <div className="mt-2 h-2 w-3/5 rounded-full bg-muted-foreground/10" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
      </div>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Lock className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">
              Full-page redesign is ready — this preview is the hero
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              We focus the on-page concept on the fold, where most conversions
              are won. The rest of the page has a matching mockup and rollout
              plan. Book a call and we&apos;ll walk you through it.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="gradient" className="shrink-0">
          <Link
            href={config.bookCallUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <CalendarClock className="h-4 w-4" />
            Fix My Page
          </Link>
        </Button>
      </div>
    </div>
  );
}

function FixMockup({
  mockup,
  device,
  issues,
  pins,
  selectedIssueId,
  onSelectIssue,
}: {
  mockup: MockupDto;
  device: "desktop";
  issues: IssueDto[];
  pins: IssueDto[];
  selectedIssueId?: string | null;
  onSelectIssue?: (id: string | null) => void;
}) {
  const heroOnly = isHeroOnlyMockup(mockup);
  const composed = mockup.source === "composed";
  return (
    <div className="space-y-3">
      <div
        className="relative mx-auto max-w-full overflow-hidden rounded-xl border bg-muted/30"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mockup.url}
          alt={`${device} redesign concept with conversion fixes applied`}
          className="block h-auto w-full"
        />
        <Badge className="absolute left-3 top-3 z-30 gap-1 bg-primary/90 text-primary-foreground shadow-lg backdrop-blur">
          <Sparkles className="h-3 w-3" />
          {patternMeta(mockup).name}
        </Badge>
        {composed ? <ComposedConceptOverlay issues={issues} /> : null}
        {!composed && pins.length > 0 && (
          <ScreenshotCallouts
            mode="fixes"
            pins={pins}
            selectedIssueId={selectedIssueId}
            onSelectIssue={onSelectIssue}
          />
        )}
        {heroOnly && !composed ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background via-background/70 to-transparent"
            aria-hidden
          />
        ) : null}
      </div>

      {heroOnly && !composed ? (
        <FullPagePlanHook />
      ) : (
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5 sm:flex-row sm:items-center">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {composed
              ? "Concept applied on your live screenshot so you can still see the direction."
              : pins.length > 0
                ? "Callouts sit on the headline, benefits, and button we can see in this concept."
                : "This concept has no measured callouts — we only mark elements we can see."}
          </p>
          <Button asChild size="sm" variant="gradient" className="shrink-0">
            <Link href={config.bookCallUrl} target="_blank" rel="noopener noreferrer">
              <CalendarClock className="h-4 w-4" />
              Fix My Page
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function ComposedConceptOverlay({ issues }: { issues: IssueDto[] }) {
  const { headline, bullets } = conceptCopy(issues);
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className="absolute inset-x-0 top-0 h-[520px] bg-gradient-to-r from-background/80 via-background/25 to-transparent"
        aria-hidden
      />
      <div className="absolute left-[5%] top-[132px] w-[min(42%,440px)] rounded-2xl border border-white/20 bg-background/90 p-5 shadow-xl backdrop-blur-md">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          If we redesigned it
        </p>
        <h3 className="mt-1 line-clamp-2 text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
          {headline}
        </h3>
        <ul className="mt-3 space-y-1.5 text-sm text-foreground/80">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="line-clamp-2">{b}</span>
            </li>
          ))}
        </ul>
        <span className="mt-4 inline-flex rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">
          Fix My Page
        </span>
      </div>
    </div>
  );
}
