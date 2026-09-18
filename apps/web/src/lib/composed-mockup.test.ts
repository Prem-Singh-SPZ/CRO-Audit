import { describe, expect, it } from "vitest";

import type { IssueDto, ReportResponse } from "@cro/shared";

import { clipCopy, composeMockup, conceptCopy } from "./composed-mockup";

function issue(partial: Partial<IssueDto> & Pick<IssueDto, "title">): IssueDto {
  return {
    id: partial.id ?? "i1",
    category: partial.category ?? "Clarity",
    title: partial.title,
    description: "",
    whyItMatters: "",
    psychology: "",
    severity: partial.severity ?? "HIGH",
    confidence: 0.8,
    businessImpact: "",
    suggestedFix: "",
    estimatedConversionImpact: "",
    complexity: null,
    riskOfDiy: null,
    device: "desktop",
    annotationX: null,
    annotationY: null,
    annotationW: null,
    annotationH: null,
  };
}

function report(partial: Partial<ReportResponse> = {}): ReportResponse {
  return {
    scan: {
      id: "s1",
      url: "https://example.com",
      status: "COMPLETE",
      progress: 100,
      stage: "complete",
      error: null,
      createdAt: "",
      completedAt: "",
      shareId: null,
    },
    report: {
      id: "r1",
      overallScore: 50,
      primaryBottleneck: "",
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
      summary: "",
      strengths: [],
      weaknesses: [],
      priority: "high",
      confidence: 0.5,
      estimatedImpact: "",
      aiProvider: "mock",
    },
    issues: [],
    recommendations: [],
    screenshots: [],
    mockups: [],
    mockupSeed: null,
    lighthouse: null,
    ...partial,
  };
}

describe("composeMockup", () => {
  it("prefers the hero seed so the overlay sits on a viewport frame", () => {
    const mockup = composeMockup(
      report({
        mockupSeed: { image: "abc123", mimeType: "image/jpeg" },
        screenshots: [
          {
            id: "d",
            device: "desktop",
            url: "data:image/jpeg;base64,stitch",
            width: 1440,
            height: 6000,
          },
        ],
      })
    );
    expect(mockup?.source).toBe("composed");
    expect(mockup?.url).toBe("data:image/jpeg;base64,abc123");
    expect(mockup?.height).toBe(900);
  });

  it("falls back to the desktop screenshot when the seed is gone", () => {
    const mockup = composeMockup(
      report({
        screenshots: [
          {
            id: "d",
            device: "desktop",
            url: "data:image/jpeg;base64,stitch",
            width: 1440,
            height: 3200,
          },
        ],
      })
    );
    expect(mockup?.url).toContain("stitch");
    expect(mockup?.height).toBe(3200);
  });

  it("returns null when there is no image to overlay", () => {
    expect(composeMockup(report())).toBeNull();
  });
});

describe("conceptCopy", () => {
  it("uses a copy/hero finding for the headline and fills three bullets", () => {
    const copy = conceptCopy([
      issue({
        id: "a",
        title: "Vague curiosity-gap headline that rambles on far too long for a card",
        category: "Clarity",
        severity: "HIGH",
      }),
      issue({ id: "b", title: "CTA is below the fold", category: "Friction" }),
    ]);
    expect(copy.headline.length).toBeLessThanOrEqual(72);
    expect(copy.headline).toMatch(/headline/i);
    expect(copy.bullets).toHaveLength(3);
    expect(copy.bullets[0]).toMatch(/CTA/i);
  });

  it("clips long strings with an ellipsis", () => {
    expect(clipCopy("abcdefghij", 6)).toBe("abcde…");
  });
});
