// TEMPORARY diagnostic endpoint — reports whether the email/OTP env vars are
// visible to the running function AND attempts a real SMTP send so the actual
// nodemailer error (auth/connection/TLS) is surfaced. Returns booleans, lengths
// and the raw send result reason only — never the secret values themselves.
// DELETE this route once the email config issue is resolved.
import { sendOtpEmail } from "@/lib/server/email";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const host = process.env.SMTP_HOST ?? "";
  const user = process.env.SMTP_USER ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  const from = process.env.EMAIL_FROM ?? "";

  const env = {
    // Which vars the runtime actually sees (true = non-empty).
    host: Boolean(host),
    user: Boolean(user),
    pass: Boolean(pass),
    from: Boolean(from),
    otp: Boolean(process.env.OTP_SECRET),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    port: Boolean(process.env.SMTP_PORT),
    // Lengths only (no values) to catch blank / whitespace / quoted values.
    hostLen: host.length,
    userLen: user.length,
    passLen: pass.length,
    fromLen: from.length,
    portValue: process.env.SMTP_PORT ?? null,
  };

  // Attempt a real send only when explicitly asked (?send=1) so hitting the URL
  // casually doesn't fire emails. Sends to ?to=... or falls back to SMTP_USER.
  const url = new URL(request.url);
  if (url.searchParams.get("send") !== "1") {
    return Response.json({
      env,
      note: "Add ?send=1 (optionally &to=you@example.com) to attempt a real send and surface the SMTP error.",
    });
  }

  const to = url.searchParams.get("to") || user;
  const result = await sendOtpEmail(to, "000000");

  return Response.json({
    env,
    sendAttempted: true,
    to,
    // On failure, `reason` holds the raw nodemailer error (e.g. "Invalid login:
    // 535-5.7.8 ..."). On success, ok:true and a real test email was sent.
    result,
  });
}
