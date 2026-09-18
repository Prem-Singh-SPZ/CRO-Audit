import { describe, expect, it } from "vitest";
import type { PageContext } from "@cro/shared";
import { collectHeuristicCandidates } from "./mock-ai";

function ctx(partial: Partial<PageContext> = {}): PageContext {
  return {
    url: "https://example.com/",
    finalUrl: "https://example.com/",
    title: "Example",
    metaDescription: null,
    lang: "en",
    hasViewportMeta: true,
    isHttps: true,
    headings: { h1: [], h2: [], h3: [] },
    buttons: [],
    ctaTexts: [],
    navLinks: [],
    forms: [],
    images: { total: 0, withAlt: 0, withoutAlt: 0 },
    fonts: [],
    colors: [],
    wordCount: 80,
    copyText: "Hello world",
    hasTestimonials: false,
    hasPricing: false,
    hasTrustBadges: false,
    hasSocialProof: false,
    hasVideo: false,
    loadTimeMs: 1,
    blocked: false,
    blockReason: null,
    ...partial,
  };
}

describe("collectHeuristicCandidates", () => {
  it("flags a missing H1, generic CTA, and no testimonials", () => {
    const candidates = collectHeuristicCandidates(
      ctx({
        ctaTexts: ["Learn more", "Submit"],
      })
    );
    const ids = candidates.map((c) => c.id);
    expect(ids).toContain("missing-h1");
    expect(ids).toContain("generic-cta");
    expect(ids).toContain("no-testimonials");
    expect(ids).toContain("thin-copy");
  });

  it("does not flag a benefit-led H1 with a specific CTA", () => {
    const candidates = collectHeuristicCandidates(
      ctx({
        headings: { h1: ["Grow pipeline 30% without extra headcount"], h2: [], h3: [] },
        ctaTexts: ["Get my free audit"],
        hasTestimonials: true,
        wordCount: 400,
      })
    );
    const ids = candidates.map((c) => c.id);
    expect(ids).not.toContain("missing-h1");
    expect(ids).not.toContain("weak-h1");
    expect(ids).not.toContain("generic-cta");
    expect(ids).not.toContain("no-testimonials");
  });
});
