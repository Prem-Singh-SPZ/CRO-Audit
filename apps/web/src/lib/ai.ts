import {
  reportSchema,
  SCORE_CATEGORIES,
  SEVERITIES,
  DEVICES,
  type ReportJson,
  type PageContext,
  type LighthouseSummary,
  type ScoreCategory,
  type SeverityLevel,
  type AuditContext,
  type ComplexityLevel,
  type DiyRiskLevel,
} from "@/lib/cro";
import { analyzeMock } from "@/lib/mock-ai";
import type { Screenshot } from "@/lib/screenshot";

export interface GenerateInput {
  pageContext: PageContext;
  lighthouse: LighthouseSummary;
  screenshots: Screenshot[];
  auditContext?: AuditContext;
}

export interface GenerateResult {
  report: ReportJson;
  provider: "openai" | "anthropic" | "gemini" | "mock";
}

/**
 * Hybrid report generator. Uses a real vision LLM (OpenAI or Anthropic) when a
 * matching API key is configured, feeding it the crawled page signals plus the
 * live screenshots so it returns exclusive, page-specific findings. Falls back
 * to the page-specific heuristic engine on any error/misconfiguration, so the
 * product always works with zero keys.
 */
export async function generateReport(
  input: GenerateInput
): Promise<GenerateResult> {
  const provider = (process.env.AI_PROVIDER || "mock").toLowerCase();

  try {
    if (provider === "openai" && process.env.OPENAI_API_KEY) {
      const report = await callOpenAI(input);
      if (report) return { report, provider: "openai" };
    } else if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
      const report = await callAnthropic(input);
      if (report) return { report, provider: "anthropic" };
    } else if (provider === "gemini" && process.env.GEMINI_API_KEY) {
      const report = await callGemini(input);
      if (report) return { report, provider: "gemini" };
    }
  } catch (err) {
    console.error("[ai] LLM provider failed; using heuristic engine:", err);
  }

  return { report: analyzeMock(input), provider: "mock" };
}

// ---------------------------------------------------------------------------
// Prompt construction (shared by providers)
// ---------------------------------------------------------------------------

function compactContext(ctx: PageContext, lh: LighthouseSummary): string {
  const forms = ctx.forms.map((f) => ({
    fieldCount: f.fieldCount,
    fields: f.fields.map((x) => x.name || x.type).slice(0, 12),
    submit: f.submitText,
  }));
  return JSON.stringify(
    {
      url: ctx.finalUrl,
      title: ctx.title,
      metaDescription: ctx.metaDescription,
      isHttps: ctx.isHttps,
      hasViewportMeta: ctx.hasViewportMeta,
      h1: ctx.headings.h1,
      h2: ctx.headings.h2.slice(0, 10),
      ctaTexts: ctx.ctaTexts,
      buttonCount: ctx.buttons.length,
      navLinks: ctx.navLinks.map((l) => l.text).slice(0, 15),
      forms,
      images: ctx.images,
      wordCount: ctx.wordCount,
      hasTestimonials: ctx.hasTestimonials,
      hasPricing: ctx.hasPricing,
      hasTrustBadges: ctx.hasTrustBadges,
      hasSocialProof: ctx.hasSocialProof,
      hasVideo: ctx.hasVideo,
      lighthouse: {
        performance: lh.performance,
        accessibility: lh.accessibility,
        bestPractices: lh.bestPractices,
        seo: lh.seo,
        metrics: lh.metrics,
      },
    },
    null,
    2
  );
}

