/**
 * Extracts a clean display host (no `www.`) from a URL. Returns `fallback`
 * (defaulting to the original input) when the URL can't be parsed.
 */
export function safeHost(url: string, fallback?: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return fallback ?? url;
  }
}
