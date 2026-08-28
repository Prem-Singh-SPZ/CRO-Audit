"use client";

import { upload } from "@vercel/blob/client";

import { stripMockupSeed } from "@/lib/report-store";
import type { ReportResponse } from "@cro/shared";

// Client-side verification state. A short-lived HMAC token (minted by
// /api/otp/verify) is kept in localStorage so a verified visitor stays
// unlocked across reloads and can email themselves the report.

const TOKEN_KEY = "cro:verified-token";
const EMAIL_KEY = "cro:verified-email";

export function getVerification(): { token: string; email: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const token = window.localStorage.getItem(TOKEN_KEY);
    const email = window.localStorage.getItem(EMAIL_KEY);
    if (token && email) return { token, email };
  } catch {
    // localStorage unavailable (private mode) — treat as unverified.
  }
  return null;
}

export function setVerification(token: string, email: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(EMAIL_KEY, email);
  } catch {
    // Non-fatal: the in-memory state (React) still unlocks for this session.
  }
}

export function clearVerification() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(EMAIL_KEY);
  } catch {
    // ignore
  }
}

/**
 * Uploads the current report to Blob (reusing the share pipeline) and returns
 * the on-domain `/share/<id>` viewer link that we can email to the user.
 */
export async function uploadReportForShare(
  data: ReportResponse
): Promise<string> {
  const id = crypto.randomUUID();
  const payload = JSON.stringify(stripMockupSeed(data));
  await upload(`reports/${id}.json`, payload, {
    access: "public",
    handleUploadUrl: "/api/share/upload",
    contentType: "application/json",
  });
  return `${window.location.origin}/share/${id}`;
}
