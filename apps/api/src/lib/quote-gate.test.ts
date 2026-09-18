import { describe, expect, it } from "vitest";
import type { IssueInput, PageContext } from "@cro/shared";
import { applyQuoteGate, issueIsGrounded } from "./quote-gate";

const ctx = {
  url: "https://www.activtrak.com/",
  finalUrl: "https://www.activtrak.com/",
  title: "ActivTrak | Workforce Analytics",
  metaDescription: null,
  lang: "en",
  hasViewportMeta: true,
  isHttps: true,
  headings: {
    h1: ["Track AI Impact and Optimize How Work Gets Done"],
    h2: ["Get started free"],
    h3: [],
  },
  buttons: [],
  ctaTexts: ["Get started free"],
  navLinks: [],
  forms: [
    {
      action: null,
      method: "post",
      fieldCount: 1,
      fields: [
        { type: "email", name: "email", label: "Work email", required: true, placeholder: null },
      ],
      submitText: "Get started free",
    },
  ],
  images: { total: 0, withAlt: 0, withoutAlt: 0 },
  fonts: [],
  colors: [],
  wordCount: 120,
  copyText:
    "Track AI Impact and Optimize How Work Gets Done. Get started free. Work email. No credit card required.",
  hasTestimonials: false,
  hasPricing: false,
  hasTrustBadges: false,
  hasSocialProof: false,
  hasVideo: false,
  loadTimeMs: 1,
  blocked: false,
  blockReason: null,
} satisfies PageContext;

function issue(partial: Partial<IssueInput>): IssueInput {
  return {
    category: "copy",
    title: "Headline",
    description: 'The H1 reads "Track AI Impact and Optimize How Work Gets Done".',
    whyItMatters: "",
    severity: "HIGH",
    confidence: 80,
    businessImpact: "",
    suggestedFix: "teaser",
    estimatedConversionImpact: "n/a",
    ...partial,
  };
}

describe("issueIsGrounded", () => {
  it("keeps an issue that quotes real page copy", () => {
    expect(issueIsGrounded(issue({}), ctx)).toBe(true);
  });

  it("drops a fabricated issue with no page words", () => {
    expect(
      issueIsGrounded(
        issue({
          title: "Missing chatbot",
          description:
            "Visitors cannot find a holographic wizard or quantum checkout portal anywhere.",
        }),
        ctx
      )
    ).toBe(false);
  });

  it("passes when the crawl is too thin to verify", () => {
    expect(
      issueIsGrounded(issue({ description: "Anything goes" }), {
        ...ctx,
        copyText: "",
        title: "x",
        headings: { h1: [], h2: [], h3: [] },
        ctaTexts: [],
        forms: [],
        wordCount: 2,
      })
    ).toBe(true);
  });
});

describe("applyQuoteGate", () => {
  it("removes ungrounded issues and keeps quoted ones", () => {
    const out = applyQuoteGate(
      {
        overallScore: 60,
        categoryScores: {
          hero: 50,
          trust: 50,
          cta: 50,
          copy: 50,
          design: 50,
          forms: 50,
          accessibility: 50,
          performance: 50,
          mobile: 50,
          psychology: 50,
          seo: 50,
          navigation: 50,
        },
        summary: "s",
        strengths: [],
        weaknesses: [],
        issues: [
          issue({}),
          issue({
            title: "Invented",
            description: "A holographic wizard blocks the quantum checkout portal.",
          }),
        ],
        recommendations: [],
        priority: "medium",
        confidence: 70,
        estimatedImpact: "n/a",
      },
      ctx
    );
    expect(out.issues).toHaveLength(1);
    expect(out.issues[0]?.title).toBe("Headline");
  });
});
