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
} from "@/lib/cro";
import { analyzeMock } from "@/lib/mock-ai";
import type { Screenshot } from "@/lib/screenshot";

export interface GenerateInput {
  pageContext: PageContext;
  lighthouse: LighthouseSummary;
  screenshots: Screenshot[];
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
  return `You are a world-class Conversion Rate Optimization (CRO) expert auditing a landing page. You are given (1) structured signals crawled from the page, (2) PageSpeed/Lighthouse metrics, and (3) a full-page DESKTOP screenshot of the page.

Analyze the ENTIRE page from top to bottom — hero, value proposition, features, testimonials, social proof, pricing, forms, footer, and every section in between. The screenshot provided is a FULL-PAGE desktop capture (not just above-the-fold). Every issue you raise MUST reference concrete, page-specific evidence (quote the real headline, the real CTA labels, the real form fields, real counts/metrics). Do NOT emit generic boilerplate that could apply to any site. Do NOT focus only on the hero section. Prefer 5-9 high-signal, distinct issues spread across DIFFERENT sections of the page.

Return ONLY a JSON object (no markdown, no prose) with EXACTLY this shape:
{
  "overallScore": <int 0-100>,
  "categoryScores": { ${SCORE_CATEGORIES.map((c) => `"${c}": <int 0-100>`).join(", ")} },
  "summary": <string, 2-4 sentences, references this page specifically>,
  "strengths": [<string>, ...],
  "weaknesses": [<string>, ...],
  "issues": [
    {
      "category": <short string e.g. "Headline", "CTA", "Trust Signals", "Forms", "Performance", "Mobile UX">,
      "title": <string, specific>,
      "description": <string, cites concrete evidence from THIS page>,
      "whyItMatters": <string>,
      "severity": <one of ${SEVERITIES.join(" | ")}>,
      "confidence": <int 0-100>,
      "businessImpact": <string>,
      "suggestedFix": <string, concrete and actionable>,
      "estimatedConversionImpact": <string e.g. "+4-9%">,
      "annotation": { "device": <${DEVICES.join(" | ")}>, "x": <0-1>, "y": <0-1> } | null
    }
  ],
  "recommendations": [
    { "title": <string>, "description": <string>, "impact": <int 1-5>, "effort": <int 1-5>, "category": <string> }
  ],
  "priority": <"high" | "medium" | "low">,
  "confidence": <int 0-100>,
  "estimatedImpact": <string e.g. "+12-28% conversions">
}

For "annotation", ALWAYS use "device": "desktop" (only a desktop screenshot is available). Set x/y to the fractional position (0=left/top, 1=right/bottom) of the element on the desktop screenshot, so it can be pinned visually. Use null when the issue isn't tied to a visible spot. All categoryScores keys are required.`;
}

function userText(input: GenerateInput): string {
  return `Audit this page TOP TO BOTTOM and return the JSON report.\n\nCRAWLED SIGNALS + METRICS:\n${compactContext(
    input.pageContext,
    input.lighthouse
  )}\n\nA full-page desktop screenshot is attached. Scroll through the ENTIRE screenshot — analyze the hero, mid-page content (features, testimonials, social proof, pricing), forms, and footer. Base your visual/hierarchy findings on it.`;
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
            // output budget; give ample room and keep thinking low so the JSON
            // report always completes (avoids truncated, unparseable output).
            maxOutputTokens: 65536,
            thinkingConfig: { thinkingLevel: "low" },
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

  const issues = Array.isArray(obj.issues)
    ? obj.issues
        .map((i: any) => {
          if (!i || typeof i !== "object") return null;
          const severity: SeverityLevel = severitySet.has(i.severity)
            ? i.severity
            : "MEDIUM";
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
          return {
            category: String(i.category ?? "General"),
            title: String(i.title ?? "Issue"),
            description: String(i.description ?? ""),
            whyItMatters: String(i.whyItMatters ?? ""),
            severity,
            confidence: clampInt(i.confidence, 0, 100, 70),
            businessImpact: String(i.businessImpact ?? ""),
            suggestedFix: String(i.suggestedFix ?? ""),
            estimatedConversionImpact: String(i.estimatedConversionImpact ?? "n/a"),
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
    overallScore: clampInt(obj.overallScore, 0, 100, 60),
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
