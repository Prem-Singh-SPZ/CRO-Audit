import { describe, expect, it } from "vitest";
import { jpegDimensions } from "./jpeg-size";

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
