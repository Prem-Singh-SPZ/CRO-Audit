"use client";

// The scan request handed from the URL form to the /analyzing screen, which
// runs the actual audit while showing the animated scanning experience.

export const PENDING_SCAN_KEY = "cro:pending-scan";

export interface PendingScan {
  url: string;
  targetAudience?: string;
  coreProduct?: string;
  primaryTrafficSource?: string;
}

export function setPendingScan(scan: PendingScan) {
  try {
    sessionStorage.setItem(PENDING_SCAN_KEY, JSON.stringify(scan));
  } catch {
    // ignore — the analyzing page falls back to an empty state.
  }
}

export function takePendingScan(): PendingScan | null {
  try {
    const raw = sessionStorage.getItem(PENDING_SCAN_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_SCAN_KEY);
    return JSON.parse(raw) as PendingScan;
  } catch {
    return null;
  }
}
