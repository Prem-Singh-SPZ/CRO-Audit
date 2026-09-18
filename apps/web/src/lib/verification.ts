"use client";

import { upload } from "@vercel/blob/client";

import { stripMockupSeed } from "@/lib/report-store";
import type { ReportResponse } from "@cro/shared";

// Client-side verification state. A short-lived HMAC token (minted by
// /api/otp/verify) is kept in localStorage so a verified visitor stays
// unlocked across reloads and can email themselves the report.

const TOKEN_KEY = "cro:verified-token";
const EMAIL_KEY = "cro:verified-email";
// Must match apps/web/src/lib/server/otp.ts TOKEN_TTL_MS.
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isTokenExpired(token: string): boolean {
  try {
    const body = token.split(".")[0];
    if (!body) return true;
    const pad = body.length % 4 === 0 ? "" : "=".repeat(4 - (body.length % 4));
    const json = atob(body.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const payload = JSON.parse(json) as { iat?: number };
    if (typeof payload.iat !== "number") return true;
    return Date.now() - payload.iat > TOKEN_TTL_MS;
  } catch {
    return true;
  }
}

export function getVerification(): { token: string; email: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const token = window.localStorage.getItem(TOKEN_KEY);
    const email = window.localStorage.getItem(EMAIL_KEY);
    if (!token || !email) return null;
    if (isTokenExpired(token)) {
      clearVerification();
      return null;
    }
    return { token, email };
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

/** Uploads the current report to Blob and returns the `/share/<id>` viewer link. */
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
