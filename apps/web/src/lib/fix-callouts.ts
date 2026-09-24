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

/**
 * Keep every measured box. A center pasted on the bottom edge is the logo
 * row, not the headline — slide that headline up into the title band and
 * pull any box fully onto the image.
 */
function settleBox(slot: ChangeSlot, box: MockupRegionBox): MockupRegionBox {
  let { x, y, w, h } = box;
  if (slot === "headline" && y > 0.72) {
    y = Math.min(0.42, 0.16 + h / 2);
  }
  x = Math.max(w / 2, Math.min(1 - w / 2, x));
  y = Math.max(h / 2, Math.min(1 - h / 2, y));
  return { x, y, w, h };
}

function whyLine(issue: IssueDto): string {
  const raw = (issue.psychology || issue.whyItMatters || issue.description || "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return raw || "Visitors hesitated because the offer was unclear.";
}

const SLOT_ORDER: ChangeSlot[] = ["headline", "bullets", "cta"];

function pinFor(
  issue: IssueDto,
  slot: ChangeSlot,
  box: MockupRegionBox,
  mockupId: string
): IssueDto {
  return {
    ...issue,
    id: `change-${mockupId}-${slot}`,
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
  };
}

/**
 * Pins for the redesign. Every measured headline, benefit list, and button
 * is drawn. A finding is used when its title matches that element; a
 * navigation finding is never moved onto the button.
 */
export function buildChangeCallouts(
  issues: IssueDto[],
  heroCutoff: number,
  regions: MockupRegions | undefined,
  mockupId: string
): IssueDto[] {
  if (!regions) return [];
  const ranked = [...issues].sort(
    (a, b) =>
      (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
  );
  const inHero = ranked.filter(
    (i) => i.annotationY == null || i.annotationY < heroCutoff
  );
  const pool = inHero.length > 0 ? inHero : ranked;
  const matched = new Map<ChangeSlot, IssueDto>();
  for (const issue of pool) {
    const slot = slotForIssue(issue);
    if (!slot || matched.has(slot) || !regions[slot]) continue;
    matched.set(slot, issue);
  }

  const fallback = pool[0] ?? ranked[0];
  const out: IssueDto[] = [];
  for (const slot of SLOT_ORDER) {
    const raw = regions[slot];
    if (!raw) continue;
    const issue = matched.get(slot) ?? fallback;
    if (!issue) continue;
    out.push(pinFor(issue, slot, settleBox(slot, raw), mockupId));
  }
  return out;
}
