import { describe, expect, it } from "vitest";

import { parseMockupRegions } from "./mockup";

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
});
