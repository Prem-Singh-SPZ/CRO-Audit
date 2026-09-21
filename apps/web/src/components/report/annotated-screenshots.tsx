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
import { SEVERITY_META, shortCaption } from "@/lib/report-ui";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";
import Link from "next/link";

type ViewMode = "issues" | "fixes";

const DEFAULT_BOX_W = 0.16;
const DEFAULT_BOX_H = 0.08;
const LABEL_W_PX = 208;
const LABEL_H_PX = 34;

type ChangeSlot = "headline" | "bullets" | "cta";
type SlotLayout = "hero" | "formRight" | "formLeft" | "formCenter";
type SlotBox = { x: number; y: number; w: number; h: number };

// Centers + sizes in mockup space. Each redesign pattern has its own layout —
// sharing one map made the second card's boxes land on the wrong column.
const SLOTS_BY_LAYOUT: Record<SlotLayout, Record<ChangeSlot, SlotBox>> = {
  hero: {
    headline: { x: 0.36, y: 0.335, w: 0.56, h: 0.15 },
    bullets: { x: 0.24, y: 0.5, w: 0.32, h: 0.13 },
    cta: { x: 0.2, y: 0.665, w: 0.22, h: 0.075 },
  },
  formRight: {
    headline: { x: 0.28, y: 0.3, w: 0.44, h: 0.16 },
    bullets: { x: 0.3, y: 0.5, w: 0.38, h: 0.16 },
    cta: { x: 0.78, y: 0.48, w: 0.32, h: 0.44 },
  },
  formLeft: {
    headline: { x: 0.72, y: 0.3, w: 0.44, h: 0.16 },
    bullets: { x: 0.7, y: 0.5, w: 0.38, h: 0.16 },
    cta: { x: 0.22, y: 0.48, w: 0.32, h: 0.44 },
  },
  formCenter: {
    headline: { x: 0.5, y: 0.22, w: 0.5, h: 0.12 },
    bullets: { x: 0.5, y: 0.36, w: 0.42, h: 0.12 },
    cta: { x: 0.5, y: 0.58, w: 0.36, h: 0.36 },
  },
};

function layoutForMockup(mockup: MockupDto, issues: IssueDto[] = []): SlotLayout {
  const name = (mockup.patternName || "").toLowerCase();
  if (name.includes("left")) return "formLeft";
  if (
    name.includes("center") ||
    name.includes("modal") ||
    name.includes("multi-step") ||
    (name.includes("over ui") && !name.includes("copy"))
  ) {
    return "formCenter";
  }
  const formPage =
    name.includes("form") ||
    mockup.variant === "form" ||
    issues.some((i) =>
      /form|lead|email|demo|field/i.test(`${i.title} ${i.category}`)
    );
  if (formPage) return "formRight";
  if (mockup.variant === "hero" || !mockup.patternName) return "hero";
  return "formRight";
}

const CHANGE_TITLE: Record<ChangeSlot, string> = {
  headline: "Clearer headline",
  bullets: "Scannable benefits",
  cta: "Stronger call to action",
};

const CHANGE_WHAT: Record<ChangeSlot, string> = {
  headline: "Rewrote the hero into a short 2-line value proposition.",
  bullets: "Replaced dense copy with three short benefit bullets.",
  cta: "One primary action with a clearer, value-led label.",
};

const FIX_TONE = {
  border: "border-primary",
  fill: "bg-primary/15",
  stroke: "stroke-primary",
} as const;

const SEVERITY_RANK: Record<IssueDto["severity"], number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

function slotForIssue(issue: IssueDto): ChangeSlot {
  const t = `${issue.title} ${issue.category}`.toLowerCase();
  if (/headline|h1|title|subhead|value prop/i.test(t)) return "headline";
  if (/bullet|proof|benefit|trust|social|testimonial|logo/i.test(t))
    return "bullets";
  if (/\bcta\b|call to action|button label|button copy/i.test(t)) return "cta";
  if (/form|email|field|lead capture/i.test(t)) return "cta";
  return "headline";
}

