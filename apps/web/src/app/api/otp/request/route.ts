import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { otpRequestSchema } from "@cro/shared";
import { generateCode, storeOtp } from "@/lib/server/otp";
import { sendOtpEmail } from "@/lib/server/email";
import { rateLimit, clientKey } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  // Best-effort abuse guard: cap requests per IP.
  if (!rateLimit(`otp:req:${clientKey(request)}`, 6, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Too many codes requested. Please wait a few minutes." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = otpRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid email" },
      { status: 400 }
    );
  }

  const { email } = parsed.data;
  const requestId = randomUUID();
  const code = generateCode();

  try {
    await storeOtp(requestId, email, code);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "storage_failed";
    // Missing BLOB token / OTP secret → clear, actionable 500.
    return NextResponse.json(
      { error: "Verification is not configured on the server.", reason },
      { status: 500 }
    );
  }

  const sent = await sendOtpEmail(email, code);
  if (!sent.ok) {
    return NextResponse.json(
      {
        error:
          sent.reason === "not_configured"
            ? "Email delivery is not configured on the server."
            : "We couldn't send the code. Please try again.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ requestId });
}
