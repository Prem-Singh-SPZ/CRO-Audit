import { NextResponse } from "next/server";

// TEMPORARY diagnostic for lead-capture wiring. Remove once confirmed.
// - GET /api/debug-leads         → reports whether the env vars are present in
//   this running deployment (booleans + lengths only, never the values).
// - GET /api/debug-leads?send=1  → performs a live POST to the configured
//   webhook from the server and returns the raw status + body, so we can see
//   exactly what production gets back.

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  const secret = process.env.LEADS_WEBHOOK_SECRET;

  const env = {
    GOOGLE_SHEET_WEBHOOK_URL_present: !!url,
    GOOGLE_SHEET_WEBHOOK_URL_length: url?.length ?? 0,
    GOOGLE_SHEET_WEBHOOK_URL_isExec: url?.endsWith("/exec") ?? false,
    LEADS_WEBHOOK_SECRET_present: !!secret,
    LEADS_WEBHOOK_SECRET_length: secret?.length ?? 0,
  };

  const wantSend = new URL(request.url).searchParams.get("send") === "1";
  if (!wantSend) {
    return NextResponse.json({ env, sendAttempted: false });
  }

  if (!url) {
    return NextResponse.json({
      env,
      sendAttempted: false,
      error: "GOOGLE_SHEET_WEBHOOK_URL is not set in this deployment.",
    });
  }

  const payload = {
    secret: secret ?? "",
    verifiedAt: new Date().toISOString(),
    email: "debug-prod@example.com",
    host: "debug.example.com",
    url: "https://debug.example.com",
    score: 1,
    device: "desktop",
    consentText: "DEBUG ROW (prod) - safe to delete",
    source: "debug-leads-route",
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return NextResponse.json({
      env,
      sendAttempted: true,
      status: res.status,
      body: text.slice(0, 500),
    });
  } catch (err) {
    return NextResponse.json({
      env,
      sendAttempted: true,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
