import type { IssueDto, MockupDto, ReportResponse } from "@cro/shared";

const HERO_WIDTH = 1440;
const HERO_HEIGHT = 900;

const FILLER_BULLETS = [
  "Lead with one clear next step",
  "Show proof next to the ask",
  "Cut friction on the first screen",
];

export function clipCopy(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function severityRank(issue: IssueDto): number {
  if (issue.severity === "HIGH") return 0;
  if (issue.severity === "MEDIUM") return 1;
  if (issue.severity === "LOW") return 2;
  return 3;
}

/**
 * Build a guaranteed visual "after" from the real screenshot when Gemini
 * image generation returns nothing.
 */
export function composeMockup(data: ReportResponse): MockupDto | null {
  if (data.mockupSeed?.image) {
    const mime = data.mockupSeed.mimeType || "image/jpeg";
    return {
      id: "composed-concept",
      device: "desktop",
      url: `data:${mime};base64,${data.mockupSeed.image}`,
      width: HERO_WIDTH,
      height: HERO_HEIGHT,
      patternName: "Concept preview",
      source: "composed",
    };
  }
  const shot =
    data.screenshots.find((s) => s.device === "desktop" && s.url) ??
    data.screenshots.find((s) => s.url);
  if (!shot) return null;
  return {
    id: "composed-concept",
    device: "desktop",
    url: shot.url,
    width: shot.width,
    height: shot.height,
    patternName: "Concept preview",
    source: "composed",
  };
}

export function conceptCopy(issues: IssueDto[]): {
  headline: string;
  bullets: string[];
} {
  const ranked = [...issues].sort(
    (a, b) => severityRank(a) - severityRank(b)
  );
  const copyish = ranked.find((i) =>
    /copy|clarity|headline|hero|value|message/i.test(`${i.category} ${i.title}`)
  );
  const lead = copyish ?? ranked[0];
  const headline = clipCopy(lead?.title ?? "Make the offer unmistakable", 72);
  const bullets = ranked
    .filter((i) => i !== lead)
    .slice(0, 3)
    .map((i) => clipCopy(i.title, 56));
  while (bullets.length < 3) {
    bullets.push(FILLER_BULLETS[bullets.length] ?? FILLER_BULLETS[0]);
  }
  return { headline, bullets };
}
