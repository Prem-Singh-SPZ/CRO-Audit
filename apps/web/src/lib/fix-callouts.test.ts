import { describe, expect, it } from "vitest";

import type { IssueDto } from "@cro/shared";
import { buildChangeCallouts } from "./fix-callouts";

function issue(partial: Partial<IssueDto> & Pick<IssueDto, "id" | "title">): IssueDto {
  return {
    category: "Copy",
    description: "d",
    whyItMatters: "why",
    psychology: "why",
    severity: "HIGH",
    confidence: 0.8,
    businessImpact: "",
    suggestedFix: "",
    estimatedConversionImpact: "",
    complexity: null,
    riskOfDiy: null,
    device: "desktop",
    annotationX: 0.4,
    annotationY: 0.2,
    annotationW: 0.2,
    annotationH: 0.1,
    ...partial,
  };
}

const regions = {
  headline: { x: 0.4, y: 0.3, w: 0.5, h: 0.12 },
  bullets: { x: 0.3, y: 0.48, w: 0.3, h: 0.1 },
  cta: { x: 0.22, y: 0.58, w: 0.16, h: 0.06 },
};

describe("buildChangeCallouts", () => {
  it("places the CTA pin on the detected button, not a spare slot", () => {
    const pins = buildChangeCallouts(
      [
        issue({ id: "h", title: "Headline is vague", category: "Headline" }),
        issue({ id: "c", title: "Weak call to action", category: "CTA" }),
      ],
      1,
      regions,
      "m1"
    );
    const cta = pins.find((p) => p.title === "Stronger call to action");
    expect(cta?.annotationY).toBe(0.58);
    expect(cta?.annotationX).toBe(0.22);
  });

  it("does not invent a callout when that element was not found", () => {
    const pins = buildChangeCallouts(
      [issue({ id: "c", title: "Weak call to action", category: "CTA" })],
      1,
      { headline: regions.headline },
      "m1"
    );
    expect(pins).toEqual([]);
  });

  it("does not label the button with a navigation finding", () => {
    const pins = buildChangeCallouts(
      [
        issue({ id: "h", title: "Headline is vague", category: "Headline" }),
        issue({
          id: "n",
          title: "Top Navigation",
          category: "Lead Capture",
        }),
        issue({ id: "c", title: "Weak call to action", category: "CTA" }),
      ],
      1,
      regions,
      "m1"
    );
    expect(pins.map((p) => p.title)).toEqual([
      "Clearer headline",
      "Stronger call to action",
    ]);
    expect(pins.some((p) => /navigation/i.test(p.title))).toBe(false);
  });

  it("does not move an unmatched finding onto the button", () => {
    const pins = buildChangeCallouts(
      [
        issue({ id: "h", title: "Headline is vague", category: "Headline" }),
        issue({ id: "s", title: "Navigation is crowded", category: "UX" }),
      ],
      1,
      regions,
      "m1"
    );
    expect(pins.map((p) => p.title)).toEqual(["Clearer headline"]);
  });

  it("draws nothing when the redesign was not measured", () => {
    const pins = buildChangeCallouts(
      [issue({ id: "h", title: "Headline is vague" })],
      1,
      undefined,
      "m1"
    );
    expect(pins).toEqual([]);
  });
});
