import type {
  ReportJson,
  IssueInput,
  RecommendationInput,
  PageContext,
  LighthouseSummary,
  ScoreCategory,
  SeverityLevel,
} from "@/lib/cro";
import { reportSchema, SCORE_CATEGORIES } from "@/lib/cro";

export interface AnalyzeInput {
  pageContext: PageContext;
  lighthouse: LighthouseSummary;
}

const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(n)));

const truncate = (s: string, n = 60) =>
  s.length > n ? `${s.slice(0, n - 1).trim()}…` : s;

// CTA labels that test poorly because they describe the mechanic, not the value.
const GENERIC_CTA =
  /^(submit|send|go|ok|continue|next|learn more|read more|click here|more|view more|see more|explore|discover)$/i;

// Words that signal a benefit / outcome-oriented headline.
const VALUE_WORDS =
  /(free|save|grow|boost|increase|faster|instantly|without|guarantee|proven|results|revenue|convert|leads?|automate|simplify|in \d|%|x\b|double|triple)/i;

// Deterministic jitter seeded by the URL so repeat scans stay stable.
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * Produces a page-specific CRO report using heuristics over the cheerio crawl +
 * PageSpeed metrics. It inspects the *actual* headline text, CTA labels, form
 * fields, navigation and copy — not just presence/absence — so two different
 * sites yield materially different reports. Mirrors the shape a real LLM would
 * return so the whole pipeline/UI works end-to-end without any API keys.
 */
