import type { IssueDto, MockupRegions, MockupRegionBox } from "@cro/shared";

type ChangeSlot = "headline" | "bullets" | "cta";

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

const SEVERITY_RANK: Record<IssueDto["severity"], number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

function slotForIssue(issue: IssueDto): ChangeSlot | null {
  const title = issue.title.toLowerCase();
  // Navigation findings are not the headline, the bullets, or the button.
  if (/\bnav(igation)?\b|\bheader\b|\bmenu\b|\bfooter\b/.test(title)) return null;
  if (/\bheadline\b|\bh1\b|\bsubhead\b|value prop/.test(title)) return "headline";
  if (/\bbullet|\bbenefit|\bproof\b|\btrust\b|\btestimonial/.test(title))
    return "bullets";
  if (/\bcta\b|call to action|\bbutton\b/.test(title)) return "cta";
  if (/\bform\b|\bemail\b|\bfield\b|lead capture/.test(title)) return "cta";
  return null;
}

function calloutTitle(slot: ChangeSlot): string {
  return CHANGE_TITLE[slot];
}

function calloutWhat(slot: ChangeSlot): string {
  return CHANGE_WHAT[slot];
}

function whyLine(issue: IssueDto): string {
  const raw = (issue.psychology || issue.whyItMatters || issue.description || "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return raw || "Visitors hesitated because the offer was unclear.";
}

/**
 * Pins for the redesign. A box is drawn only where the finished image
 * actually contains that element. Unmatched findings are not moved onto
 * a leftover slot.
 */
export function buildChangeCallouts(
  issues: IssueDto[],
  heroCutoff: number,
  regions: MockupRegions | undefined,
  mockupId: string
): IssueDto[] {
  if (!regions) return [];
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
    const slot = slotForIssue(issue);
    if (!slot || used.has(slot)) continue;
    const box: MockupRegionBox | undefined = regions[slot];
    if (!box) continue;
    used.add(slot);
    out.push({
      ...issue,
      id: `change-${mockupId}-${issue.id}`,
      title: calloutTitle(slot),
      description: calloutWhat(slot),
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
