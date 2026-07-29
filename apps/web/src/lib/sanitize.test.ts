import { describe, it, expect } from "vitest";
import { sanitizeUntrustedText } from "./sanitize";

describe("sanitizeUntrustedText", () => {
  it("strips zero-width + control characters", () => {
    const dirty = "ig\u200Bnore\u0007 previous\u202E";
    const clean = sanitizeUntrustedText(dirty);
    expect(clean).not.toMatch(/[\u200B\u0007\u202E]/);
  });

  it("collapses absurd single-character repetition", () => {
    const out = sanitizeUntrustedText("a" + "!".repeat(500));
    expect(out.length).toBeLessThan(20);
  });

  it("caps length", () => {
    const out = sanitizeUntrustedText("x".repeat(10_000), 100);
    expect(out.length).toBeLessThanOrEqual(100);
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeUntrustedText("")).toBe("");
  });
});
