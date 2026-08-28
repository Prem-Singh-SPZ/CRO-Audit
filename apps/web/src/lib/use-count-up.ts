"use client";

import * as React from "react";

/**
 * Animates a number from 0 up to `end` once the element scrolls into view.
 * Respects the OS "reduce motion" preference by snapping straight to `end`.
 * Returns the current value plus a ref to attach to the trigger element.
 */
export function useCountUp(
  end: number,
  {
    durationMs = 1400,
    decimals = 0,
  }: { durationMs?: number; decimals?: number } = {}
) {
  const ref = React.useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = React.useState(0);
  const started = React.useRef(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(end);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || started.current) return;
        started.current = true;

        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          // easeOutCubic for a lively-but-settling ramp.
          const eased = 1 - Math.pow(1 - t, 3);
          const next = end * eased;
          setValue(decimals > 0 ? Number(next.toFixed(decimals)) : Math.round(next));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [end, durationMs, decimals]);

  return { value, ref };
}
