/**
 * Internet Archive CDX lookup + replay URL. Backup image only — never used to
 * evade a live WAF/captcha. Snapshots can be months old and often fail to
 * replay JS-heavy pages; callers must prefer a usable live shot.
 */

export interface WaybackHit {
  timestamp: string;
  replayUrl: string;
  capturedAt: string;
  /** Original page URL when parsed from a replay or CDX row. */
  original?: string;
}

const CDX_TIMEOUT_MS = 8_000;
const CDX_ENDPOINT = "https://web.archive.org/cdx/search/cdx";

export function formatCdxTimestamp(ts: string): string {
  if (!/^\d{14}$/.test(ts)) return ts;
  const year = Number(ts.slice(0, 4));
  const month = Number(ts.slice(4, 6));
  const day = Number(ts.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return ts;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function archiveReplayUrl(timestamp: string, original: string): string {
  return `https://web.archive.org/web/${timestamp}/${original}`;
}

/**
 * When the user pastes a Wayback replay URL we still capture it as "live"
 * unless we recognize the host. Parse timestamp + original page.
 */
export function parseWaybackUrl(raw: string): WaybackHit | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./i, "");
    if (!/^(web\.)?archive\.org$/i.test(host)) return null;
    const m = u.pathname.match(
      /^\/web\/(\d{8,14})(?:id_|if_|js_|cs_|im_|oe_)?\/(.+)$/i
    );
    if (!m) return null;
    const timestamp = m[1].padEnd(14, "0");
    let original = decodeURIComponent(m[2]);
    if (!/^https?:\/\//i.test(original)) original = `https://${original}`;
    return {
      timestamp,
      original,
      replayUrl: raw,
      capturedAt: formatCdxTimestamp(timestamp),
    };
  } catch {
    return null;
  }
}

/**
 * CDX query for the newest captures. `limit=-N` is last N (latest);
 * `limit=N` is first N (oldest). `fastLatest` only applies with a negative limit.
 */
export function cdxSearchParams(target: string): URLSearchParams {
  const params = new URLSearchParams();
  params.set("url", target);
  params.set("output", "json");
  params.set("fl", "timestamp,original,statuscode,mimetype");
  params.set("filter", "statuscode:200");
  params.set("limit", "-5");
  params.set("fastLatest", "true");
  return params;
}

/**
 * Pick the newest HTTP 200 HTML (or unspecified) snapshot from CDX JSON.
 * First row may be a header. Empty / malformed input → null.
 */
export function parseCdxRows(json: unknown): WaybackHit | null {
  if (!Array.isArray(json) || json.length === 0) return null;

  const first = json[0];
  const hasHeader = Array.isArray(first) && first.includes("timestamp");
  const header = hasHeader ? (first as unknown[]) : ["timestamp", "original", "statuscode", "mimetype"];
  const rows = hasHeader ? json.slice(1) : json;

  const tsIdx = header.indexOf("timestamp");
  const origIdx = header.indexOf("original");
  const statusIdx = header.indexOf("statuscode");
  const mimeIdx = header.indexOf("mimetype");

  let best: { timestamp: string; original: string } | null = null;
  for (const raw of rows) {
    if (!Array.isArray(raw)) continue;
    const timestamp = String(raw[tsIdx] ?? "");
    const original = String(raw[origIdx] ?? "");
    const status = statusIdx >= 0 ? String(raw[statusIdx] ?? "") : "200";
    const mime = mimeIdx >= 0 ? String(raw[mimeIdx] ?? "") : "";
    if (!/^\d{14}$/.test(timestamp) || !original) continue;
    if (status && status !== "200") continue;
    if (mime && !/html|warc/i.test(mime)) continue;
    if (!best || timestamp > best.timestamp) {
      best = { timestamp, original };
    }
  }
  if (!best) return null;

  return {
    timestamp: best.timestamp,
    replayUrl: archiveReplayUrl(best.timestamp, best.original),
    capturedAt: formatCdxTimestamp(best.timestamp),
  };
}

async function fetchCdx(target: string): Promise<WaybackHit | null> {
  const cdx = new URL(CDX_ENDPOINT);
  cdx.search = cdxSearchParams(target).toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CDX_TIMEOUT_MS);
  try {
    const res = await fetch(cdx.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return parseCdxRows(json);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupWayback(url: string): Promise<WaybackHit | null> {
  // Exact URL only. Falling back to the site origin swapped in the Fastly
  // homepage archive for /request-a-demo when live was marked unusable.
  return fetchCdx(url);
}

/**
 * Hide the Wayback Machine toolbar / donate chrome. Self-contained for
 * page.evaluate — `if_` replay usually strips this already.
 */
export function hideArchiveChromeInPage(): number {
  let hidden = 0;
  const ids = ["wm-ipp-base", "wm-ipp", "wm-ipp-inside", "donato", "donato-container"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!(el instanceof HTMLElement)) continue;
    el.style.setProperty("display", "none", "important");
    hidden += 1;
  }
  return hidden;
}
