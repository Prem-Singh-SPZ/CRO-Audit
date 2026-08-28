import "server-only";

import crypto from "node:crypto";
import { put, head, del } from "@vercel/blob";

// ---------------------------------------------------------------------------
// OTP + verification-token primitives. Codes are never stored in the clear:
// only an HMAC (keyed by OTP_SECRET) is persisted, so the record can live in a
// public-read Blob at an unguessable path without leaking the code. Tokens are
// short-lived HMAC-signed payloads the client keeps to unlock + authorize email.
// ---------------------------------------------------------------------------

const OTP_TTL_MS = 10 * 60 * 1000; // codes valid for 10 minutes
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // verified state lasts 7 days
const MAX_ATTEMPTS = 5;

function secret(): string {
  const s = process.env.OTP_SECRET;
  if (!s || s.length < 16) {
    throw new Error("OTP_SECRET is not configured (needs >= 16 chars)");
  }
  return s;
}

function hmac(input: string): string {
  return crypto.createHmac("sha256", secret()).update(input).digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function generateCode(): string {
  // 6 digits, zero-padded, from a CSPRNG.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function codeHash(email: string, code: string): string {
  return hmac(`code:${email}:${code}`);
}

function emailHash(email: string): string {
  return hmac(`email:${email}`);
}

interface OtpRecord {
  emailHash: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

function blobPath(requestId: string): string {
  return `otp/${requestId}.json`;
}

/** Persists a hashed OTP record and returns the requestId. */
export async function storeOtp(requestId: string, email: string, code: string) {
  const record: OtpRecord = {
    emailHash: emailHash(email),
    codeHash: codeHash(email, code),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  };
  await put(blobPath(requestId), JSON.stringify(record), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readOtp(requestId: string): Promise<OtpRecord | null> {
  try {
    const meta = await head(blobPath(requestId));
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as OtpRecord;
  } catch {
    return null;
  }
}

export type VerifyResult =
  | { ok: true; email: string; token: string }
  | { ok: false; reason: "expired" | "too_many" | "invalid" | "not_found" };

/**
 * Verifies a submitted code against the stored record. On success the record is
 * deleted and a signed verification token is returned. `email` must match the
 * address the code was requested for (its hash is checked).
 */
export async function verifyOtp(
  requestId: string,
  email: string,
  code: string
): Promise<VerifyResult> {
  const record = await readOtp(requestId);
  if (!record) return { ok: false, reason: "not_found" };

  if (record.emailHash !== emailHash(email)) {
    return { ok: false, reason: "invalid" };
  }
  if (Date.now() > record.expiresAt) {
    await del(blobPath(requestId)).catch(() => {});
    return { ok: false, reason: "expired" };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await del(blobPath(requestId)).catch(() => {});
    return { ok: false, reason: "too_many" };
  }

  const matches = timingSafeEqual(record.codeHash, codeHash(email, code));
  if (!matches) {
    // Persist the incremented attempt count so brute force is bounded.
    await put(
      blobPath(requestId),
      JSON.stringify({ ...record, attempts: record.attempts + 1 }),
      {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      }
    ).catch(() => {});
    return { ok: false, reason: "invalid" };
  }

  await del(blobPath(requestId)).catch(() => {});
  return { ok: true, email, token: createToken(email) };
}

// --- Verification tokens ---------------------------------------------------

interface TokenPayload {
  email: string;
  iat: number;
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

export function createToken(email: string): string {
  const payload: TokenPayload = { email, iat: Date.now() };
  const body = base64url(JSON.stringify(payload));
  const sig = hmac(body);
  return `${body}.${sig}`;
}

/** Returns the verified email if the token is valid + fresh, else null. */
export function verifyToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!timingSafeEqual(sig, hmac(body))) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as TokenPayload;
    if (!payload.email || typeof payload.iat !== "number") return null;
    if (Date.now() - payload.iat > TOKEN_TTL_MS) return null;
    return payload.email;
  } catch {
    return null;
  }
}
