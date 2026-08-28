import type {
  SeverityLevel,
  ComplexityLevel,
  DiyRiskLevel,
  CategoryScores,
} from "@cro/shared";

// Anchor for the sticky booking panel + a smooth-scroll helper reused by the
// header CTA, the revenue calculator, and the flaw cards.
export const BOOKING_ANCHOR_ID = "book-call";

export function scrollToBooking() {
  if (typeof document === "undefined") return;
  document
    .getElementById(BOOKING_ANCHOR_ID)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export const COMPLEXITY_META: Record<
  ComplexityLevel,
  { label: string; badge: string }
> = {
  High: { label: "High complexity", badge: "bg-destructive/10 text-destructive" },
  Medium: { label: "Medium complexity", badge: "bg-warning/15 text-warning" },
  Low: { label: "Low complexity", badge: "bg-muted text-muted-foreground" },
};

export const DIY_RISK_META: Record<
  DiyRiskLevel,
  { label: string; badge: string }
> = {
  "High Risk": {
    label: "High DIY risk",
    badge: "bg-destructive/10 text-destructive",
  },
  "Moderate Risk": {
    label: "Moderate DIY risk",
    badge: "bg-warning/15 text-warning",
  },
  "Low Risk": { label: "Low DIY risk", badge: "bg-muted text-muted-foreground" },
};

export const SEVERITY_META: Record<
  SeverityLevel,
  { label: string; badge: string; dot: string; accent: string; order: number }
> = {
  CRITICAL: {
    label: "Critical",
    badge: "bg-destructive text-destructive-foreground",
    dot: "bg-destructive",
    accent: "border-l-destructive",
    order: 0,
  },
  HIGH: {
    label: "High",
    badge: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    accent: "border-l-destructive",
    order: 1,
  },
  MEDIUM: {
    label: "Medium",
    badge: "bg-warning/15 text-warning",
    dot: "bg-warning",
    accent: "border-l-warning",
    order: 2,
  },
  LOW: {
    label: "Low",
    badge: "bg-primary/10 text-primary",
    dot: "bg-primary",
    accent: "border-l-primary",
    order: 3,
  },
  INFO: {
    label: "Info",
    badge: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    accent: "border-l-muted-foreground",
    order: 4,
  },
};

export const PRIORITY_META: Record<
  "high" | "medium" | "low",
  { label: string; className: string }
> = {
  high: { label: "High priority", className: "bg-destructive/10 text-destructive" },
  medium: { label: "Medium priority", className: "bg-warning/15 text-warning" },
  low: { label: "Low priority", className: "bg-success/15 text-success" },
};

// ---------------------------------------------------------------------------
// Grouped scorecard — collapses the 12 fine-grained category scores into the
// three high-level pillars shown on the scan screen and the report summary
// (mirrors the Coframe-style "Clarity / Design / Conversion" breakdown).
// ---------------------------------------------------------------------------

export type ScoreGroupKey = "clarity" | "design" | "conversion";

export const SCORE_GROUPS: {
  key: ScoreGroupKey;
  label: string;
  members: (keyof CategoryScores)[];
}[] = [
  {
    key: "clarity",
    label: "Clarity & Messaging",
    members: ["hero", "copy", "psychology", "seo"],
  },
  {
    key: "design",
    label: "Design & Performance",
    members: ["design", "performance", "accessibility", "mobile"],
  },
  {
    key: "conversion",
    label: "Conversion & Growth",
    members: ["cta", "trust", "forms", "navigation"],
  },
];

export function gradeFor(score: number): "Good" | "Fair" | "Poor" {
  if (score >= 70) return "Good";
  if (score >= 45) return "Fair";
  return "Poor";
}

/** Averages the member category scores into the three display pillars. */
export function groupCategoryScores(
  scores: CategoryScores
): { key: ScoreGroupKey; label: string; score: number; grade: string }[] {
  return SCORE_GROUPS.map((group) => {
    const values = group.members.map((m) => scores[m] ?? 0);
    const avg = values.length
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      : 0;
    return { key: group.key, label: group.label, score: avg, grade: gradeFor(avg) };
  });
}
