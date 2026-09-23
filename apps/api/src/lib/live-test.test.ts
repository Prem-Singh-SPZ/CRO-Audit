import { describe, expect, it } from "vitest";

import { detectLiveTestFromHtml, urlForcesOriginalControl } from "./live-test";

describe("detectLiveTestFromHtml", () => {
  it("detects Spiralyze from a script URL", () => {
    expect(
      detectLiveTestFromHtml(
        `<html><script src="https://cdn.spiralyze.com/client.js"></script></html>`
      )
    ).toEqual({ vendor: "Spiralyze" });
  });

  it("detects Optimizely from a global assignment", () => {
    expect(
      detectLiveTestFromHtml(
        `<html><script>window.optimizely = window.optimizely || [];</script></html>`
      )
    ).toEqual({ vendor: "Optimizely" });
  });

  it("detects VWO from a class prefix, not body copy", () => {
    expect(
      detectLiveTestFromHtml(
        `<html><div class="vwo-preview-bar">QA</div></html>`
      )
    ).toEqual({ vendor: "VWO" });
    expect(
      detectLiveTestFromHtml(
        `<html><p>We run A/B tests and multivariate experiments.</p></html>`
      )
    ).toBeNull();
  });

  it("detects Varify from its script host", () => {
    expect(
      detectLiveTestFromHtml(
        `<html><script src="https://app.varify.io/v.js"></script></html>`
      )
    ).toEqual({ vendor: "Varify" });
  });

  it("treats varify-preview=original as the control, not a variation preview", () => {
    expect(
      urlForcesOriginalControl("https://www.maxio.com/?varify-preview=original")
    ).toBe(true);
    expect(
      urlForcesOriginalControl("https://www.maxio.com/?varify-preview=original&x=1")
    ).toBe(true);
    expect(
      urlForcesOriginalControl("https://www.maxio.com/?varify-preview=4821")
    ).toBe(false);
    expect(urlForcesOriginalControl("https://www.maxio.com/")).toBe(false);
  });

  it("recognizes other tools' opt-out params", () => {
    expect(
      urlForcesOriginalControl("https://example.com/?optimizely_opt_out=true")
    ).toBe(true);
    expect(
      urlForcesOriginalControl("https://example.com/?vwo_opt_out=1")
    ).toBe(true);
    expect(
      urlForcesOriginalControl("https://example.com/?optimizely_opt_out=false")
    ).toBe(false);
  });

  it("does not treat marketing copy as a live test", () => {
    expect(
      detectLiveTestFromHtml(
        `<html><h1>Spiralyze case study</h1><p>How we use Optimizely.</p></html>`
      )
    ).toBeNull();
  });
});
