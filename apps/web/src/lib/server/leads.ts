import "server-only";

// ---------------------------------------------------------------------------
// Best-effort lead capture to a Google Sheet via an Apps Script Web App.
//
// We POST a JSON row to GOOGLE_SHEET_WEBHOOK_URL (a deployed Apps Script that
// appends to the sheet). A shared secret (LEADS_WEBHOOK_SECRET) lets the script
// reject anyone who finds the URL. This is intentionally fire-and-forget and
// NEVER throws: a capture failure must not block or fail email verification.
// ---------------------------------------------------------------------------

export interface LeadRecord {
  /** Verified, lowercased email — the lead. */
  email: string;
  /** Hostname of the analyzed site (e.g. "sailpoint.com"). */
  host?: string;
  /** Full analyzed URL. */
  url?: string;
  /** Overall CRO score (0-100). */
  score?: number;
  /** Primary analyzed device. */
  device?: string;
  /** Vercel geo (from request headers). */
  country?: string;
  city?: string;
  /** Client IP (first hop of x-forwarded-for). */
  ip?: string;
  userAgent?: string;
  referer?: string;
  /** Exact consent copy shown to the user, for compliance. */
  consentText?: string;
  /** Where the lead was captured. */
  source?: string;
}

// The exact opt-in copy shown in the email gate modal — stored with each lead.
const CONSENT_TEXT =
  "We only use your email to send this report and CRO tips. No spam.";

const TIMEOUT_MS = 5000;

/**
 * Appends a lead to the configured Google Sheet. Resolves silently on any
 * misconfiguration/error/timeout so callers can always proceed.
 */
export async function captureLead(lead: LeadRecord): Promise<void> {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!url) return; // capture disabled / not configured — no-op

  const payload = {
    ...lead,
    secret: process.env.LEADS_WEBHOOK_SECRET ?? "",
    verifiedAt: new Date().toISOString(),
    consentText: lead.consentText ?? CONSENT_TEXT,
    source: lead.source ?? "report-gate",
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(url, {
      method: "POST",
      // Apps Script webhooks accept text/plain without a CORS preflight; the
      // body is still JSON that the script parses.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    console.error(
      "[leads] capture failed:",
      err instanceof Error ? err.message : err
    );
  } finally {
    clearTimeout(timer);
  }
}
