/** SOF0/1/2 width × height from a JPEG buffer. */
export function jpegDimensions(
  buf: Buffer
): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 8 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1]!;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (i + 3 >= buf.length) break;
    const len = (buf[i + 2]! << 8) | buf[i + 3]!;
    if (
      (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) &&
      i + 8 < buf.length
    ) {
      return {
        height: (buf[i + 5]! << 8) | buf[i + 6]!,
        width: (buf[i + 7]! << 8) | buf[i + 8]!,
      };
    }
    i += 2 + Math.max(len, 0);
  }
  return null;
}
