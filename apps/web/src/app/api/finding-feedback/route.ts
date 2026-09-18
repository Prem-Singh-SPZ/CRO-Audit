import { NextResponse } from "next/server";

import { captureLead } from "@/lib/server/leads";
import { verifyToken } from "@/lib/server/otp";
import { rateLimit, clientKey } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`finding-feedback:${clientKey(request)}`, 12, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Too many reports. Please wait a few minutes." },
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
  const token = typeof raw.token === "string" ? raw.token : "";
  const issueTitle =
    typeof raw.issueTitle === "string" ? raw.issueTitle.trim().slice(0, 200) : "";
  const url = typeof raw.url === "string" ? raw.url.trim().slice(0, 2048) : "";

  if (!token || !issueTitle) {
    return NextResponse.json({ error: "Missing feedback" }, { status: 400 });
  }

  const email = verifyToken(token);
  if (!email) {
    return NextResponse.json({ error: "Please unlock the report again." }, { status: 401 });
  }

  let host: string | undefined;
  try {
    host = url ? new URL(url).hostname : undefined;
  } catch {
    host = undefined;
  }

  await captureLead({
    email,
    host,
    url: url || undefined,
    topIssueTitle: issueTitle,
    source: "finding-feedback",
  });

  return NextResponse.json({ ok: true });
}
