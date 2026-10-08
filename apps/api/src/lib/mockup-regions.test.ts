import { describe, expect, it } from "vitest";

import {
  copyStackedAboveForm,
  landmarksFromRegions,
  mockupComplianceFailures,
  parseMockupChecks,
  parseMockupRegions,
} from "./mockup";

describe("parseMockupRegions", () => {
  it("keeps tight boxes and drops nulls and full-frame guesses", () => {
    const regions = parseMockupRegions(
      JSON.stringify({
        headline: { x: 0.42, y: 0.31, w: 0.55, h: 0.14 },
        bullets: null,
        cta: { x: 0.2, y: 0.66, w: 0.98, h: 0.4 },
      })
    );
    expect(regions.headline).toEqual({ x: 0.42, y: 0.31, w: 0.55, h: 0.14 });
    expect(regions.bullets).toBeUndefined();
    expect(regions.cta).toBeUndefined();
  });

  it("keeps a box whose center sits on the image edge", () => {
    const regions = parseMockupRegions(
      JSON.stringify({
        headline: { x: 0.709, y: 1, w: 0.398, h: 0.231 },
      })
    );
    expect(regions.headline).toEqual({ x: 0.709, y: 1, w: 0.398, h: 0.231 });
  });
});

describe("landmarksFromRegions", () => {
  it("pins the headline and a button", () => {
    const landmarks = landmarksFromRegions({
      headline: { x: 0.42, y: 0.31, w: 0.4, h: 0.1 },
      cta: { x: 0.7, y: 0.55, w: 0.16, h: 0.06 },
    });
    expect(landmarks.map((l) => l.id)).toEqual(["h1", "cta"]);
    expect(landmarks[0]).toMatchObject({ x: 0.42, y: 0.31, width: 0.4, height: 0.1 });
  });

  it("drops a box glued to the bottom edge", () => {
    const landmarks = landmarksFromRegions({
      cta: { x: 0.7, y: 0.99, w: 0.16, h: 0.06 },
    });
    expect(landmarks).toEqual([]);
  });

  it("treats a tall primary box as the form", () => {
    const landmarks = landmarksFromRegions({
      cta: { x: 0.72, y: 0.48, w: 0.34, h: 0.4 },
    });
    expect(landmarks.map((l) => l.id)).toEqual(["form"]);
  });

  it("scales a hero-fold box onto a taller stitch", () => {
    const landmarks = landmarksFromRegions(
      { headline: { x: 0.4, y: 0.2, w: 0.3, h: 0.1 } },
      { sourceHeight: 900, stitchHeight: 1800 }
    );
    expect(landmarks[0]).toMatchObject({ y: 0.1, height: 0.05 });
  });
});

describe("mockupComplianceFailures", () => {
  const checks = (over: Partial<ReturnType<typeof base>> = {}) => ({
    ...base(),
    ...over,
  });
  function base() {
    return {
      formFieldCount: 5,
      headlineLines: 2,
      bulletCount: 3,
      navItemCount: 0,
      gibberishText: false,
      primaryButtonVisible: true,
      contentCutOff: false,
    };
  }

  it("passes a compliant render", () => {
    const { hard, soft } = mockupComplianceFailures(checks(), 5);
    expect(hard).toEqual([]);
    expect(soft).toEqual([]);
  });

  it("rejects gibberish text", () => {
    const { hard } = mockupComplianceFailures(
      checks({ gibberishText: true }),
      5
    );
    expect(hard).toHaveLength(1);
  });

  it("rejects a field count off by two or more from the measured form", () => {
    const { hard } = mockupComplianceFailures(
      checks({ formFieldCount: 8 }),
      5
    );
    expect(hard).toHaveLength(1);
  });

  it("only warns on a field count off by one (vision miscounts)", () => {
    const { hard, soft } = mockupComplianceFailures(
      checks({ formFieldCount: 4 }),
      5
    );
    expect(hard).toEqual([]);
    expect(soft).toHaveLength(1);
  });

  it("rejects a 4-line stacked headline, warns on 3", () => {
    expect(
      mockupComplianceFailures(checks({ headlineLines: 4 }), null).hard
    ).toHaveLength(1);
    const three = mockupComplianceFailures(checks({ headlineLines: 3 }), null);
    expect(three.hard).toEqual([]);
    expect(three.soft).toHaveLength(1);
  });

  it("rejects a render with no visible primary button", () => {
    const { hard } = mockupComplianceFailures(
      checks({ primaryButtonVisible: false }),
      5
    );
    expect(hard).toHaveLength(1);
  });

  it("rejects a render clipped by the image edge", () => {
    const { hard } = mockupComplianceFailures(
      checks({ contentCutOff: true }),
      5
    );
    expect(hard).toHaveLength(1);
  });

  it("does not reject when button/cutoff could not be judged", () => {
    const { hard } = mockupComplianceFailures(
      checks({ primaryButtonVisible: null, contentCutOff: null }),
      5
    );
    expect(hard).toEqual([]);
  });

  it("fails open when checks are missing", () => {
    const { hard, soft } = mockupComplianceFailures(null, 5);
    expect(hard).toEqual([]);
    expect(soft).toEqual([]);
  });

  it("ignores the field rule when no closed field list was measured", () => {
    const { hard } = mockupComplianceFailures(
      checks({ formFieldCount: 9 }),
      null
    );
    expect(hard).toEqual([]);
  });
});

describe("copyStackedAboveForm", () => {
  it("flags a headline sitting directly above the form in the same column", () => {
    expect(
      copyStackedAboveForm({
        headline: { x: 0.5, y: 0.2, w: 0.4, h: 0.1 },
        cta: { x: 0.5, y: 0.6, w: 0.35, h: 0.3 },
      })
    ).toBe(true);
  });

  it("passes a side-by-side split (copy left, form right)", () => {
    expect(
      copyStackedAboveForm({
        headline: { x: 0.28, y: 0.45, w: 0.3, h: 0.15 },
        cta: { x: 0.72, y: 0.5, w: 0.3, h: 0.4 },
      })
    ).toBe(false);
  });

  it("passes when a region is missing (nothing to compare)", () => {
    expect(
      copyStackedAboveForm({ headline: { x: 0.5, y: 0.2, w: 0.4, h: 0.1 } })
    ).toBe(false);
  });
});

describe("parseMockupChecks", () => {
  it("parses counts and booleans, nulling anything unreadable", () => {
    expect(
      parseMockupChecks({
        formFieldCount: 5,
        headlineLines: "2",
        bulletCount: null,
        navItemCount: -1,
        gibberishText: false,
      })
    ).toEqual({
      formFieldCount: 5,
      headlineLines: 2,
      bulletCount: null,
      navItemCount: null,
      gibberishText: false,
      primaryButtonVisible: null,
      contentCutOff: null,
    });
  });

  it("returns null for a missing checks object", () => {
    expect(parseMockupChecks(undefined)).toBeNull();
  });
});
