import type { CompetitorCompareDto, PageContext } from "@cro/shared";
import { safeHost } from "@cro/shared";

const GENERIC_CTA =
  /^(submit|send|go|ok|continue|next|learn more|read more|click here|more|view more|see more|explore|discover)$/i;

const VALUE_WORDS =
  /(free|save|grow|boost|increase|faster|instantly|without|guarantee|proven|results|revenue|convert|leads?|automate|simplify|in \d|%|x\b|double|triple)/i;

const DIMENSIONS = [
  { key: "hero", label: "Hero clarity" },
  { key: "trust", label: "Trust signals" },
  { key: "socialProof", label: "Social proof" },
  { key: "cta", label: "Call to action" },
  { key: "forms", label: "Forms" },
] as const;

function clamp10(n: number) {
  return Math.max(0, Math.min(10, Math.round(n)));
}

function scorePage(ctx: PageContext): Record<string, number> {
  if (ctx.blocked) {
    return { hero: 5, trust: 5, socialProof: 5, cta: 5, forms: 5 };
  }

  const h1 = ctx.headings.h1[0] ?? "";
  const hero =
    (h1 ? 4 : 1) +
    (VALUE_WORDS.test(h1) ? 3 : 0) +
    (h1.length > 12 && h1.length < 90 ? 2 : 0) +
    (ctx.wordCount > 80 ? 1 : 0);

  const trust =
    (ctx.hasTrustBadges ? 5 : 1) +
    (ctx.isHttps ? 2 : 0) +
    (ctx.hasPricing ? 2 : 0) +
    (ctx.metaDescription ? 1 : 0);

  const socialProof =
    (ctx.hasSocialProof ? 4 : 1) +
    (ctx.hasTestimonials ? 4 : 0) +
    (ctx.hasVideo ? 2 : 0);

  const ctas = ctx.ctaTexts.filter(Boolean);
  const strongCtas = ctas.filter((t) => !GENERIC_CTA.test(t.trim()));
  const cta =
    (ctas.length > 0 ? 3 : 1) +
    (strongCtas.length > 0 ? 4 : 0) +
    (ctx.buttons.some((b) => b.isPrimary) ? 2 : 0) +
    (strongCtas.length > 1 ? 1 : 0);

  const form = ctx.forms[0];
  const forms =
    (ctx.forms.length > 0 ? 4 : 2) +
    (form && form.fieldCount > 0 && form.fieldCount <= 6 ? 3 : 0) +
    (form?.submitText ? 2 : 0) +
    (form && form.fieldCount > 8 ? -1 : 1);

  return {
    hero: clamp10(hero),
    trust: clamp10(trust),
    socialProof: clamp10(socialProof),
    cta: clamp10(cta),
    forms: clamp10(forms),
  };
}

const GAP_COPY: Record<string, string> = {
  hero: "Sharpen the above-the-fold headline so the benefit is obvious in two lines.",
  trust: "Add visible trust marks (logos, guarantees, security) near the primary CTA.",
  socialProof: "Put verified reviews or customer proof above the fold.",
  cta: "Rewrite the primary CTA to a specific outcome instead of a generic label.",
  forms: "Shorten the lead form and give it a clear, value-led submit label.",
};

export function buildCompetitorCompare(
  you: PageContext,
  them: PageContext
): CompetitorCompareDto {
  const yours = scorePage(you);
  const theirs = scorePage(them);
  const dimensions = DIMENSIONS.map((d) => ({
    key: d.key,
    label: d.label,
    you: yours[d.key],
    them: theirs[d.key],
  }));

  const widest = [...dimensions].sort((a, b) => b.them - b.you - (a.them - a.you))[0];
  const topGap =
    widest && widest.them > widest.you
      ? GAP_COPY[widest.key]
      : "You lead on these signals — keep testing the current layout.";

  return {
    host: safeHost(you.finalUrl || you.url),
    competitorHost: safeHost(them.finalUrl || them.url),
    dimensions,
    topGap,
  };
}
