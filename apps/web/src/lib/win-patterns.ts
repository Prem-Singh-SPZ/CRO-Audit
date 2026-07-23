// ---------------------------------------------------------------------------
// Spiralyze proven-pattern knowledge base
// ---------------------------------------------------------------------------
// A curated snapshot of Spiralyze's A/B-test pattern library: real winning
// experiments with their measured uplift, win rate, and sample size. We use
// this to ground the report's "fix output" in realistic, evidence-backed lift
// ranges instead of a purely AI-guessed number.
//
// Each entry: uplift = observed conversion lift of the winning variant (%),
// winRate = share of tests of this pattern that won (%), sampleSize = number
// of A/B experiments the figures are drawn from.
// ---------------------------------------------------------------------------

export interface WinPattern {
  name: string;
  uplift: number; // %
  winRate: number; // %
  sampleSize: number; // # of A/B tests
}

export type PatternCategoryKey =
  | "forms"
  | "copy"
  | "pricing"
  | "ctas"
  | "hero"
  | "layout"
  | "socialProof";

export const WIN_PATTERN_LIBRARY: Record<
  PatternCategoryKey,
  { label: string; patterns: WinPattern[] }
> = {
  forms: {
    label: "form & lead-capture",
    patterns: [
      { name: "Best Practice Baseline", uplift: 28, winRate: 36, sampleSize: 230 },
      { name: "Longform Baseline", uplift: 27, winRate: 33, sampleSize: 137 },
      { name: "Form Over UI in Hero", uplift: 25, winRate: 48, sampleSize: 17 },
      { name: "Form in Modal", uplift: 24, winRate: 30, sampleSize: 217 },
      { name: "Left Form Over UI", uplift: 24, winRate: 24, sampleSize: 115 },
      { name: "Double Column Form", uplift: 23, winRate: 36, sampleSize: 138 },
      { name: "Form Over UI With Copy", uplift: 21, winRate: 30, sampleSize: 74 },
      { name: "Form Over UI", uplift: 18, winRate: 50, sampleSize: 270 },
      { name: "Form Center-Aligned", uplift: 18, winRate: 48, sampleSize: 106 },
      { name: "Form Positioning", uplift: 18, winRate: 30, sampleSize: 97 },
      { name: "Form Over UI With Social Proof", uplift: 18, winRate: 14, sampleSize: 34 },
      { name: "Form on the Left", uplift: 15, winRate: 34, sampleSize: 749 },
      { name: "Sliding Form", uplift: 14, winRate: 36, sampleSize: 210 },
      { name: "Multi-step Forms", uplift: 14, winRate: 54, sampleSize: 382 },
      { name: "Natural Language Forms", uplift: 13, winRate: 33, sampleSize: 20 },
      { name: "Pre-filled Text Box", uplift: 13, winRate: 41, sampleSize: 20 },
    ],
  },
  copy: {
    label: "headline & copy",
    patterns: [
      { name: "Big Claim Headline", uplift: 26, winRate: 43, sampleSize: 284 },
      { name: "Quantitative Headline", uplift: 21, winRate: 35, sampleSize: 372 },
      { name: "CTA Copy Change", uplift: 15, winRate: 36, sampleSize: 8527 },
      { name: "Subhead", uplift: 14, winRate: 40, sampleSize: 320 },
      { name: "Personal Headline", uplift: 14, winRate: 38, sampleSize: 1151 },
      { name: "Superhead", uplift: 11, winRate: 33, sampleSize: 70 },
      { name: "Headline", uplift: 5, winRate: 47, sampleSize: 328 },
      { name: "Subhead Copy Change", uplift: 5, winRate: 36, sampleSize: 1235 },
    ],
  },
  pricing: {
    label: "pricing",
    patterns: [
      { name: "Anchoring", uplift: 41, winRate: 45, sampleSize: 173 },
      { name: "Change Pricing", uplift: 39, winRate: 43, sampleSize: 771 },
      { name: "Single Annual-Monthly Toggle", uplift: 33, winRate: 34, sampleSize: 27 },
      { name: "Change Pricing Card Layout / Design", uplift: 17, winRate: 41, sampleSize: 407 },
      { name: "More Expensive First", uplift: 14, winRate: 24, sampleSize: 112 },
      { name: "Savings", uplift: 10, winRate: 42, sampleSize: 144 },
      { name: "Pricing Cards & Features Combined", uplift: 7, winRate: 34, sampleSize: 32 },
    ],
  },
  ctas: {
    label: "call-to-action",
    patterns: [
      { name: "Sticky CTA", uplift: 23, winRate: 39, sampleSize: 342 },
      { name: "Dual CTA", uplift: 22, winRate: 48, sampleSize: 1284 },
      { name: "Add CTA", uplift: 16, winRate: 49, sampleSize: 1986 },
      { name: "CTA Copy Change", uplift: 15, winRate: 36, sampleSize: 8527 },
      { name: "Email Plus CTA", uplift: 14, winRate: 34, sampleSize: 284 },
      { name: "Search Bar / Button", uplift: 9, winRate: 51, sampleSize: 158 },
      { name: "CTA Size", uplift: 6, winRate: 36, sampleSize: 177 },
      { name: "CTA Color Change", uplift: 6, winRate: 36, sampleSize: 2199 },
    ],
  },
  hero: {
    label: "hero section",
    patterns: [
      { name: "Hero Size", uplift: 31, winRate: 36, sampleSize: 88 },
      { name: "Locked Hero", uplift: 24, winRate: 34, sampleSize: 119 },
      { name: "Baseline Hero", uplift: 23, winRate: 36, sampleSize: 167 },
      { name: "Change Hero Image", uplift: 17, winRate: 43, sampleSize: 1650 },
      { name: "Hero Layout", uplift: 16, winRate: 38, sampleSize: 296 },
      { name: "Hero Redesign", uplift: 14, winRate: 40, sampleSize: 2808 },
    ],
  },
  layout: {
    label: "layout & structure",
    patterns: [
      { name: "Best Practice Baseline", uplift: 28, winRate: 36, sampleSize: 230 },
      { name: "Longform Baseline", uplift: 27, winRate: 33, sampleSize: 137 },
      { name: "Form in Modal", uplift: 24, winRate: 30, sampleSize: 217 },
      { name: "Left Form Over UI", uplift: 24, winRate: 24, sampleSize: 115 },
      { name: "Sticky Reviews", uplift: 17, winRate: 23, sampleSize: 212 },
      { name: "Features Grid", uplift: 15, winRate: 27, sampleSize: 94 },
      { name: "Form on the Left", uplift: 15, winRate: 34, sampleSize: 249 },
      { name: "Radical Redesign", uplift: 15, winRate: 43, sampleSize: 9754 },
    ],
  },
  socialProof: {
    label: "trust & social proof",
    patterns: [
      { name: "Sticky Reviews", uplift: 17, winRate: 23, sampleSize: 212 },
      { name: "Form Over UI With Social Proof", uplift: 18, winRate: 14, sampleSize: 34 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Mapping the audit's free-text issue categories onto pattern buckets.
// ---------------------------------------------------------------------------

// Exact, normalized category names we know the audit engine emits.
const DIRECT_CATEGORY_MAP: Record<string, PatternCategoryKey> = {
  headline: "copy",
  copy: "copy",
  copywriting: "copy",
  messaging: "copy",
  "value proposition": "copy",
  cta: "ctas",
  "call to action": "ctas",
  forms: "forms",
  "forms & lead capture": "forms",
  "lead capture": "forms",
  pricing: "pricing",
  hero: "hero",
  "hero section": "hero",
  engagement: "hero",
  "trust signals": "socialProof",
  trust: "socialProof",
  "trust & credibility": "socialProof",
  "social proof": "socialProof",
  "objection handling": "copy",
  "visual hierarchy": "layout",
  "visual design": "layout",
  design: "layout",
  navigation: "layout",
  "navigation & ia": "layout",
  "mobile ux": "layout",
  mobile: "layout",
  "conversion friction": "forms",
};

// Keyword fallback for anything a live LLM might return that isn't an exact
// match above. Order matters — most specific keywords first.
const KEYWORD_RULES: { test: RegExp; key: PatternCategoryKey }[] = [
  { test: /pric|plan|tier|subscription/i, key: "pricing" },
  { test: /form|field|input|sign[ -]?up|checkout|lead/i, key: "forms" },
  { test: /cta|button|call to action/i, key: "ctas" },
  { test: /hero|above the fold|banner|video/i, key: "hero" },
  { test: /trust|social|review|testimonial|logo|badge/i, key: "socialProof" },
  { test: /headline|copy|messag|value prop|wording|text/i, key: "copy" },
  { test: /nav|layout|hierarch|visual|mobile|design|structure/i, key: "layout" },
];

export function patternCategoryForIssue(
  issueCategory: string
): PatternCategoryKey | null {
  const norm = issueCategory.trim().toLowerCase();
  if (norm in DIRECT_CATEGORY_MAP) return DIRECT_CATEGORY_MAP[norm];
  for (const rule of KEYWORD_RULES) {
    if (rule.test.test(norm)) return rule.key;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Realistic lift estimate
// ---------------------------------------------------------------------------

export interface RealisticLift {
  categoryLabel: string;
  low: number; // conservative end of the realistic winning range (%)
  high: number; // strong end of the realistic winning range (%)
  winRate: number; // median win rate across the matched patterns (%)
  sampleSize: number; // total A/B tests behind the estimate
  patternCount: number;
  topPattern: WinPattern; // strongest comparable winning pattern
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

/**
 * Derive a realistic, evidence-backed conversion-lift range for an audit issue
 * by matching its category to Spiralyze's proven pattern library. Returns null
 * when the category has no comparable pattern data (e.g. performance, SEO,
 * accessibility) so the caller can fall back to the AI estimate.
 */
export function estimateRealisticLift(
  issueCategory: string
): RealisticLift | null {
  const key = patternCategoryForIssue(issueCategory);
  if (!key) return null;

  const bucket = WIN_PATTERN_LIBRARY[key];
  const patterns = bucket.patterns;
  if (patterns.length === 0) return null;

  const uplifts = patterns.map((p) => p.uplift).sort((a, b) => a - b);
  const winRates = patterns.map((p) => p.winRate).sort((a, b) => a - b);

  // Median → 90th-percentile band = a realistic "typical winner to strong
  // winner" range, avoiding both the lowest outliers and an over-promise.
  let low = Math.round(percentile(uplifts, 0.5));
  let high = Math.round(percentile(uplifts, 0.9));
  if (high <= low) high = Math.max(...uplifts);
  if (high <= low) high = low + 1;

  const winRate = Math.round(percentile(winRates, 0.5));
  const sampleSize = patterns.reduce((sum, p) => sum + p.sampleSize, 0);

  // Strongest comparable winner with a non-trivial sample size for credibility;
  // fall back to the highest-uplift pattern overall.
  const credible = patterns.filter((p) => p.sampleSize >= 50);
  const pool = credible.length > 0 ? credible : patterns;
  const topPattern = [...pool].sort((a, b) => b.uplift - a.uplift)[0];

  return {
    categoryLabel: bucket.label,
    low,
    high,
    winRate,
    sampleSize,
    patternCount: patterns.length,
    topPattern,
  };
}
