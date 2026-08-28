import "server-only";

// A best-effort, in-memory fixed-window limiter. On serverless this is per
// warm instance (not globally consistent), but it still meaningfully bounds
// abuse from a single client without adding external infrastructure.

const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

/** Derives a client key from the forwarded IP headers, falling back to UA. */
export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("user-agent") ??
    "unknown"
  );
}
