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
//
// Last refreshed from the Spiralyze Patterns library snapshots (Layout, Social
// Proof, Hero, and Modal filter views). A pattern can be tagged under multiple
// filters, so a few (e.g. Sticky Reviews, Real People) intentionally appear in
// more than one bucket with the sample size shown under that filter.
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
      { name: "Interactive Modal", uplift: 50, winRate: 43, sampleSize: 44 },
      { name: "Best Practice Baseline", uplift: 28, winRate: 36, sampleSize: 230 },
      { name: "Exit Modal", uplift: 27, winRate: 45, sampleSize: 277 },
      { name: "Longform Baseline", uplift: 27, winRate: 33, sampleSize: 137 },
      { name: "Form Over UI in Hero", uplift: 25, winRate: 48, sampleSize: 17 },
      { name: "Form in Modal", uplift: 24, winRate: 31, sampleSize: 218 },
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
      { name: "Modal", uplift: 12, winRate: 52, sampleSize: 1053 },
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
      { name: "Change Hero Image", uplift: 20, winRate: 44, sampleSize: 1657 },
      { name: "Logo", uplift: 18, winRate: 54, sampleSize: 116 },
      { name: "Show Interface", uplift: 17, winRate: 27, sampleSize: 198 },
      { name: "Hero Layout", uplift: 16, winRate: 38, sampleSize: 296 },
      { name: "Hero Redesign", uplift: 14, winRate: 40, sampleSize: 2808 },
      { name: "Replace Image with Video", uplift: 9, winRate: 32, sampleSize: 417 },
      { name: "Real People", uplift: 6, winRate: 46, sampleSize: 684 },
      { name: "Remove Video", uplift: 0, winRate: 48, sampleSize: 603 },
    ],
  },
  layout: {
    label: "layout & structure",
    patterns: [
      { name: "Best Practice Baseline", uplift: 28, winRate: 36, sampleSize: 229 },
      { name: "Longform Baseline", uplift: 27, winRate: 31, sampleSize: 138 },
      { name: "Form in Modal", uplift: 24, winRate: 31, sampleSize: 218 },
      { name: "Left Form Over UI", uplift: 24, winRate: 24, sampleSize: 115 },
      { name: "Features Grid", uplift: 17, winRate: 28, sampleSize: 94 },
      { name: "Sticky Reviews", uplift: 17, winRate: 23, sampleSize: 208 },
      { name: "Form on the Left", uplift: 15, winRate: 34, sampleSize: 247 },
      { name: "Radical Redesign", uplift: 15, winRate: 43, sampleSize: 9782 },
    ],
  },
  socialProof: {
    label: "trust & social proof",
    patterns: [
      { name: "Testimonials", uplift: 18, winRate: 33, sampleSize: 572 },
      { name: "Sticky Reviews", uplift: 17, winRate: 23, sampleSize: 238 },
      { name: "Review Ribbon", uplift: 17, winRate: 31, sampleSize: 338 },
      { name: "Reviews Summary", uplift: 13, winRate: 37, sampleSize: 828 },
      { name: "Trust Badges", uplift: 9, winRate: 38, sampleSize: 484 },
      { name: "Guarantee", uplift: 8, winRate: 35, sampleSize: 238 },
      { name: "Social Proof", uplift: 8, winRate: 42, sampleSize: 343 },
      { name: "Real People", uplift: 6, winRate: 46, sampleSize: 684 },
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
  { test: /form|field|input|sign[ -]?up|checkout|lead|modal|popup|overlay/i, key: "forms" },
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

  // Conservative 25th → 75th-percentile band = a realistic "typical winner"
  // range that avoids both the lowest outliers and an over-promise from the
  // top tail. Capped to keep the displayed number defensible.
  const LIFT_DISPLAY_CAP = 30;
  let low = Math.round(percentile(uplifts, 0.25));
  let high = Math.round(percentile(uplifts, 0.75));
  if (high <= low) high = Math.round(percentile(uplifts, 0.9));
  if (high <= low) high = low + 1;
  high = Math.min(high, LIFT_DISPLAY_CAP);
  low = Math.min(low, high - 1 < 1 ? high : high - 1);
  if (low < 1) low = 1;

  const winRate = Math.round(percentile(winRates, 0.5));

  // Use the MOST-TESTED pattern in the bucket as the representative comparable,
  // not the highest-uplift one — picking the max-uplift pattern would introduce
  // survivorship bias and over-promise.
  const topPattern = [...patterns].sort((a, b) => b.sampleSize - a.sampleSize)[0];
  // Report the single largest evidence base rather than summing sample sizes
  // across patterns (some share the same underlying experiments, so a sum
  // over-counts). The most-tested pattern is the credible anchor.
  const sampleSize = topPattern.sampleSize;

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

/**
 * Returns a display-ready, evidence-grounded lift label for an issue category
 * (e.g. "+8-17%"). Falls back to the provided estimate (typically the LLM's
 * per-issue guess) for categories with no comparable A/B pattern data.
 */
export function groundedLiftLabel(category: string, fallback: string): string {
  const trimmed = (fallback ?? "").trim();
  // Respect an explicitly not-applicable estimate (e.g. the blocked-page info
  // item) — never fabricate a lift range for a non-conversion finding.
  if (/^(n\/a|unknown|none|-)?$/i.test(trimmed)) return trimmed || "n/a";

  const lift = estimateRealisticLift(category);
  if (lift) return `+${lift.low}-${lift.high}%`;
  return trimmed || "n/a";
}

// ---------------------------------------------------------------------------
// Proven form-pattern briefs (structure only — used to drive mockup layouts)
// ---------------------------------------------------------------------------
// Subset of WIN_PATTERN_LIBRARY.forms that we can render as a visual "after".
// Each audit generates two of these in a rotating pair — never the full list.

export interface FormFixPattern {
  name: string;
  brief: string;
}

export const FORM_FIX_PATTERNS: FormFixPattern[] = [
  {
    name: "Form Over UI",
    brief: `LAYOUT PATTERN — FORM OVER UI:
- Keep the existing page / dashboard / app UI fully visible in the background (same chrome, photos, brand).
- Float a compact WHITE form CARD over that UI (elevated overlay), not an inline split and not a full-page takeover.
- The form card has a SMALL form title only — never a 3- or 4-line headline on the card itself.
- Page H1, if shown outside the card, is maximum 2 lines. The overlay form is the conversion focus.`,
  },
  {
    name: "Best Practice Baseline",
    brief: `LAYOUT PATTERN — BEST PRACTICE BASELINE:
- INLINE two-column conversion page (NOT a modal or overlay). Logo-only header.
- Value-prop column: short 2-line H1 + exactly 3 benefit bullets. Optional customer-logo strip under the bullets.
- Form column: SMALL form title (clearly smaller than the H1) + compact form with the original fields.
- Clean light conversion page — the form is in the layout, not floating over a dashboard.`,
  },
  {
    name: "Form Over UI With Copy",
    brief: `LAYOUT PATTERN — FORM OVER UI WITH COPY:
- Existing page UI stays visible (slightly dimmed is OK) in the background.
- Overlay card is a SIDE-BY-SIDE two-column white panel: LEFT column = 2-line H1 + exactly 3 checkmark bullets; RIGHT column = compact form with a SMALL form title.
- The copy column and the form column sit NEXT TO each other — never copy stacked above the form. This is a desktop layout.
- Not a 4-line H1. The overlay is a card, not the entire viewport.`,
  },
  {
    name: "Form on the Left",
    brief: `LAYOUT PATTERN — FORM ON THE LEFT:
- Two-column INLINE page (not a modal). The form column is on the LEFT.
- Value-prop column on the RIGHT: 2-line H1 + exactly 3 bullets.
- Small form title. Form is part of the page, not a floating overlay.`,
  },
  {
    name: "Form Positioning",
    brief: `LAYOUT PATTERN — FORM POSITIONING:
- Two-column INLINE page (not a modal). Form column clearly separated from the value-prop column (form typically on the RIGHT).
- Value-prop column: 2-line H1 + exactly 3 bullets. Small form title on the form. No overlay.`,
  },
  {
    name: "Multi-step Forms",
    brief: `LAYOUT PATTERN — MULTI-STEP FORMS:
- Show a clear progress indicator ("Step 1 of N" or a stepper). Only ONE question group is visible (2–4 fields on this step).
- Overlay card or inline split is fine, but it must read as step 1 of a multi-step form.
- Primary button is Next / Continue (not a final Submit-only if more steps remain).
- Still: 2-line page H1 if shown, exactly 3 bullets if copy is shown, small form title, logo-only nav.`,
  },
  {
    name: "Longform Baseline",
    brief: `LAYOUT PATTERN — LONGFORM BASELINE:
- INLINE split like the baseline, but the form shows MORE fields (6–10 visible) in a compact column — not a giant wall of inputs.
- Small form title. Opposite column: 2-line H1 + exactly 3 bullets. No overlay.`,
  },
  {
    name: "Form Center-Aligned",
    brief: `LAYOUT PATTERN — FORM CENTER-ALIGNED:
- A centered form card on the page (not a left/right split). Page UI / background remains visible around it.
- Small form title on the card. If copy appears, 2-line H1 + exactly 3 bullets sit above the card. Not a dimmed modal unless needed for contrast.`,
  },
  {
    name: "Form in Modal",
    brief: `LAYOUT PATTERN — FORM IN MODAL:
- Page UI is DIMMED / blurred behind a centered modal dialog (close X, backdrop).
- Modal contains the form with a SMALL form title. If copy is shown, the modal becomes SIDE-BY-SIDE two columns: copy (2-line H1 + exactly 3 bullets) on the LEFT, form on the RIGHT — never copy stacked above the form on desktop.
- Looks like a real product modal, not a full-page form.`,
  },
  {
    name: "Pre-filled Text Box",
    brief: `LAYOUT PATTERN — PRE-FILLED TEXT BOX:
- INLINE or overlay form is fine, but EVERY text input shows realistic SAMPLE values already typed in (name, work email, company, phone) — not empty placeholders.
- Still: 2-line H1, exactly 3 bullets if copy is shown, small form title, logo-only nav.`,
  },
];

export function formPatternStats(name: string): WinPattern | undefined {
  return WIN_PATTERN_LIBRARY.forms.patterns.find((p) => p.name === name);
}

/** Stable 32-bit hash so the same seed always starts at the same catalog index. */
export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Next `count` form patterns from the rotating catalog, wrapping at the end. */
export function pickRotatingFormPatterns(
  seed: string,
  count = 2
): Array<FormFixPattern & Partial<WinPattern>> {
  const list = FORM_FIX_PATTERNS;
  if (list.length === 0) return [];
  const start = hashSeed(seed) % list.length;
  return Array.from({ length: Math.min(count, list.length) }, (_, i) => {
    const pattern = list[(start + i) % list.length];
    const stats = formPatternStats(pattern.name);
    return { ...pattern, ...stats };
  });
}