function systemPrompt(): string {
  return `SYSTEM INSTRUCTIONS & CRO RULEBOOK
You are an uncompromising, elite Conversion Rate Optimization (CRO) Auditor. Your task is to critique the provided landing page screenshot and accompanying DOM/text metadata using a strict heuristic evaluation framework.

Do not give generic advice like "make the button bigger." You must analyze the core conversion leaks across the following 5 specific pillars derived from the LIFT Model, Gestalt UX Laws, and Behavioural Psychology:

PILLAR 1: CLARITY & VALUE PROPOSITION (The 5-Second Test)
- Rule: A user must understand exactly what the product/service is, who it is for, and the primary benefit within 5 seconds of landing.
- Check for: Vague, artsy headlines; lack of a supporting subheadline; hidden primary CTAs; failure to explain the "Unique Selling Proposition" (USP) above the fold.

PILLAR 2: COGNITIVE FRICTION & EYEFLOW (Gestalt UX Laws)
- Rule: Minimize the mental effort required to navigate the page. The user's eyes should flow naturally down the page toward the primary action.
- Check for: Bad visual hierarchy (e.g., secondary text larger than headlines); cluttered blocks of text instead of scannable bullet points; form fields asking for unneeded data; confusing navigational menus.

PILLAR 3: USER ANXIETY & RISK REVERSAL (Trust Signals)
- Rule: Every action requires trust. If you ask for a click, email, or money, you must actively dismantle the user's hidden fears (FUDs: Fears, Uncertainties, Doubts).
- Check for: Missing reviews/testimonials, lack of brand authority logos, absent "no credit card required" or "money-back guarantee" disclaimers near the CTA, and missing privacy assurances on form captures.

PILLAR 4: VISUAL DISTRACTION & OPTION PARALYSIS (Hick's Law)
- Rule: The more options a user has, the longer it takes to make a decision—or they abandon the page entirely.
- Check for: Multiple primary call-to-action buttons competing for attention; external links pointing away from the landing page; excessive pop-ups or massive, busy graphics that pull focus away from the pitch.

PILLAR 5: INCENTIVE & RELEVANCE (Message Match)
- Rule: The page must match user intent and give them an urgent reason to stay or act immediately.
- Check for: Generic CTAs ("Submit", "Learn More") instead of value-driven, action-oriented CTAs ("Get My Free Audit", "Start Saving Today"); lack of ethical urgency (scarcity, bonuses, or seasonal context).

INPUTS YOU RECEIVE
(1) A full-page DESKTOP screenshot (top-to-bottom, not just above the fold). (2) Crawled DOM/structural signals (headline, CTA labels, form fields, nav, counts). (3) The raw visible page COPY TEXT — analyze the literal copy. (4) PageSpeed/Lighthouse metrics. (5) OPTIONAL business context (Target Audience, Core Product/Service, Primary Traffic Source) — when present, use it to judge PILLAR 5 Message Match, not just generic best practice.

CRITIQUE ARCHITECTURE (JSON OUTPUT FORMAT)
You must analyze the layout, structural engineering, and copywriting. For every single flaw identified, output a highly detailed object matching the schema below.

FLAW COVERAGE (NO ARTIFICIAL LIMIT):
- Report EVERY genuine, defensible conversion flaw you can substantiate — there is NO minimum and NO maximum count. Be exhaustive.
- CRITICAL: Do NOT default to exactly one flaw per pillar. Pillars are lenses, not quotas. A single pillar is usually violated MULTIPLE times across different parts of the page, and a single page section often contains several distinct flaws. Report each one separately.
- Work section by section, top to bottom. For EACH page section that exists (hero/above-the-fold, value proposition, features/benefits, social proof/testimonials, pricing, forms/lead capture, navigation/menus, footer), inspect it against ALL 5 pillars (Clarity, Friction, Anxiety, Distraction, Incentive) and list every real problem you find there before moving to the next section.
- A larger report is only better when every item is real. Return as many flaws as the page genuinely warrants — a clean, well-optimized page yields few; a typical page with real conversion problems will usually surface many more than five.

CREDIBILITY GUARDRAILS (STRICT — protects the tool's reputation):
- ZERO fabrication or padding. If you cannot cite concrete, page-specific evidence for a flaw, DO NOT include it. Never invent elements, copy, or metrics that are not actually present in the screenshot/DOM/copy.
- Every flaw MUST quote or reference the REAL page content — the real headline, the real CTA/button labels, the real copy lines, the real form fields, real counts/metrics, or a clearly-visible layout fact.
- NEVER emit generic boilerplate that could apply to any site. If an item reads like it could be pasted onto a random website, delete it.
- No duplicates or near-duplicates: each flaw must be a materially distinct problem, not the same issue re-worded.
- Do not manufacture problems on a strong page just to lengthen the list. Under-reporting a fake issue is always better than damaging credibility with a false positive.

Crucial Copywriting Rule: You must analyze the literal text copy and diagnose exactly WHAT is wrong and WHY. However, you must NOT give away the step-by-step technical implementation for free — that is our paid deliverable.

LEAD-GENERATION GATING RULE (STRICT): "actionable_fix" must be a value-selling TEASER, never a how-to. Do NOT include code, exact copy rewrites, CSS/HTML instructions, or numbered steps. Instead, describe the TYPE of work required and route the user to book a call, using this exact pattern (adapt only the first clause to the specific flaw):
"Requires custom UX/copywriting redesign. We have prepared a mock-up template for this. [Book a call to view your custom template]."

Return ONLY a valid JSON object (no markdown fences, no prose, no trailing commentary) with this schema:
{
  "conversion_score": <int 1-100, based on total structural compliance>,
  "primary_bottleneck": "<the single biggest design or text flaw killing conversions on this page>",
  "flaws": [
    {
      "pillar": "<Clarity | Friction | Anxiety | Distraction | Incentive>",
      "impact": "<High | Medium | Low>",
      "element": "<e.g., Hero Headline, Primary Form, Sub-navigation>",
      "issue_discovered": "<detailed explanation of the visual or text mistake, quoting the real page content>",
      "psychology_why_it_fails": "<the specific cognitive bias or user behavior causing drop-offs here>",
      "complexity": "<High | Medium | Low — how difficult this fix is to implement correctly>",
      "risk_of_diy": "<High Risk | Moderate Risk | Low Risk — the danger of the site owner breaking their analytics tracking, layout, or styling if they attempt this themselves>",
      "actionable_fix": "<a value-selling TEASER per the LEAD-GENERATION GATING RULE — NOT a how-to>",
      "estimated_conversion_impact": "<e.g. +4-9%>",
      "confidence": <int 0-100>,
      "annotation": { "device": "desktop", "x": <0-1>, "y": <0-1> } | null
    }
  ],
  "categoryScores": { ${SCORE_CATEGORIES.map((c) => `"${c}": <int 0-100>`).join(", ")} },
  "summary": "<2-4 sentences referencing THIS page specifically>",
  "strengths": ["<string>", ...],
  "weaknesses": ["<string>", ...],
  "recommendations": [ { "title": "<string>", "description": "<string>", "impact": <int 1-5>, "effort": <int 1-5>, "category": "<string>" } ],
  "priority": "<high | medium | low>",
  "confidence": <int 0-100>,
  "estimatedImpact": "<e.g. +12-28% conversions>"
}

SCHEMA COMPLIANCE RULES
- "annotation": ALWAYS use "device": "desktop" (only a desktop screenshot exists). Set x/y to the fractional position (0=left/top, 1=right/bottom) of the element on the desktop screenshot so it can be pinned. Use null when the flaw isn't tied to a visible spot.
- All ${SCORE_CATEGORIES.length} categoryScores keys are required, each 0-100.
- "conversion_score", "primary_bottleneck", and a non-empty "flaws" array are mandatory.
- Output raw JSON only. Do not wrap it in markdown fences.`;
}

