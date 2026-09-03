// TEMPORARY diagnostic endpoint — reports whether the email/OTP env vars are
// visible to the running function. Returns booleans + lengths only, never the
// secret values. DELETE this route once the email config issue is resolved.
export const runtime = "nodejs";

export async function GET() {
  const host = process.env.SMTP_HOST ?? "";
  const user = process.env.SMTP_USER ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  const from = process.env.EMAIL_FROM ?? "";

  return Response.json({
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
  });
}
