// ---------------------------------------------------------------------------
// Score categories used across the AI report, gauges, radar chart, and cards.
// ---------------------------------------------------------------------------

export const SCORE_CATEGORIES = [
  "hero",
  "trust",
  "cta",
  "copy",
  "design",
  "forms",
  "accessibility",
  "performance",
  "mobile",
  "psychology",
  "seo",
  "navigation",
] as const;

export type ScoreCategory = (typeof SCORE_CATEGORIES)[number];

export const SCORE_CATEGORY_LABELS: Record<ScoreCategory, string> = {
  hero: "Hero Section",
  trust: "Trust & Credibility",
  cta: "Call to Action",
  copy: "Copywriting",
  design: "Visual Design",
  forms: "Forms & Lead Capture",
  accessibility: "Accessibility",
  performance: "Performance",
  mobile: "Mobile UX",
  psychology: "Persuasion Psychology",
  seo: "SEO Basics",
  navigation: "Navigation & IA",
};

export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
export type SeverityLevel = (typeof SEVERITIES)[number];

export const DEVICES = ["desktop", "tablet", "mobile"] as const;
export type Device = (typeof DEVICES)[number];

export const DEVICE_VIEWPORTS: Record<
  Device,
  { width: number; height: number; label: string; isMobile: boolean }
> = {
  desktop: { width: 1440, height: 900, label: "Desktop", isMobile: false },
  tablet: { width: 834, height: 1112, label: "Tablet", isMobile: true },
  mobile: { width: 390, height: 844, label: "Mobile", isMobile: true },
};