export function analyzeMock(input: AnalyzeInput): ReportJson {
  const { pageContext: ctx, lighthouse: lh } = input;
  const rand = seededRandom(ctx.finalUrl);
  const jitter = (base: number, spread = 6) =>
    clamp(base + (rand() - 0.5) * spread);

  if (ctx.blocked) return buildBlockedReport(ctx, lh);

  const h1 = ctx.headings.h1;
  const primaryH1 = h1[0] ?? "";
  const hasH1 = h1.length > 0;
  const singleH1 = h1.length === 1;
  const hasCta = ctx.ctaTexts.length > 0;
  const genericCtas = ctx.ctaTexts.filter((c) => GENERIC_CTA.test(c.trim()));
  const formFieldTotal = ctx.forms.reduce((a, f) => a + f.fieldCount, 0);
  const heavyForm = formFieldTotal > 6;
  const altCoverage =
    ctx.images.total === 0 ? 1 : ctx.images.withAlt / ctx.images.total;
  const navCount = ctx.navLinks.length;
  const buttonCount = ctx.buttons.length;
  const headlineHasValue = VALUE_WORDS.test(primaryH1);
  const headlineTooShort = hasH1 && primaryH1.length < 12;
  const headlineTooLong = hasH1 && primaryH1.length > 80;
  const titleLen = (ctx.title ?? "").length;

  // ---- Category scores from real signals --------------------------------
  const scores: Record<ScoreCategory, number> = {
    hero: jitter(
      48 +
        (hasH1 ? 16 : -12) +
        (singleH1 ? 6 : 0) +
        (headlineHasValue ? 10 : -6) +
        (hasCta ? 12 : -10)
    ),
    trust: jitter(
      44 +
        (ctx.hasTestimonials ? 15 : 0) +
        (ctx.hasTrustBadges ? 12 : 0) +
        (ctx.hasSocialProof ? 12 : 0) +
        (ctx.isHttps ? 6 : -15)
    ),
    cta: jitter(
      50 +
        (hasCta ? 20 : -20) +
        (genericCtas.length ? -10 : 6) +
        (buttonCount > 12 ? -8 : 0)
    ),
    copy: jitter(
      50 +
        (ctx.wordCount > 250 && ctx.wordCount < 3000 ? 10 : -8) +
        (ctx.metaDescription ? 6 : -6) +
        (headlineHasValue ? 6 : -4)
    ),
    design: jitter(
      55 + (ctx.fonts.length <= 3 ? 8 : -6) + (ctx.colors.length <= 6 ? 6 : -4)
    ),
    forms: jitter(ctx.forms.length === 0 ? 62 : 64 - (heavyForm ? 24 : 0)),
    accessibility: jitter(lh.accessibility * 0.9 + altCoverage * 10),
    performance: jitter(lh.performance),
    mobile: jitter(50 + (ctx.hasViewportMeta ? 22 : -22)),
    psychology: jitter(
      42 +
        (ctx.hasSocialProof ? 12 : 0) +
        (ctx.hasTestimonials ? 10 : 0) +
        (ctx.hasPricing ? 8 : 0) +
        (ctx.hasVideo ? 4 : 0)
    ),
    seo: jitter(
      lh.seo * 0.85 + (ctx.metaDescription ? 8 : -8) + (hasH1 ? 6 : -6)
    ),
    navigation: jitter(
      52 + (navCount >= 3 && navCount <= 8 ? 14 : navCount > 8 ? -10 : -6)
    ),
  };

  const weights: Record<ScoreCategory, number> = {
    hero: 1.4,
    trust: 1.3,
    cta: 1.4,
    copy: 1.1,
    design: 1.0,
    forms: 1.0,
    accessibility: 0.9,
    performance: 1.1,
    mobile: 1.2,
    psychology: 1.1,
    seo: 0.8,
    navigation: 0.9,
  };
  const totalWeight = SCORE_CATEGORIES.reduce((a, c) => a + weights[c], 0);
  const overallScore = clamp(
    SCORE_CATEGORIES.reduce((a, c) => a + scores[c] * weights[c], 0) /
      totalWeight
  );

  // ---- Page-specific issues ---------------------------------------------
  const issues: IssueInput[] = [];
  const push = (i: IssueInput) => issues.push(i);

  // Headline ----------------------------------------------------------------
  if (!hasH1) {
    push({
      category: "Headline",
      title: "Missing a clear H1 headline",
      description:
        "No primary H1 heading was detected. Visitors cannot instantly grasp what you offer or why it matters to them.",
      whyItMatters:
        "The headline is the single most-read element on a page. Without a clear value proposition, bounce rates rise sharply within the first 5 seconds.",
      severity: "CRITICAL",
      confidence: 92,
      businessImpact:
        "Directly reduces top-of-funnel conversions and ad quality scores.",
      suggestedFix:
        "Add one benefit-driven H1 stating the outcome you deliver, e.g. 'Get [result] without [pain]'.",
      estimatedConversionImpact: "+6-12%",
      annotation: { device: "desktop", x: 0.5, y: 0.22 },
    });
  } else if (!singleH1) {
    push({
      category: "Headline",
      title: `Multiple H1s dilute the message (${h1.length} found)`,
      description: `The page uses ${h1.length} H1 tags — e.g. "${truncate(
        primaryH1,
        40
      )}" and "${truncate(h1[1] ?? "", 40)}". This splits focus and weakens the SEO signal.`,
      whyItMatters:
        "Multiple H1s create competing focal points and confuse both users and search engines about the page's primary intent.",
      severity: "MEDIUM",
      confidence: 82,
      businessImpact: "Reduces message clarity and can hurt organic ranking.",
      suggestedFix:
        "Keep one H1 for the core value proposition; demote the rest to H2.",
      estimatedConversionImpact: "+1-3%",
      annotation: { device: "desktop", x: 0.5, y: 0.2 },
    });
  } else if (headlineTooShort || !headlineHasValue) {
    push({
      category: "Headline",
      title: "Headline doesn't communicate a clear benefit",
      description: `Your H1 reads "${truncate(
        primaryH1,
        70
      )}". It ${headlineTooShort ? "is very short and " : ""}doesn't name a concrete outcome or benefit, so visitors have to work to understand the value.`,
      whyItMatters:
        "Outcome-led headlines consistently outperform vague or brand-only headlines because they answer 'what's in it for me?' in under 5 seconds.",
      severity: "HIGH",
      confidence: 76,
      businessImpact: "Weak value framing raises bounce and lowers CTA clicks.",
      suggestedFix: `Rewrite around the result, e.g. "${truncate(
        primaryH1,
        30
      )} — [specific outcome] in [timeframe]". Lead with the benefit, not the brand.`,
      estimatedConversionImpact: "+4-9%",
      annotation: { device: "desktop", x: 0.5, y: 0.24 },
    });
  } else if (headlineTooLong) {
    push({
      category: "Headline",
      title: "Headline is too long to scan quickly",
      description: `Your H1 is ${primaryH1.length} characters ("${truncate(
        primaryH1,
        60
      )}"). Long headlines are skimmed, not read.`,
      whyItMatters:
        "Above-the-fold copy is scanned in an F-pattern; a tight headline lands the message before attention drops.",
      severity: "MEDIUM",
      confidence: 70,
      businessImpact: "Slower comprehension reduces engagement with the hero.",
      suggestedFix:
        "Tighten to a single, punchy benefit statement (~6-12 words) and move detail to the subhead.",
      estimatedConversionImpact: "+2-4%",
      annotation: { device: "desktop", x: 0.5, y: 0.24 },
    });
  }

  // CTA ---------------------------------------------------------------------
  if (!hasCta) {
    push({
      category: "CTA",
      title: "No prominent primary call-to-action",
      description:
        "We could not detect a clear, high-intent primary CTA (e.g. 'Start free trial', 'Get a demo'). The strongest button we found was generic or absent.",
      whyItMatters:
        "Every high-converting page guides visitors to one obvious next step. Without it, motivated users leave without acting.",
      severity: "CRITICAL",
      confidence: 86,
      businessImpact: "The single biggest lever for lead volume and revenue.",
      suggestedFix:
        "Add one visually dominant CTA with value-led copy above the fold and repeat it after each proof section.",
      estimatedConversionImpact: "+8-15%",
      annotation: { device: "desktop", x: 0.5, y: 0.4 },
    });
  } else if (genericCtas.length > 0) {
    push({
      category: "CTA",
      title: "Primary CTA copy is generic",
      description: `Detected CTA labels include ${genericCtas
        .slice(0, 3)
        .map((c) => `"${c.trim()}"`)
        .join(", ")}. Mechanic-style verbs like these underperform value-led copy in A/B tests.`,
      whyItMatters:
        "Value-specific CTA copy consistently lifts click-through versus generic labels because it restates the payoff at the moment of decision.",
      severity: "MEDIUM",
      confidence: 74,
      businessImpact: "Incremental CTR gains compound across the funnel.",
      suggestedFix: `Rewrite to name the value, e.g. replace "${truncate(
        genericCtas[0]!.trim(),
        20
      )}" with "Get my free audit" or "Start saving today".`,
      estimatedConversionImpact: "+2-5%",
      annotation: { device: "desktop", x: 0.62, y: 0.42 },
    });
  } else if (buttonCount > 12) {
    push({
      category: "CTA",
      title: `Too many competing buttons (${buttonCount} detected)`,
      description: `The page exposes ${buttonCount} button/CTA elements. When everything is emphasized, nothing is — visitors hesitate over which action to take.`,
      whyItMatters:
        "Choice overload (Hick's Law) slows decisions. One dominant CTA per view outperforms many equally-weighted options.",
      severity: "MEDIUM",
      confidence: 68,
      businessImpact: "Diffused attention lowers primary conversion rate.",
      suggestedFix:
        "Establish one primary CTA style; demote secondary actions to lower-contrast/ghost buttons or text links.",
      estimatedConversionImpact: "+2-4%",
      annotation: { device: "desktop", x: 0.5, y: 0.45 },
    });
  }

  // Trust -------------------------------------------------------------------
  if (!ctx.hasTestimonials && !ctx.hasSocialProof) {
    push({
      category: "Trust Signals",
      title: "Weak social proof and trust signals",
      description:
        "No testimonials, reviews, customer logos, or usage stats were detected on the page.",
      whyItMatters:
        "Social proof reduces perceived risk (loss aversion) and is one of the strongest persuasion levers, especially for first-time visitors.",
      severity: "HIGH",
      confidence: 82,
      businessImpact: "Higher hesitation and abandonment at the decision stage.",
      suggestedFix:
        "Add testimonials with names/photos, recognizable client logos, ratings, or usage stats near the primary CTA.",
      estimatedConversionImpact: "+5-9%",
      annotation: { device: "desktop", x: 0.5, y: 0.68 },
    });
  } else if (!ctx.hasTrustBadges) {
    push({
      category: "Objection Handling",
      title: "No risk-reversal or reassurance near the CTA",
      description:
        "Social proof was detected, but no guarantee, security, or risk-reversal language (e.g. money-back, 'cancel anytime', security badges) was found near decision points.",
      whyItMatters:
        "Addressing objections at the moment of hesitation recovers conversions that would otherwise be lost to uncertainty.",
      severity: "MEDIUM",
      confidence: 66,
      businessImpact: "Recovers otherwise-lost conversions from hesitant visitors.",
      suggestedFix:
        "Add a guarantee, security reassurance, or concise FAQ directly beside the primary CTA.",
      estimatedConversionImpact: "+3-6%",
      annotation: { device: "desktop", x: 0.5, y: 0.72 },
    });
  }

  // Forms -------------------------------------------------------------------
  if (heavyForm) {
    const fieldNames = ctx.forms
      .flatMap((f) => f.fields.map((fl) => fl.name || fl.type))
      .filter(Boolean)
      .slice(0, 5);
    push({
      category: "Forms",
      title: `Form asks for too much (${formFieldTotal} fields)`,
      description: `A form with ${formFieldTotal} fields was detected${
        fieldNames.length ? ` (e.g. ${fieldNames.join(", ")})` : ""
      }. Each extra field measurably increases friction.`,
      whyItMatters:
        "Field count is inversely correlated with completion. Cutting fields is one of the fastest CRO wins available.",
      severity: "HIGH",
      confidence: 82,
      businessImpact: "Directly lowers lead-capture completion rate.",
      suggestedFix:
        "Reduce to essential fields (often just email), defer the rest, or use a multi-step form with a progress bar.",
      estimatedConversionImpact: "+7-14%",
      annotation: { device: "mobile", x: 0.5, y: 0.55 },
    });
  }

  // Performance -------------------------------------------------------------
  if (lh.performance < 70) {
    push({
      category: "Performance",
      title: `Slow performance (${lh.performance}/100) is costing conversions`,
      description: `PageSpeed performance is ${lh.performance}/100${
        lh.metrics.lcp ? ` with LCP around ${(lh.metrics.lcp / 1000).toFixed(1)}s` : ""
      }${lh.metrics.cls != null ? ` and CLS ${lh.metrics.cls.toFixed(2)}` : ""}.`,
      whyItMatters:
        "Every additional second of load time measurably reduces conversions and increases bounce, especially on mobile.",
      severity: lh.performance < 50 ? "CRITICAL" : "HIGH",
      confidence: 90,
      businessImpact:
        "Compounds across all traffic; also affects ad costs and SEO ranking.",
      suggestedFix:
        "Optimize the LCP image, defer non-critical JS, enable compression/caching, and lazy-load below-the-fold media.",
      estimatedConversionImpact: "+4-10%",
      annotation: { device: "mobile", x: 0.5, y: 0.3 },
    });
  }

  // Mobile ------------------------------------------------------------------
  if (!ctx.hasViewportMeta) {
    push({
      category: "Mobile UX",
      title: "Missing responsive viewport configuration",
      description:
        "No responsive viewport meta tag was found, which breaks mobile layout scaling.",
      whyItMatters:
        "The majority of traffic is mobile. A broken mobile experience destroys conversions from that segment.",
      severity: "CRITICAL",
      confidence: 95,
      businessImpact: "Loses the entire mobile audience's conversion potential.",
      suggestedFix:
        'Add <meta name="viewport" content="width=device-width, initial-scale=1"> and verify responsive breakpoints.',
      estimatedConversionImpact: "+10-20%",
      annotation: { device: "mobile", x: 0.5, y: 0.5 },
    });
  }

  // Navigation --------------------------------------------------------------
  if (navCount > 8) {
    push({
      category: "Navigation",
      title: `Navigation has too many options (${navCount} links)`,
      description: `The primary navigation exposes ${navCount} links, e.g. ${ctx.navLinks
        .slice(0, 4)
        .map((l) => `"${truncate(l.text, 18)}"`)
        .join(", ")}. On conversion-focused pages this leaks attention.`,
      whyItMatters:
        "Every nav link is an exit. Trimming navigation on landing/conversion pages consistently lifts goal completion.",
      severity: "MEDIUM",
      confidence: 64,
      businessImpact: "Reduces distraction and keeps visitors on the path to convert.",
      suggestedFix:
        "On conversion pages, cut nav to the essentials (or use a minimal 'lander' header) and keep the CTA persistent.",
      estimatedConversionImpact: "+2-5%",
      annotation: { device: "desktop", x: 0.85, y: 0.06 },
    });
  }

  // Copy --------------------------------------------------------------------
  if (ctx.wordCount > 0 && ctx.wordCount < 120) {
    push({
      category: "Copy",
      title: "Thin copy leaves objections unanswered",
      description: `Only ~${ctx.wordCount} words of body copy were detected. There likely isn't enough content to build desire or handle objections.`,
      whyItMatters:
        "Especially for considered purchases, too little copy means visitors leave with unanswered questions.",
      severity: "MEDIUM",
      confidence: 60,
      businessImpact: "Under-selling the offer reduces qualified conversions.",
      suggestedFix:
        "Add benefit-led sections: how it works, proof, objection handling, and an FAQ — each ending in a CTA.",
      estimatedConversionImpact: "+2-5%",
      annotation: null,
    });
  }

  // Accessibility -----------------------------------------------------------
  if (altCoverage < 0.6 && ctx.images.total > 0) {
    push({
      category: "Accessibility",
      title: `${ctx.images.withoutAlt} of ${ctx.images.total} images lack alt text`,
      description: `${ctx.images.withoutAlt} images are missing alt attributes (${Math.round(
        altCoverage * 100
      )}% coverage), hurting screen-reader users and image SEO.`,
      whyItMatters:
        "Alt text improves accessibility for assistive tech and contributes to SEO and image search visibility.",
      severity: "MEDIUM",
      confidence: 88,
      businessImpact: "Excludes assistive-tech users and forfeits SEO value.",
      suggestedFix: "Add concise, descriptive alt attributes to all meaningful images.",
      estimatedConversionImpact: "+1-2%",
      annotation: null,
    });
  }

  // SEO ---------------------------------------------------------------------
  if (!ctx.metaDescription) {
    push({
      category: "SEO Basics",
      title: "Missing meta description",
      description:
        "No meta description was found, so search engines auto-generate the snippet — reducing organic click-through.",
      whyItMatters:
        "The meta description is your ad copy in search results; a compelling one raises organic CTR.",
      severity: "LOW",
      confidence: 90,
      businessImpact: "Lower organic traffic quality and volume.",
      suggestedFix:
        "Write a 140-160 char benefit-driven meta description with a soft CTA.",
      estimatedConversionImpact: "+1-3%",
      annotation: null,
    });
  } else if (titleLen > 0 && (titleLen < 15 || titleLen > 65)) {
    push({
      category: "SEO Basics",
      title: `Title tag is ${titleLen < 15 ? "too short" : "too long"} (${titleLen} chars)`,
      description: `Your title tag "${truncate(ctx.title ?? "", 55)}" is ${titleLen} characters; ${
        titleLen < 15 ? "it wastes SERP space" : "it will be truncated in results"
      }.`,
      whyItMatters:
        "The title is the largest, most-clicked element in search results; length affects both CTR and how much of your message survives truncation.",
      severity: "LOW",
      confidence: 78,
      businessImpact: "Sub-optimal titles lower organic CTR.",
      suggestedFix:
        "Aim for ~50-60 characters, lead with the primary keyword/benefit, and include the brand at the end.",
      estimatedConversionImpact: "+1-2%",
      annotation: null,
    });
  }

  // Pricing -----------------------------------------------------------------
  if (!ctx.hasPricing) {
    push({
      category: "Pricing",
      title: "No transparent pricing information",
      description: "No pricing section, plan, or price signal was detected on the page.",
      whyItMatters:
        "Price ambiguity is a top objection. Transparency (or a clear range) builds trust and pre-qualifies leads.",
      severity: "MEDIUM",
      confidence: 62,
      businessImpact: "Increases friction and lowers inbound lead quality.",
      suggestedFix:
        "Add pricing or a 'How pricing works' explainer with anchoring and a recommended tier.",
      estimatedConversionImpact: "+3-6%",
      annotation: { device: "desktop", x: 0.5, y: 0.78 },
    });
  }

  // Visual hierarchy (only when the hero actually scores weak) --------------
  if (scores.hero < 66) {
    push({
      category: "Visual Hierarchy",
      title: "Sharpen above-the-fold visual hierarchy",
      description:
        "The above-the-fold area can guide the eye more deliberately from headline to subheadline to a single dominant CTA.",
      whyItMatters:
        "Clear hierarchy (Gestalt + F-pattern) reduces cognitive load and speeds the path to action.",
      severity: "MEDIUM",
      confidence: 62,
      businessImpact: "Improves comprehension speed and CTA discovery.",
      suggestedFix:
        "Increase headline size/contrast, add whitespace, and make the primary CTA the highest-contrast element.",
      estimatedConversionImpact: "+2-5%",
      annotation: { device: "desktop", x: 0.5, y: 0.35 },
    });
  }

  // Guarantee a minimum of substantive findings even on strong pages so the
  // report never looks empty — but keep them evidence-based.
  if (issues.length < 3 && !ctx.hasVideo) {
    push({
      category: "Engagement",
      title: "No hero video or interactive demo detected",
      description:
        "The page relies on static content above the fold. A short product video or interactive demo can lift comprehension and time-on-page.",
      whyItMatters:
        "Demonstrating the product in motion reduces perceived risk and shortens the path to an informed decision.",
      severity: "LOW",
      confidence: 55,
      businessImpact: "Higher engagement correlates with higher intent to convert.",
      suggestedFix:
        "Add a 30-60s product walkthrough or interactive demo near the hero CTA.",
      estimatedConversionImpact: "+1-3%",
      annotation: { device: "desktop", x: 0.7, y: 0.35 },
    });
  }

  // ---- Strengths / weaknesses -------------------------------------------
  const strengths: string[] = [];
  if (ctx.isHttps)
    strengths.push("Served securely over HTTPS — a baseline trust signal.");
  if (singleH1 && headlineHasValue)
    strengths.push(
      `The H1 "${truncate(primaryH1, 50)}" leads with a clear benefit.`
    );
  else if (singleH1)
    strengths.push("A single, focused H1 anchors the page's core message.");
  if (hasCta && genericCtas.length === 0)
    strengths.push("Primary CTA copy is action- and value-oriented.");
  if (ctx.hasTestimonials)
    strengths.push("Testimonials provide credibility and social proof.");
  if (ctx.hasViewportMeta)
    strengths.push("Responsive viewport is configured for mobile devices.");
  if (lh.performance >= 80)
    strengths.push(
      `Strong PageSpeed performance (${lh.performance}/100) supports low bounce.`
    );
  if (navCount >= 3 && navCount <= 8)
    strengths.push("Navigation is concise, respecting Hick's Law.");
  if (ctx.metaDescription)
    strengths.push("A meta description is set for better search CTR.");
  if (ctx.hasVideo)
    strengths.push("Video/interactive media is present to aid comprehension.");
  while (strengths.length < 3)
    strengths.push("Foundational page structure is in place to build on.");

  const weaknesses = issues
    .filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH")
    .map((i) => i.title);
  let wi = 0;
  while (weaknesses.length < 3 && issues[wi]) {
    if (!weaknesses.includes(issues[wi]!.title))
      weaknesses.push(issues[wi]!.title);
    wi++;
  }

  // ---- Recommendations (priority matrix) --------------------------------
  const severityEffort: Record<SeverityLevel, number> = {
    CRITICAL: 3,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
    INFO: 1,
  };
  const severityImpact: Record<SeverityLevel, number> = {
    CRITICAL: 5,
    HIGH: 4,
    MEDIUM: 3,
    LOW: 2,
    INFO: 1,
  };
  const recommendations: RecommendationInput[] = issues.slice(0, 10).map((i) => ({
    title: i.suggestedFix.length > 80 ? i.title : i.suggestedFix,
    description: i.description,
    impact: severityImpact[i.severity],
    effort: severityEffort[i.severity],
    category: i.category,
  }));

  const criticalCount = issues.filter((i) => i.severity === "CRITICAL").length;
  const highCount = issues.filter((i) => i.severity === "HIGH").length;
  const priority: ReportJson["priority"] =
    criticalCount >= 1 || overallScore < 55
      ? "high"
      : highCount >= 1 || overallScore < 75
        ? "medium"
        : "low";

  const impactLow = clamp(6 + criticalCount * 4 + highCount * 3, 0, 40);
  const impactHigh = clamp(impactLow + 8 + criticalCount * 3, 0, 60);

  const report: ReportJson = {
    overallScore,
    categoryScores: scores,
    summary: buildSummary(ctx, overallScore, criticalCount, highCount),
    strengths: strengths.slice(0, 8),
    weaknesses: weaknesses.slice(0, 8),
    issues,
    recommendations,
    priority,
    confidence: clamp(74 + rand() * 12),
    estimatedImpact: `+${impactLow}-${impactHigh}% conversions`,
  };

  return reportSchema.parse(report);
}