function auditContextText(ctx?: AuditContext): string {
  if (!ctx) return "";
  const lines: string[] = [];
  if (ctx.targetAudience) lines.push(`- Target Audience: ${ctx.targetAudience}`);
  if (ctx.coreProduct) lines.push(`- Core Product/Service: ${ctx.coreProduct}`);
  if (ctx.primaryTrafficSource)
    lines.push(`- Primary Traffic Source: ${ctx.primaryTrafficSource}`);
  if (lines.length === 0) return "";
  return `\n\nBUSINESS CONTEXT (use this to judge message-match & relevance):\n${lines.join(
    "\n"
  )}`;
}

function userText(input: GenerateInput): string {
  const copy = input.pageContext.copyText
    ? `\n\nRAW PAGE COPY (verbatim, truncated — quote from this):\n"""\n${input.pageContext.copyText}\n"""`
    : "";
  return `Audit this page TOP TO BOTTOM and return the JSON report.\n\nCRAWLED SIGNALS + METRICS:\n${compactContext(
    input.pageContext,
    input.lighthouse
  )}${auditContextText(input.auditContext)}${copy}\n\nA full-page desktop screenshot is attached. Scroll through the ENTIRE screenshot — analyze the hero, mid-page content (features, testimonials, social proof, pricing), forms, and footer. Base your visual/hierarchy findings on it.`;
}

// ---------------------------------------------------------------------------
// OpenAI (chat completions, vision)
// ---------------------------------------------------------------------------

async function callOpenAI(input: GenerateInput): Promise<ReportJson | null> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const content: unknown[] = [{ type: "text", text: userText(input) }];
  for (const s of input.screenshots) {
    content.push({
      type: "text",
      text: `Screenshot (${s.device}):`,
    });
    content.push({ type: "image_url", image_url: { url: s.dataUri } });
  }

  const res = await withTimeout((signal) =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content },
        ],
      }),
    })
  );
  if (!res.ok) {
    console.error("[ai] OpenAI HTTP", res.status, await safeText(res));
    return null;
  }
  const json = (await res.json()) as any;
  const text = json?.choices?.[0]?.message?.content;
  return coerceReport(text);
}

