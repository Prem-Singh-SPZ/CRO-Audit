import type { IssueInput, PageContext, ReportJson } from "@cro/shared";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function haystack(ctx: PageContext): string {
  const bits = [
    ctx.copyText,
    ctx.title,
    ctx.metaDescription,
    ...ctx.headings.h1,
    ...ctx.headings.h2,
    ...ctx.headings.h3,
    ...ctx.ctaTexts,
    ...ctx.navLinks.map((l) => l.text),
    ...ctx.forms.flatMap((f) => [
      f.submitText,
      ...f.fields.map((x) => x.label || x.name || x.placeholder),
    ]),
  ];
  return normalize(bits.filter(Boolean).join(" "));
}

function quotedPhrases(text: string): string[] {
  const out: string[] = [];
  const re = /["“”']([^"“”']{6,90})["“”']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push(m[1] ?? "");
  }
  return out;
}

/**
 * True when the issue cites wording that actually appears on the crawled page.
 * Thin / SPA crawls skip the check so we do not drop screenshot-only findings.
 */
export function issueIsGrounded(issue: IssueInput, ctx: PageContext): boolean {
  if (ctx.clientRendered && (ctx.copyText?.length ?? 0) < 80) return true;
  const hay = haystack(ctx);
  if (hay.length < 40) return true;

  const blob = `${issue.title} ${issue.description} ${issue.whyItMatters} ${issue.psychology ?? ""}`;
  for (const quote of quotedPhrases(blob)) {
    const n = normalize(quote);
    if (n.length >= 6 && hay.includes(n)) return true;
  }

  const words = normalize(issue.description)
    .split(" ")
    .filter((w) => w.length >= 5);
  if (words.length === 0) return false;
  const hits = words.filter((w) => hay.includes(w)).length;
  const need = Math.min(3, Math.max(1, Math.ceil(words.length * 0.25)));
  return hits >= need;
}

export function applyQuoteGate(
  report: ReportJson,
  ctx: PageContext
): ReportJson {
  const kept = report.issues.filter((issue) => issueIsGrounded(issue, ctx));
  return { ...report, issues: kept };
}