// Produced when we could not read the real page (bot protection / interstitial).
function buildBlockedReport(
  ctx: PageContext,
  lh: LighthouseSummary
): ReportJson {
  const neutral = 58;
  const scores = Object.fromEntries(
    SCORE_CATEGORIES.map((c) => [c, neutral])
  ) as Record<ScoreCategory, number>;
  scores.performance = clamp(lh.performance || neutral);
  scores.seo = clamp(lh.seo || neutral);

  const reason = ctx.blockReason ?? "bot protection";
  const host = safeHost(ctx.finalUrl);

  const issues: IssueInput[] = [
    {
      category: "Conversion Friction",
      title: "Automated analysis was limited by bot protection",
      description: `${host} returned a verification / interstitial page (${reason}) instead of its real content, so on-page CRO signals could not be reliably read.`,
      whyItMatters:
        "Without the rendered page we cannot confirm headline, CTA, trust, or layout issues — reporting 'missing' elements here would be false. An allowlisted crawl or manual expert review is needed for an accurate audit.",
      severity: "INFO",
      confidence: 90,
      businessImpact: "Automated audit coverage is limited for this URL.",
      suggestedFix:
        "Re-run against a URL without bot-challenge protection, allowlist our crawler's IP/user-agent, or request a manual CRO review.",
      estimatedConversionImpact: "n/a",
      annotation: null,
    },
  ];

  const report: ReportJson = {
    overallScore: neutral,
    categoryScores: scores,
    summary: `${host} could not be fully analyzed automatically because it served a verification / bot-protection page (${reason}). The scores below are neutral placeholders — request a manual review or allowlist our crawler for an accurate CRO audit.`,
    strengths: [
      "Site appears to sit behind bot-protection (e.g. Cloudflare), a security positive.",
    ],
    weaknesses: [
      "Automated CRO analysis was blocked by a verification/interstitial page.",
    ],
    issues,
    recommendations: [
      {
        title:
          "Allowlist the crawler or provide a direct URL for an accurate audit",
        description:
          "Bot protection prevented a full render, so a reliable analysis needs unblocked access or manual review.",
        impact: 3,
        effort: 2,
        category: "Conversion Friction",
      },
    ],
    priority: "medium",
    confidence: 30,
    estimatedImpact: "unknown (limited analysis)",
  };

  return reportSchema.parse(report);
}

function buildSummary(
  ctx: PageContext,
  score: number,
  critical: number,
  high: number
): string {
  const host = safeHost(ctx.finalUrl);
  const tone =
    score >= 80
      ? "performs well overall"
      : score >= 60
        ? "has a solid foundation but leaves meaningful conversions on the table"
        : "has significant conversion friction that is likely suppressing results";
  const headlineNote = ctx.headings.h1[0]
    ? ` Its headline reads "${truncate(ctx.headings.h1[0], 60)}".`
    : " No clear H1 headline was detected.";
  return `${host} ${tone}, scoring ${score}/100 on our CRO framework.${headlineNote} We identified ${critical} critical and ${high} high-severity issues spanning messaging clarity, trust, and conversion friction. Fixing the top opportunities first should produce the fastest lift; the recommendations below are prioritized by expected impact versus implementation effort.`;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "This site";
  }
}