// ---------------------------------------------------------------------------
// Anthropic (messages, vision)
// ---------------------------------------------------------------------------

async function callAnthropic(input: GenerateInput): Promise<ReportJson | null> {
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
  const content: unknown[] = [{ type: "text", text: userText(input) }];
  for (const s of input.screenshots) {
    content.push({ type: "text", text: `Screenshot (${s.device}):` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: s.mimeType, data: s.base64 },
    });
  }

  const res = await withTimeout((signal) =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 16384,
        system: `${systemPrompt()}\n\nReturn only the raw JSON object.`,
        messages: [{ role: "user", content }],
      }),
    })
  );
  if (!res.ok) {
    console.error("[ai] Anthropic HTTP", res.status, await safeText(res));
    return null;
  }
  const json = (await res.json()) as any;
  const text = Array.isArray(json?.content)
    ? json.content.map((b: any) => b?.text ?? "").join("")
    : "";
  const report = coerceReport(text);
  if (!report) {
    console.error(
      "[ai] Anthropic response could not be parsed (stop_reason=" +
        json?.stop_reason +
        ", textLen=" +
        text.length +
        "):",
      text.slice(0, 400)
    );
  }
  return report;
}

// ---------------------------------------------------------------------------
// Google Gemini (generateContent, vision)
// ---------------------------------------------------------------------------

async function callGemini(input: GenerateInput): Promise<ReportJson | null> {
  const model = process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";
  const apiKey = process.env.GEMINI_API_KEY as string;

  const parts: unknown[] = [{ text: userText(input) }];
  for (const s of input.screenshots) {
    parts.push({ text: `Screenshot (${s.device}):` });
    parts.push({
      inlineData: {
        mimeType: s.mimeType,
        data: s.base64,
      },
    });
  }

  const res = await withTimeout((signal) =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `${systemPrompt()}\n\nReturn only the raw JSON object.`,
              },
            ],
          },
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
            // Gemini 3 is a thinking model whose reasoning tokens share the
            // output budget. Medium thinking gives a more rigorous, exhaustive
            // section-by-section audit; the large output budget leaves room for
            // both the reasoning and the full JSON report without truncation.
            maxOutputTokens: 65536,
            thinkingConfig: { thinkingLevel: "medium" },
          },
        }),
      }
    )
  );

  if (!res.ok) {
    console.error("[ai] Gemini HTTP", res.status, await safeText(res));
    return null;
  }

  const json = (await res.json()) as any;
  const text = Array.isArray(json?.candidates?.[0]?.content?.parts)
    ? json.candidates[0].content.parts
        .map((p: any) => p?.text ?? "")
        .join("")
    : "";

  const report = coerceReport(text);
  if (!report) {
    console.error(
      "[ai] Gemini response could not be parsed (finishReason=" +
        json?.candidates?.[0]?.finishReason +
        ", textLen=" +
        text.length +
        "):",
      text.slice(0, 400)
    );
  }
  return report;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function withTimeout(
  fn: (signal: AbortSignal) => Promise<Response>,
  ms = 110_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}

const clampInt = (n: unknown, min: number, max: number, fallback: number) => {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(min, Math.min(max, v));
};

// Maps a High/Medium/Low "impact" label (spec alias) to our severity scale.
function impactToSeverity(impact: unknown): SeverityLevel {
  const v = String(impact ?? "").trim().toLowerCase();
  if (v === "high" || v === "critical") return "HIGH";
  if (v === "low") return "LOW";
  if (v === "info") return "INFO";
  return "MEDIUM";
}

function normalizeComplexity(v: unknown): ComplexityLevel | undefined {
  const s = String(v ?? "").trim().toLowerCase();
  if (s.startsWith("high")) return "High";
  if (s.startsWith("med")) return "Medium";
  if (s.startsWith("low")) return "Low";
  return undefined;
}

function normalizeDiyRisk(v: unknown): DiyRiskLevel | undefined {
  const s = String(v ?? "").trim().toLowerCase();
  if (s.startsWith("high")) return "High Risk";
  if (s.startsWith("mod") || s.startsWith("med")) return "Moderate Risk";
  if (s.startsWith("low")) return "Low Risk";
  return undefined;
}

