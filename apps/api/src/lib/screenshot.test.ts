import { describe, expect, it } from "vitest";
import { jpegDimensions } from "./jpeg-size";
import { clampShotHeight } from "./screenshot";

/** Minimal SOF0 JPEG: 1440×2400. */
function fakeJpeg(width: number, height: number): Buffer {
  const sof = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01, 0x01, 0x11, 0x00,
  ]);
  return sof;
}

describe("clampShotHeight", () => {
  it("keeps a normal document height", () => {
    expect(clampShotHeight(3200)).toBe(3200);
  });

  it("clamps to the default 16000 cap", () => {
    expect(clampShotHeight(24_000)).toBe(16_000);
  });

  it("falls back to the 900 fold when the measure is invalid", () => {
    expect(clampShotHeight(0)).toBe(900);
    expect(clampShotHeight(-10)).toBe(900);
    expect(clampShotHeight(Number.NaN)).toBe(900);
  });

  it("honors an explicit cap", () => {
    expect(clampShotHeight(5000, 2000)).toBe(2000);
  });
});

describe("jpegDimensions", () => {
  it("reads SOF0 width and height", () => {
    expect(jpegDimensions(fakeJpeg(1440, 2400))).toEqual({
      width: 1440,
      height: 2400,
    });
  });

  it("rejects non-jpeg bytes", () => {
    expect(jpegDimensions(Buffer.from([0x00, 0x01, 0x02]))).toBeNull();
  });
});