function calloutTitle(slot: ChangeSlot, issue: IssueDto): string {
  const t = `${issue.title} ${issue.category}`.toLowerCase();
  if (slot === "cta" && !/\bcta\b|call to action|button/i.test(t)) {
    return issue.title;
  }
  return CHANGE_TITLE[slot];
}

function calloutWhat(slot: ChangeSlot, issue: IssueDto): string {
  const t = `${issue.title} ${issue.category}`.toLowerCase();
  if (slot === "cta" && !/\bcta\b|call to action|button/i.test(t)) {
    return (issue.suggestedFix || issue.description || "").replace(/\s+/g, " ").trim();
  }
  return CHANGE_WHAT[slot];
}

function whyLine(issue: IssueDto): string {
  const raw = (issue.psychology || issue.whyItMatters || issue.description || "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return raw || "Visitors hesitated because the offer was unclear.";
}

/** Pins that describe after-image changes, placed on THIS mockup's layout. */
function buildChangeCallouts(
  issues: IssueDto[],
  heroCutoff: number,
  layout: SlotLayout,
  mockupId: string
): IssueDto[] {
  const slots = SLOTS_BY_LAYOUT[layout];
  const used = new Set<ChangeSlot>();
  const ranked = [...issues].sort(
    (a, b) =>
      (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
  );
  const inHero = ranked.filter(
    (i) => i.annotationY == null || i.annotationY < heroCutoff
  );
  const pool = inHero.length > 0 ? inHero : ranked;
  const out: IssueDto[] = [];

  for (const issue of pool) {
    if (out.length >= 3) break;
    let slot = slotForIssue(issue);
    if (used.has(slot)) {
      const next = (["headline", "bullets", "cta"] as ChangeSlot[]).find(
        (s) => !used.has(s)
      );
      if (!next) break;
      slot = next;
    }
    used.add(slot);
    const box = slots[slot];
    out.push({
      ...issue,
      id: `change-${mockupId}-${issue.id}`,
      title: calloutTitle(slot, issue),
      description: calloutWhat(slot, issue),
      whyItMatters: whyLine(issue),
      psychology: whyLine(issue),
      suggestedFix: "",
      estimatedConversionImpact: "n/a",
      device: "desktop",
      annotationX: box.x,
      annotationY: box.y,
      annotationW: box.w,
      annotationH: box.h,
      severity: "LOW",
    });
  }

  return out;
}

const BOX_TONE: Record<
  keyof typeof SEVERITY_META,
  { border: string; fill: string; stroke: string }
> = {
  CRITICAL: {
    border: "border-destructive",
    fill: "bg-destructive/20",
    stroke: "stroke-destructive",
  },
  HIGH: {
    border: "border-destructive",
    fill: "bg-destructive/15",
    stroke: "stroke-destructive",
  },
  MEDIUM: {
    border: "border-warning",
    fill: "bg-warning/20",
    stroke: "stroke-warning",
  },
  LOW: {
    border: "border-primary",
    fill: "bg-primary/15",
    stroke: "stroke-primary",
  },
  INFO: {
    border: "border-muted-foreground",
    fill: "bg-muted/40",
    stroke: "stroke-muted-foreground",
  },
};

export function AnnotatedScreenshots({
  screenshots,
  issues,
  mockups = [],
  mockupPending = false,
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
            i.annotationY != null
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
        buildChangeCallouts(
          issues,
          heroCutoff,
          layoutForMockup(m, issues),
          m.id
        )
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
          <GeneratingMockup device={device} />
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

function boxFor(issue: IssueDto) {
  const w =
    issue.annotationW && issue.annotationW > 0
      ? issue.annotationW
      : DEFAULT_BOX_W;
  const h =
    issue.annotationH && issue.annotationH > 0
      ? issue.annotationH
      : DEFAULT_BOX_H;
  const cx = issue.annotationX ?? 0.5;
  const cy = issue.annotationY ?? 0.2;
  const left = Math.max(0, Math.min(1 - w, cx - w / 2));
  const top = Math.max(0, Math.min(1 - h, cy - h / 2));
  return { left, top, w, h, cx: left + w / 2, cy: top + h / 2 };
}

function placeLabels(
  pins: IssueDto[],
  containerW: number,
  containerH: number
) {
  const labelW = Math.min(0.42, LABEL_W_PX / Math.max(containerW, 1));
  const labelH = Math.min(0.08, LABEL_H_PX / Math.max(containerH, 1));
  const placed: {
    id: string;
    lx: number;
    ly: number;
    side: "left" | "right";
  }[] = [];

  for (const issue of pins) {
    const box = boxFor(issue);
    let side: "left" | "right" = box.cx < 0.55 ? "right" : "left";
    let lx = side === "right" ? box.left + box.w + 0.012 : box.left - labelW - 0.012;
    let ly = box.top;

    if (lx < 0.01) {
      side = "right";
      lx = box.left + box.w + 0.012;
    }
    if (lx + labelW > 0.99) {
      side = "left";
      lx = box.left - labelW - 0.012;
    }
    lx = Math.max(0.01, Math.min(0.99 - labelW, lx));
    ly = Math.max(0.004, Math.min(0.996 - labelH, ly));

    for (let attempt = 0; attempt < 8; attempt++) {
      const hit = placed.some(
        (p) =>
          Math.abs(p.lx - lx) < labelW && Math.abs(p.ly - ly) < labelH + 0.005
      );
      if (!hit) break;
      ly = Math.min(0.996 - labelH, ly + labelH + 0.008);
    }

    placed.push({ id: issue.id, lx, ly, side });
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
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {pins.map((issue) => {
          const box = boxFor(issue);
          const label = labels.get(issue.id);
          if (!label) return null;
          const tone = mode === "fixes" ? FIX_TONE : BOX_TONE[issue.severity];
          const x1 =
            (label.side === "right" ? label.lx : label.lx + labelW) * 100;
          const y1 = (label.ly + labelH / 2) * 100;
          const x2 =
            (label.side === "right" ? box.left + box.w : box.left) * 100;
          const y2 = box.cy * 100;
          return (
            <line
              key={`arrow-${issue.id}`}
              x1={`${x1}%`}
              y1={`${y1}%`}
              x2={`${x2}%`}
              y2={`${y2}%`}
              className={tone.stroke}
              strokeWidth={selectedIssueId === issue.id ? 2 : 1.25}
              opacity={selected && selected.id !== issue.id ? 0.25 : 0.85}
            />
          );
        })}
      </svg>

      {pins.map((issue, idx) => {
        const box = boxFor(issue);
        const label = labels.get(issue.id);
        if (!label) return null;
        const meta = SEVERITY_META[issue.severity];
        const tone = mode === "fixes" ? FIX_TONE : BOX_TONE[issue.severity];
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
          <React.Fragment key={issue.id}>
            <Mark
              id={interactive ? `callout-${issue.id}` : undefined}
              aria-label={interactive ? issue.title : undefined}
              aria-pressed={interactive ? isSelected : undefined}
              {...markProps}
              className={cn(
                "absolute z-10 rounded-md border-2 transition-all",
                tone.border,
                tone.fill,
                isSelected &&
                  "z-20 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] ring-2 ring-white/80",
                dimmed && "opacity-25"
              )}
              style={{
                left: `${box.left * 100}%`,
                top: `${box.top * 100}%`,
                width: `${box.w * 100}%`,
                height: `${box.h * 100}%`,
              }}
            >
              <span
                className={cn(
                  "absolute -left-2.5 -top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white shadow ring-2 ring-white/80",
                  meta.dot
                )}
              >
                {idx + 1}
              </span>
            </Mark>

            <Mark
              {...markProps}
              className={cn(
                "absolute z-20 flex max-w-[220px] items-center gap-1.5 rounded-full border bg-background/95 px-2 py-1 text-left shadow-md backdrop-blur transition-opacity",
                isSelected && "ring-2 ring-primary/40",
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
          </React.Fragment>
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

function GeneratingMockup({ device }: { device: "desktop" }) {
  return (
    <div className="mx-auto flex aspect-video max-w-full flex-col items-center justify-center gap-3 rounded-xl border bg-muted/30 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <div className="px-6">
        <p className="text-sm font-medium">Generating your redesign concept…</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Our AI is applying the top fixes to your hero.
        </p>
      </div>
    </div>
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
              : "Callouts mark what we changed on this concept — and why."}
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
