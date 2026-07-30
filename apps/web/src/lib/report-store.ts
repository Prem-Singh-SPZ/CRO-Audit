import type { ReportResponse } from "@cro/shared";

// The analyzer produces a full report in one request; we hand it to the report
// page via sessionStorage instead of persisting it server-side.
export const REPORT_STORAGE_KEY = "cro:last-report";

export interface StoreResult {
  ok: boolean;
  // True when we had to drop the (large) screenshot/mockup images to fit quota.
  degraded: boolean;
}

/**
 * Persists the report for the report page. Screenshots are large base64 data
 * URIs, so a full report can exceed the ~5MB sessionStorage quota. We therefore
 * try the full payload first and, on failure, fall back to a slimmed copy
 * (images stripped) so the user still gets a usable report instead of a silent
 * "No report to show". Returns whether anything was stored and whether it was
 * degraded, so the caller can inform the user.
 */
export function storeReport(data: ReportResponse): StoreResult {
  if (trySet(data)) return { ok: true, degraded: false };
  // Retry without the heavy image payloads.
  if (trySet(slimForStorage(data))) return { ok: true, degraded: true };
  return { ok: false, degraded: false };
}

/**
 * Removes the one-time mockup seed once it is no longer needed (e.g. after the
 * "after" mockup has been generated) to reclaim sessionStorage space.
 */
export function stripMockupSeed(data: ReportResponse): ReportResponse {
  return { ...data, mockupSeed: null };
}

function trySet(data: ReportResponse): boolean {
  try {
    sessionStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function slimForStorage(data: ReportResponse): ReportResponse {
  return {
    ...data,
    // Keep dimensions/ids so the UI logic still branches correctly, but drop the
    // multi-MB data URIs that blow the quota.
    screenshots: data.screenshots.map((s) => ({ ...s, url: "" })),
    mockups: data.mockups.map((m) => ({ ...m, url: "" })),
    mockupSeed: null,
  };
}
