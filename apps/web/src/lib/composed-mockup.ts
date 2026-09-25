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

const HEADLINE_FALLBACK = "Make the offer unmistakable";

// Audit issues can carry terse diagnostic titles ("h1", "Hero Copy",
// "Primary Form CTA"). Those are labels, not copy — shown raw on the concept
// card they read as broken. Map them to a human line by topic instead.
const TERSE_TITLE_TEMPLATES: [RegExp, string][] = [
  [
    /\bh1\b|headline|hero|value prop|\bcopy\b|messag/i,
    "A headline that says what you do in one clear line",
  ],
  [/\bcta\b|button|call to action/i, "One primary call to action, value-led"],
  [/form|field|lead|email|capture/i, "A shorter form that only asks what matters"],
  [/trust|proof|testimonial|logo|review|badge/i, "Proof and logos next to the ask"],
  [/nav|menu|header/i, "A header stripped to logo and one action"],
];

/** A title reads as copy only if it's an actual phrase, not a label. */
function humanizeTitle(title: string): string | null {
  const t = title.replace(/\s+/g, " ").trim();
  if (t.length >= 16 && t.split(" ").length >= 4) return t;
  for (const [re, text] of TERSE_TITLE_TEMPLATES) {
    if (re.test(t)) return text;
  }
  return null;
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
  const headline = clipCopy(
    (lead ? humanizeTitle(lead.title) : null) ?? HEADLINE_FALLBACK,
    72
  );
  const bullets: string[] = [];
  for (const i of ranked) {
    if (i === lead || bullets.length >= 3) continue;
    const line = humanizeTitle(i.title);
    if (!line) continue;
    const clipped = clipCopy(line, 56);
    if (clipped === headline || bullets.includes(clipped)) continue;
    bullets.push(clipped);
  }
  for (const filler of FILLER_BULLETS) {
    if (bullets.length >= 3) break;
    if (!bullets.includes(filler)) bullets.push(filler);
  }
  return { headline, bullets };
}