/**
 * Parses and normalizes the model's JSON into a schema-valid ReportJson.
 * Returns null when the payload can't be salvaged so the caller falls back to
 * the heuristic engine.
 */
function coerceReport(raw: unknown): ReportJson | null {
  if (typeof raw !== "string" || !raw.trim()) return null;

  let obj: any;
  try {
    obj = JSON.parse(extractJson(raw));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;

  const scoresIn = obj.categoryScores ?? {};
  const categoryScores = Object.fromEntries(
    SCORE_CATEGORIES.map((c) => [c, clampInt(scoresIn[c], 0, 100, 60)])
  ) as Record<ScoreCategory, number>;

  const severitySet = new Set<string>(SEVERITIES);
  const deviceSet = new Set<string>(DEVICES);

  // Accept both our canonical keys and the leaner alias keys the spec uses
  // (conversion_score, primary_bottleneck, flaws[], issue, suggested_fix,
  // impact) so either output shape parses cleanly.
  const rawIssues = Array.isArray(obj.issues)
    ? obj.issues
    : Array.isArray(obj.flaws)
      ? obj.flaws
      : [];

  const issues = Array.isArray(rawIssues)
    ? rawIssues
        .map((i: any) => {
          if (!i || typeof i !== "object") return null;
          const severity: SeverityLevel = severitySet.has(i.severity)
            ? i.severity
            : impactToSeverity(i.impact);
          let annotation = null;
          if (
            i.annotation &&
            typeof i.annotation === "object" &&
            deviceSet.has(i.annotation.device) &&
            typeof i.annotation.x === "number" &&
            typeof i.annotation.y === "number"
          ) {
            annotation = {
              device: i.annotation.device,
              x: Math.max(0, Math.min(1, i.annotation.x)),
              y: Math.max(0, Math.min(1, i.annotation.y)),
            };
          }
          const psychology = String(
            i.psychology ?? i.psychology_why_it_fails ?? i.whyItMatters ?? ""
          );
          const description = String(
            i.description ?? i.issue_discovered ?? i.issue ?? ""
          );
          return {
            category: String(i.category ?? i.pillar ?? "General"),
            title: String(i.title ?? i.element ?? i.issue ?? "Issue"),
            description,
            // No dedicated "why it matters" field in the rulebook schema — the
            // psychology explanation carries that meaning.
            whyItMatters: String(i.whyItMatters ?? psychology ?? ""),
            psychology,
            severity,
            confidence: clampInt(i.confidence, 0, 100, 70),
            businessImpact: String(i.businessImpact ?? ""),
            suggestedFix: String(
              i.suggestedFix ?? i.actionable_fix ?? i.suggested_fix ?? ""
            ),
            estimatedConversionImpact: String(
              i.estimatedConversionImpact ?? i.estimated_conversion_impact ?? "n/a"
            ),
            complexity: normalizeComplexity(i.complexity),
            riskOfDiy: normalizeDiyRisk(i.riskOfDiy ?? i.risk_of_diy),
            annotation,
          };
        })
        .filter(Boolean)
    : [];

  const recommendations = Array.isArray(obj.recommendations)
    ? obj.recommendations
        .map((r: any) => {
          if (!r || typeof r !== "object") return null;
          return {
            title: String(r.title ?? ""),
            description: String(r.description ?? ""),
            impact: clampInt(r.impact, 1, 5, 3),
            effort: clampInt(r.effort, 1, 5, 3),
            category: String(r.category ?? "General"),
          };
        })
        .filter(Boolean)
    : [];

  const priority = ["high", "medium", "low"].includes(obj.priority)
    ? obj.priority
    : "medium";

  const candidate = {
    overallScore: clampInt(obj.overallScore ?? obj.conversion_score, 0, 100, 60),
    primaryBottleneck: String(
      obj.primaryBottleneck ?? obj.primary_bottleneck ?? ""
    ),
    categoryScores,
    summary: String(obj.summary ?? ""),
    strengths: toStringArray(obj.strengths),
    weaknesses: toStringArray(obj.weaknesses),
    issues,
    recommendations,
    priority,
    confidence: clampInt(obj.confidence, 0, 100, 75),
    estimatedImpact: String(obj.estimatedImpact ?? "n/a"),
  };

  const parsed = reportSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
}

// Strips markdown fences / stray prose and isolates the outermost JSON object.
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]! : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}
