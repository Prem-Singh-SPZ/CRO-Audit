export interface Screenshot {
  device: "desktop" | "mobile";
  url: string;
  width: number;
  height: number;
}

const MICROLINK_ENDPOINT = "https://api.microlink.io";

// Microlink device profile used for the mobile capture (Puppeteer device name).
const MOBILE_DEVICE = "iPhone X";

interface MicrolinkResponse {
  status?: string;
  data?: {
    screenshot?: {
      url?: string;
      width?: number;
      height?: number;
    };
  };
}

async function capture(
  url: string,
  device: "desktop" | "mobile"
): Promise<Screenshot | null> {
  const params = new URLSearchParams({
    url,
    screenshot: "true",
    meta: "false",
  });
  // Mobile uses a device profile; desktop uses Microlink's default viewport
  // (custom viewport params bypass the cache and slow the render down).
  if (device === "mobile") params.set("device", MOBILE_DEVICE);

  const key = process.env.MICROLINK_API_KEY;
  const headers: Record<string, string> = key ? { "x-api-key": key } : {};

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    const res = await fetch(`${MICROLINK_ENDPOINT}/?${params.toString()}`, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const json = (await res.json()) as MicrolinkResponse;
    const shot = json?.data?.screenshot;
    if (json?.status !== "success" || !shot?.url) return null;

    return {
      device,
      url: shot.url,
      width: shot.width ?? (device === "mobile" ? 390 : 1280),
      height: shot.height ?? 0,
    };
  } catch {
    return null;
  }
}

async function captureWithRetry(
  url: string,
  device: "desktop" | "mobile"
): Promise<Screenshot | null> {
  const first = await capture(url, device);
  if (first) return first;
  // Free-tier throttling is common; one short-backoff retry recovers most.
  await new Promise((r) => setTimeout(r, 1200));
  return capture(url, device);
}

/**
 * Captures desktop + mobile screenshots via Microlink's hosted API. Returns
 * hosted image URLs (not base64), so the report payload stays tiny and never
 * blows the sessionStorage quota. Captures run sequentially (the free tier
 * throttles concurrent requests) with a retry; this stays off the critical
 * path since it runs in parallel with the slower PageSpeed call. Keyless works
 * on the free tier; set MICROLINK_API_KEY for higher limits in production.
 */
export async function captureScreenshots(url: string): Promise<Screenshot[]> {
  const shots: Screenshot[] = [];
  const desktop = await captureWithRetry(url, "desktop");
  if (desktop) shots.push(desktop);
  const mobile = await captureWithRetry(url, "mobile");
  if (mobile) shots.push(mobile);
  return shots;
}
