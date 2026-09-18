import { describe, expect, it } from "vitest";

import { detectLiveTestFromHtml } from "./live-test";

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

  it("does not treat marketing copy as a live test", () => {
    expect(
      detectLiveTestFromHtml(
        `<html><h1>Spiralyze case study</h1><p>How we use Optimizely.</p></html>`
      )
    ).toBeNull();
  });
});
