export interface Mockup {
  device: "desktop" | "mobile";
  // Full data URI (data:image/png;base64,...) for rendering in the report UI
  // without any external image host.
  dataUri: string;
  mimeType: string;
  width: number;
  height: number;
}

// A single diagnosed flaw, trimmed to just what the redesign brief needs.
export interface MockupIssueBrief {
  severity: string;
  category: string;
  title: string;
  description: string;
}

export interface MockupInput {
  // Raw base64 (no data-URI prefix) of the source hero screenshot.
  imageBase64: string;
  mimeType: string;
  host: string;
  primaryBottleneck?: string;
  issues: MockupIssueBrief[];
}

// How many top issues to feed the image model as the redesign brief. Enough to
// steer the redesign without overwhelming the prompt.
const MAX_ISSUES_IN_BRIEF = 8;
// Image generation can be slow; keep it well under the route's maxDuration so a
// slow render degrades gracefully to "no mockup" instead of failing the report.
const TIMEOUT_MS = 90_000;

/**
 * Generates an AI "after" concept image using Gemini's native image model
 * ("Nano Banana"). It takes the REAL desktop screenshot as an input image and
 * asks the model to re-render the same page with the audit's diagnosed
 * conversion fixes applied — a photorealistic before/after teaser.
 *
 * Best-effort: returns null on any misconfiguration/error/timeout so the report
 * always renders (with just the annotated "before") even with zero image keys.
 */
export async function generateFixMockup(
  input: MockupInput
): Promise<Mockup | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (String(process.env.ENABLE_FIX_MOCKUP ?? "true").toLowerCase() === "false") {
    return null;
  }

  if (!input.imageBase64) return null;

  // Nano Banana Pro renders far crisper, correctly-spelled text than the legacy
  // 2.5-flash-image. imageSize + aspectRatio concentrate resolution on a single
  // hero screenful so copy stays large and legible instead of tiny/garbled.
  const model = process.env.MOCKUP_MODEL || "gemini-3-pro-image-preview";
  const imageSize = process.env.MOCKUP_IMAGE_SIZE || "2K";
  const aspectRatio = process.env.MOCKUP_ASPECT_RATIO || "16:9";

  try {
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
            contents: [
              {
                parts: [
                  { text: buildPrompt(input) },
                  {
                    inlineData: {
                      mimeType: input.mimeType,
                      data: input.imageBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["IMAGE"],
              imageConfig: { imageSize, aspectRatio },
            },
          }),
        }
      )
    );

    if (!res.ok) {
      console.error("[mockup] Gemini image HTTP", res.status, await safeText(res));
      return null;
    }

    const json = (await res.json()) as any;
    const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p?.inlineData?.data);
    if (!imagePart) {
      console.error(
        "[mockup] Gemini returned no image (finishReason=" +
          json?.candidates?.[0]?.finishReason +
          ")"
      );
      return null;
    }

    const mimeType: string = imagePart.inlineData.mimeType || "image/png";
    const data: string = imagePart.inlineData.data;

    return {
      device: "desktop",
      mimeType,
      dataUri: `data:${mimeType};base64,${data}`,
      // The generated image is reflowed by the model; the UI renders it
      // responsively (w-full h-auto), so exact source dims aren't needed.
      width: 0,
      height: 0,
    };
  } catch (err) {
    console.error("[mockup] generation failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildPrompt(input: MockupInput): string {
  const brief = topIssuesBrief(input.issues);
  const host = safeHost(input.host);

  return `You are a senior conversion-rate-optimization (CRO) designer and art director.

The attached image is an above-the-fold DESKTOP screenshot of the website "${host}". Using it as reference, produce ONE photorealistic, high-fidelity REDESIGN of the primary ABOVE-THE-FOLD hero section (the first screenful) as a believable "after" mockup of the improved site.

OUTPUT FORMAT (critical for clarity):
- Render a FLAT, full-bleed desktop website screenshot that fills the entire frame edge to edge. It must look like a real browser screenshot of the page — NOT a photo of a laptop/monitor, NOT placed inside a device frame, NOT a scene or 3D mockup, no drop shadows around it, no borders.
- Redesign ONLY the top hero / above-the-fold area (nav + headline + subheadline + primary CTA + supporting hero visual/trust strip). Do NOT try to recreate the entire long page — concentrating on one screenful keeps every element large, sharp, and readable.

TEXT QUALITY (critical):
- Every word of text must be sharp, high-contrast, and SPELLED CORRECTLY with real dictionary words. Re-read all text before finalizing.
- Use only SHORT marketing copy (a headline, one subheadline line, button labels, a few nav items, a short trust line). Do NOT fill the page with dense paragraphs or tiny body text — small or lorem-ipsum-like text becomes blurry and garbled, so avoid it entirely.

BRAND & CONTENT:
- Preserve the brand identity: same logo/brand name, product/service, and color palette as the reference.
- Keep the messaging topically the same but rewrite weak copy to be clearer and more persuasive.
- No callout pins, numbered markers, red circles, annotations, captions, or side-by-side comparisons — just the clean improved hero itself.

APPLY THESE SPECIFIC CONVERSION FIXES (diagnosed for this exact page):
${input.primaryBottleneck ? `- Primary bottleneck to resolve: ${input.primaryBottleneck}\n` : ""}${brief}

DESIGN GOALS: sharpen the value proposition headline and subheadline for a 5-second clarity test, establish a strong visual hierarchy that guides the eye to ONE prominent, benefit-driven primary call-to-action, and add a tasteful trust/social-proof element near it while reducing clutter.

Return ONLY the redesigned hero image.`;
}

function topIssuesBrief(issues: MockupIssueBrief[]): string {
  const order: Record<string, number> = {
    HIGH: 0,
    MEDIUM: 1,
    LOW: 2,
    INFO: 3,
  };
  const sorted = [...issues].sort(
    (a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9)
  );
  const lines = sorted.slice(0, MAX_ISSUES_IN_BRIEF).map((i) => {
    const where = i.title ? `${i.category} — ${i.title}` : i.category;
    return `- [${i.severity}] ${where}: ${collapse(i.description)}`;
  });
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collapse(text: string, max = 240): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function withTimeout(
  fn: (signal: AbortSignal) => Promise<Response>,
  ms = TIMEOUT_MS
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
