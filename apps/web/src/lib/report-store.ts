import type { ReportResponse } from "@/lib/types";

// The analyzer produces a full report in one request; we hand it to the report
// page via sessionStorage instead of persisting it server-side.
export const REPORT_STORAGE_KEY = "cro:last-report";

export function storeReport(data: ReportResponse) {
  try {
    sessionStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode / quota) — the report page will show
    // its empty state, which is an acceptable degradation.
  }
}
