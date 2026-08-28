import { NextResponse } from "next/server";

import { emailReportSchema } from "@cro/shared";
import { verifyToken } from "@/lib/server/otp";
import { sendReportEmail } from "@/lib/server/email";
import { rateLimit, clientKey } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`report:email:${clientKey(request)}`, 12, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Too many emails requested. Please wait a few minutes." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = emailReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  // The verification token proves ownership of the email; we send only to it.
  const email = verifyToken(parsed.data.token);
  if (!email) {
    return NextResponse.json(
      { error: "Please verify your email again." },
      { status: 401 }
    );
  }

  // Only allow our own /share/<uuid> viewer links to be emailed out — this
  // prevents the endpoint being used to send arbitrary URLs to the verified
  // address.
  try {
    const u = new URL(parsed.data.shareUrl);
    if (
      !/^https?:$/.test(u.protocol) ||
      !/^\/share\/[0-9a-f-]{36}$/i.test(u.pathname)
    ) {
      return NextResponse.json({ error: "Invalid report link" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid report link" }, { status: 400 });
  }

  const sent = await sendReportEmail({
    to: email,
    host: parsed.data.host,
    score: parsed.data.score,
    shareUrl: parsed.data.shareUrl,
  });
  if (!sent.ok) {
    return NextResponse.json(
      {
        error:
          sent.reason === "not_configured"
            ? "Email delivery is not configured on the server."
            : "We couldn't send the email. Please try again.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, email });
}
