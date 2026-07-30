/**
 * Absolute URL for the GCP (or local) API backend.
 * Empty / unset → same-origin relative paths (only useful if a reverse proxy
 * forwards /api/*; production should set NEXT_PUBLIC_API_URL).
 */
export function apiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalized}` : normalized;
}
