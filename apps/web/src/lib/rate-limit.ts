/**
 * Lightweight, dependency-free, in-memory rate limiter.
 *
 * This uses a fixed-window counter kept in module scope. It protects a single
 * serverless/instance from abuse (denial-of-wallet on the Puppeteer + LLM +
 * image APIs). For a fleet of instances behind a load balancer, swap this for a
 * shared store (Upstash Redis / Vercel KV) using the same interface — see
 * RATE_LIMIT_* env vars.
 */

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();
// Cap the map so a flood of unique IPs can't grow memory unbounded.
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Epoch ms when the current window resets. */
  reset: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) pruneExpired(now);
    const win: Window = { count: 1, resetAt: now + windowMs };
    buckets.set(key, win);
    return { success: true, remaining: limit - 1, reset: win.resetAt };
  }

  if (existing.count >= limit) {
    return { success: false, remaining: 0, reset: existing.resetAt };
  }

  existing.count += 1;
  return {
    success: true,
    remaining: limit - existing.count,
    reset: existing.resetAt,
  };
}

function pruneExpired(now: number): void {
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
  // If everything is still live, drop the oldest entry to stay bounded.
  if (buckets.size >= MAX_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest) buckets.delete(oldest);
  }
}

/**
 * Best-effort client IP extraction from proxy headers (Vercel / standard
 * reverse proxies). Falls back to a shared bucket so limits still apply when no
 * IP is available.
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

const num = (v: string | undefined, fallback: number): number => {
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Tunable limits (per IP). Defaults are conservative for expensive routes. */
export const RATE_LIMITS = {
  analyze: {
    limit: num(process.env.RATE_LIMIT_ANALYZE_MAX, 10),
    windowMs: num(process.env.RATE_LIMIT_ANALYZE_WINDOW_MS, 60_000),
  },
  mockup: {
    limit: num(process.env.RATE_LIMIT_MOCKUP_MAX, 15),
    windowMs: num(process.env.RATE_LIMIT_MOCKUP_WINDOW_MS, 60_000),
  },
} as const;
