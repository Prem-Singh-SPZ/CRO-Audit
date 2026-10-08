import { describe, expect, it } from "vitest";
import type { ReportJson } from "@cro/shared";
import {
  annotationTarget,
  applyLandmarkPins,
  ensureAnnotationCoverage,
  inferLandmarkId,
} from "./landmarks";

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
  it("maps a hero CTA title to the button, not the hero section", () => {
    expect(inferLandmarkId("Hero CTAs")).toBe("cta");
  });
  it("maps a bottom CTA to the in-content button, not the nav", () => {
    expect(inferLandmarkId("Bottom CTA")).toBe("cta");
  });
  it("maps navigation labels to the nav, including a nav button", () => {
    expect(inferLandmarkId("Navigation Bar")).toBe("nav");
    expect(inferLandmarkId("Navigation CTA")).toBe("nav");
  });
  it("does not pin nearby copy onto the headline or the form", () => {
    expect(inferLandmarkId("Benefit Copy (Below Form)")).toBeNull();
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

  it("does not replace a CTA pin with the whole hero section", () => {
    const out = applyLandmarkPins(
      reportWith([
        {
          category: "cta",
          title: "Hero CTAs",
          description: "The hero buttons compete with the headline.",
          whyItMatters: "",
          severity: "HIGH",
          confidence: 80,
          businessImpact: "",
          suggestedFix: "teaser",
          estimatedConversionImpact: "n/a",
          annotation: {
            device: "desktop",
            x: 0.4,
            y: 0.2,
            width: 0.12,
            height: 0.04,
            element: "hero",
          },
        },
      ]),
      [
        ...landmarks,
        {
          id: "hero" as const,
          label: "Hero",
          text: "Track AI Impact",
          x: 0.5,
          y: 0.4,
          width: 1,
          height: 0.5,
        },
        {
          id: "cta" as const,
          label: "Primary call to action",
          text: "Request a demo",
          x: 0.48,
          y: 0.18,
          width: 0.12,
          height: 0.03,
        },
      ]
    );
    expect(out.issues[0]?.annotation?.element).toBe("cta");
    expect(out.issues[0]?.annotation?.y).toBe(0.18);
    expect(out.issues[0]?.annotation?.width).toBe(0.12);
  });

  it("drops a model coordinate that is not a measured landmark", () => {
    const out = applyLandmarkPins(
      reportWith([
        {
          category: "design",
          title: "Too much whitespace in the hero",
          description: "The hero has a large empty gap.",
          whyItMatters: "",
          severity: "LOW",
          confidence: 60,
          businessImpact: "",
          suggestedFix: "teaser",
          estimatedConversionImpact: "n/a",
          annotation: { device: "desktop", x: 0.44, y: 0.61, width: 0.3, height: 0.2 },
        },
      ]),
      landmarks
    );
    expect(out.issues[0]?.annotation).toBeNull();
  });

  it("drops every pin when the page has no measured landmarks", () => {
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
            x: 0.2,
            y: 0.2,
            element: "h1",
          },
        },
      ]),
      []
    );
    expect(out.issues[0]?.annotation).toBeNull();
  });
});

describe("annotationTarget", () => {
  it("asks for 2 pills on one screen and more as the page grows", () => {
    expect(annotationTarget(900)).toBe(2);
    expect(annotationTarget(1600)).toBe(3);
    expect(annotationTarget(3200)).toBeGreaterThan(3);
  });
});

describe("ensureAnnotationCoverage", () => {
  const page = [
    ...landmarks,
    {
      id: "cta" as const,
      label: "Primary call to action",
      text: "Request a demo",
      x: 0.48,
      y: 0.42,
      width: 0.16,
      height: 0.04,
    },
    {
      id: "testimonials" as const,
      label: "Social proof",
      text: "Trusted by teams",
      x: 0.5,
      y: 0.7,
      width: 0.6,
      height: 0.12,
    },
    {
      id: "footer" as const,
      label: "Footer",
      text: "Privacy policy",
      x: 0.5,
      y: 0.92,
      width: 0.8,
      height: 0.08,
    },
    {
      id: "hero" as const,
      label: "Hero",
      text: "Track AI Impact",
      x: 0.5,
      y: 0.3,
      width: 1,
      height: 0.4,
    },
  ];

  it("adds measured pills until a short page has two, and skips the hero", () => {
    const out = ensureAnnotationCoverage(
      reportWith([
        {
          category: "design",
          title: "Too much whitespace",
          description: "The hero has a large empty gap.",
          whyItMatters: "",
          severity: "LOW",
          confidence: 60,
          businessImpact: "",
          suggestedFix: "teaser",
          estimatedConversionImpact: "n/a",
          annotation: null,
        },
      ]),
      page,
      900
    );
    const pinned = out.issues.filter((i) => i.annotation?.element);
    expect(pinned.map((i) => i.annotation?.element)).toEqual(["h1", "cta"]);
    expect(pinned.some((i) => i.annotation?.element === "hero")).toBe(false);
    expect(pinned[0]?.annotation?.x).toBe(0.72);
  });

  it("adds a lower landmark on a taller page", () => {
    const out = ensureAnnotationCoverage(reportWith([]), page, 2800);
    const ids = out.issues.map((i) => i.annotation?.element);
    expect(ids.length).toBeGreaterThanOrEqual(4);
    expect(ids).toContain("footer");
  });

  it("does not add a pill when nothing was measured", () => {
    const out = ensureAnnotationCoverage(
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
          annotation: null,
        },
      ]),
      [],
      2400
    );
    expect(out.issues.every((i) => i.annotation == null)).toBe(true);
  });
});
