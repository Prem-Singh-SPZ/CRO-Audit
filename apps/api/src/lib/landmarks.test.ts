import { describe, expect, it } from "vitest";
import type { ReportJson } from "@cro/shared";
import { applyLandmarkPins, inferLandmarkId } from "./landmarks";

const landmarks = [
  {
    id: "h1" as const,
    label: "Primary headline",
    text: "Track AI Impact",
    x: 0.72,
    y: 0.3,
    width: 0.4,
    height: 0.16,
  },
  {
    id: "form" as const,
    label: "Primary form",
    text: "Work email",
    x: 0.22,
    y: 0.48,
    width: 0.32,
    height: 0.4,
  },
];

function reportWith(
  issues: ReportJson["issues"]
): ReportJson {
  return {
    overallScore: 60,
    primaryBottleneck: "Weak headline",
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
    summary: "Test",
    strengths: [],
    weaknesses: [],
    issues,
    recommendations: [],
    priority: "medium",
    confidence: 70,
    estimatedImpact: "n/a",
  };
}

describe("inferLandmarkId", () => {
  it("maps headline copy to h1", () => {
    expect(inferLandmarkId("Hero Headline is vague")).toBe("h1");
  });
  it("maps form fields to form", () => {
    expect(inferLandmarkId("Email field friction")).toBe("form");
  });
});

describe("applyLandmarkPins", () => {
  it("overwrites model x/y when annotation.element is a measured landmark", () => {
    const out = applyLandmarkPins(
      reportWith([
        {
          category: "copy",
          title: "Weak headline",
          description: "The H1 is vague.",
          whyItMatters: "",
          severity: "HIGH",
          confidence: 80,
          businessImpact: "",
          suggestedFix: "teaser",
          estimatedConversionImpact: "n/a",
          annotation: {
            device: "desktop",
            x: 0.1,
            y: 0.1,
            width: 0.1,
            height: 0.1,
            element: "h1",
          },
        },
      ]),
      landmarks
    );
    expect(out.issues[0]?.annotation?.x).toBe(0.72);
    expect(out.issues[0]?.annotation?.y).toBe(0.3);
    expect(out.issues[0]?.annotation?.element).toBe("h1");
  });

  it("infers a landmark from the title when element is missing", () => {
    const out = applyLandmarkPins(
      reportWith([
        {
          category: "forms",
          title: "Form asks for too much",
          description: "The lead form is long.",
          whyItMatters: "",
          severity: "MEDIUM",
          confidence: 70,
          businessImpact: "",
          suggestedFix: "teaser",
          estimatedConversionImpact: "n/a",
          annotation: { device: "desktop", x: 0.5, y: 0.5 },
        },
      ]),
      landmarks
    );
    expect(out.issues[0]?.annotation?.x).toBe(0.22);
    expect(out.issues[0]?.annotation?.element).toBe("form");
  });
});
