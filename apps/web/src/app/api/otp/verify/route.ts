import { NextResponse } from "next/server";

import { otpVerifySchema } from "@cro/shared";
import { verifyOtp } from "@/lib/server/otp";
import { rateLimit, clientKey } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const REASON_COPY: Record<string, string> = {
  expired: "That code has expired. Request a new one.",
  too_many: "Too many attempts. Request a new code.",
  invalid: "That code isn't right. Check it and try again.",
  not_found: "This verification has expired. Request a new code.",
};

export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`otp:verify:${clientKey(request)}`, 20, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = otpVerifySchema.safeParse({
    requestId: (body as { requestId?: unknown })?.requestId,
    code: (body as { code?: unknown })?.code,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid code" },
      { status: 400 }
    );
  }

  const email = (body as { email?: unknown })?.email;
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  let result;
  try {
    result = await verifyOtp(
      parsed.data.requestId,
      email.trim().toLowerCase(),
      parsed.data.code
    );
  } catch {
    return NextResponse.json(
      { error: "Verification is not configured on the server." },
      { status: 500 }
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: REASON_COPY[result.reason] ?? "Verification failed." },
      { status: 400 }
    );
  }

  return NextResponse.json({ token: result.token, email: result.email });
}
