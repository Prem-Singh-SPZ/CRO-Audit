import { describe, expect, it } from "vitest";
import { experimentPreviewFrame } from "./experiment-preview";

describe("experimentPreviewFrame", () => {
  it("keeps a hero headline fully in frame on a tall stitch", () => {
    const frame = experimentPreviewFrame({
      x: 0.28,
      y: 0.12,
      w: 0.36,
      h: 0.06,
      imageWidth: 1440,
      imageHeight: 9000,
    });
    expect(frame.top).toBeLessThan(0.12);
    expect(frame.top + frame.height).toBeGreaterThan(0.12 + 0.03);
    expect(frame.left).toBeGreaterThanOrEqual(0);
    expect(frame.left + frame.width).toBeLessThanOrEqual(1);
    // Preview is a 16:9 window in pixel space
    const pxW = frame.width * 1440;
    const pxH = frame.height * 9000;
    expect(pxW / pxH).toBeCloseTo(16 / 9, 1);
  });

  it("defaults to the top fold when no pin exists", () => {
    const frame = experimentPreviewFrame({
      imageWidth: 1440,
      imageHeight: 7200,
    });
    expect(frame.top).toBe(0);
    expect(frame.left).toBe(0);
    expect(frame.height).toBeGreaterThan(0.08);
  });
});
