/**
 * 16:9 window into a tall stitch so experiment cards show the finding
 * (plus air above a headline) instead of a mid-letter CSS zoom.
 */
export function experimentPreviewFrame(input: {
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
  imageWidth: number;
  imageHeight: number;
}): { left: number; top: number; width: number; height: number } {
  const imageW = Math.max(1, input.imageWidth);
  const imageH = Math.max(1, input.imageHeight);
  const boxAspect = 16 / 9;
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

  const fold = Math.min(1, 900 / imageH);
  const minH = Math.max(0.08, fold * 0.9);

  const hasPin = input.x != null && input.y != null;
  const bh = input.h && input.h > 0 ? input.h : 0.08;
  const cx = hasPin ? clamp01(input.x as number) : 0.5;
  const cy = hasPin ? clamp01(input.y as number) : fold / 2;

  let nh = Math.max(minH, bh + (cy < 0.35 ? 0.06 : 0.03));
  let nw = nh * boxAspect * (imageH / imageW);
  if (nw > 1) {
    nw = 1;
    nh = nw / (boxAspect * (imageH / imageW));
  }
  nh = Math.min(1, nh);

  let left = hasPin ? cx - nw / 2 : 0;
  let top = hasPin ? cy - bh / 2 - (cy < 0.35 ? nh * 0.28 : nh * 0.18) : 0;
  left = clamp01(left);
  top = clamp01(top);
  if (left + nw > 1) left = 1 - nw;
  if (top + nh > 1) top = 1 - nh;

  return { left, top, width: nw, height: nh };
}
