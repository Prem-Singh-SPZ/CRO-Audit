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

/** Center glued to the bottom edge means the locator missed the element. */
function bottomPinned(box: MockupRegionBox): boolean {
  return box.y >= 0.98;
}

function clampBox(box: MockupRegionBox): MockupRegionBox {
  const { w, h } = box;
  return {
    x: Math.max(w / 2, Math.min(1 - w / 2, box.x)),
    y: Math.max(h / 2, Math.min(1 - h / 2, box.y)),
    w,
    h,
  };
}

/**
 * Keep measured width and horizontal position. When the locator pasted a
 * center on the bottom edge, stack the headline and benefits in the hero
 * and sit the button beside that stack.
 */
function settleRegions(regions: MockupRegions): MockupRegions {
  const headline = regions.headline ? { ...regions.headline } : undefined;
  const bullets = regions.bullets ? { ...regions.bullets } : undefined;
  const cta = regions.cta ? { ...regions.cta } : undefined;
  const gap = 0.028;
  let cursor = 0.32;
  if (headline && bottomPinned(headline)) {
    headline.y = cursor + headline.h / 2;
    cursor = headline.y + headline.h / 2 + gap;
  } else if (headline) {
    cursor = Math.max(cursor, headline.y + headline.h / 2 + gap);
  }
  if (bullets && bottomPinned(bullets)) {
    bullets.y = cursor + bullets.h / 2;
    cursor = bullets.y + bullets.h / 2;
  }
  if (cta && bottomPinned(cta)) {
    const top = headline ? headline.y - headline.h / 2 : 0.32;
    const bottom = bullets ? bullets.y + bullets.h / 2 : cursor;
    cta.y = (top + bottom) / 2;
  }
  return {
    ...(headline ? { headline: clampBox(headline) } : {}),
    ...(bullets ? { bullets: clampBox(bullets) } : {}),
    ...(cta ? { cta: clampBox(cta) } : {}),
  };
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
  const seated = settleRegions(regions);
  const out: IssueDto[] = [];
  for (const slot of SLOT_ORDER) {
    const raw = seated[slot];
    if (!raw) continue;
    const issue = matched.get(slot) ?? fallback;
    if (!issue) continue;
    out.push(pinFor(issue, slot, raw, mockupId));
  }
  return out;
}
