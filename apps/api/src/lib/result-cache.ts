import type { ReportResponse } from "@cro/shared";

/**
 * Opt-in, bounded in-memory cache for full audit results, keyed by
 * {normalized URL, provider, audit-context}. Disabled by default because audit
 * payloads embed base64 screenshots and can be large; enable it only where the
 * extra per-instance memory is acceptable (e.g. a long-lived container).
 *
 * This is a per-instance cache — on a serverless fleet each instance keeps its
 * own copy. Swap the Map for a shared store (Upstash/Vercel KV) to make it
 * cluster-wide; the get/set contract stays the same.
 */

const ENABLED = process.env.ENABLE_RESULT_CACHE === "true";
const TTL_MS = Math.max(
  0,
  Number.parseInt(process.env.RESULT_CACHE_TTL_MS ?? "600000", 10) || 600_000
);
const MAX_ENTRIES = Math.max(
  1,
  Number.parseInt(process.env.RESULT_CACHE_MAX_ENTRIES ?? "20", 10) || 20
);

interface Entry {
  value: ReportResponse;
  expiresAt: number;
}

const store = new Map<string, Entry>();

/**
 * Build a stable cache key. URL is normalized (lowercased host, no trailing
 * slash, fragment dropped) so trivially-different inputs share a hit; provider
 * and audit context are included so a different provider/business context
 * produces a distinct entry.
 */
export function resultCacheKey(
  url: string,
  provider: string,
  auditContext?: unknown
): string {
  let normalized = url.trim();
  try {
    const u = new URL(url);
    u.hash = "";
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.replace(/\/+$/, "");
    }
    normalized = `${u.protocol}//${u.host.toLowerCase()}${u.pathname}${u.search}`;
  } catch {
    /* fall back to the raw string */
  }
  const ctx = auditContext ? JSON.stringify(auditContext) : "";
  return `${provider}::${normalized}::${ctx}`;
}

export function getCachedResult(key: string): ReportResponse | null {
  if (!ENABLED) return null;
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  // Refresh recency for a simple LRU eviction order.
  store.delete(key);
  store.set(key, hit);
  return hit.value;
}

export function setCachedResult(key: string, value: ReportResponse): void {
  if (!ENABLED || TTL_MS === 0) return;
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
}
