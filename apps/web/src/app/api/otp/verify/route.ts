import { NextResponse } from "next/server";

import { otpVerifySchema } from "@cro/shared";
import { verifyOtp } from "@/lib/server/otp";
import { captureLead } from "@/lib/server/leads";
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

  const raw = body as Record<string, unknown>;
  const parsed = otpVerifySchema.safeParse({
    requestId: raw?.requestId,
    code: raw?.code,
    host: raw?.host,
    url: raw?.url,
    score: raw?.score,
    device: raw?.device,
    primaryBottleneck: raw?.primaryBottleneck,
    topIssueTitle: raw?.topIssueTitle,
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

  // Best-effort marketing lead capture. Enriches the verified email with the
  // analyzed page context (from the client) plus geo/IP/UA (from Vercel
  // headers). Never throws, so it can't affect the verification response.
  const h = request.headers;
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || undefined;
  await captureLead({
    email: result.email,
    host: parsed.data.host,
    url: parsed.data.url,
    score: parsed.data.score,
    device: parsed.data.device,
    primaryBottleneck: parsed.data.primaryBottleneck,
    topIssueTitle: parsed.data.topIssueTitle,
    country: h.get("x-vercel-ip-country") ?? undefined,
    city: decodeURIComponent(h.get("x-vercel-ip-city") ?? "") || undefined,
    ip,
    userAgent: h.get("user-agent") ?? undefined,
    referer: h.get("referer") ?? undefined,
  });

  return NextResponse.json({ token: result.token, email: result.email });
}
