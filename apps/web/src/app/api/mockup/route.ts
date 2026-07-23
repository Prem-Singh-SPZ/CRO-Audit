import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { generateFixMockup } from "@/lib/mockup";
import type {
  MockupDto,
  MockupRequestDto,
  MockupResponseDto,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Decoupled from /api/analyze: this endpoint only runs the (slow) image model,
// so it gets the full time budget to itself instead of sharing it with the
// crawl + PageSpeed + audit. Raise/lower per your Vercel plan's ceiling.
export const maxDuration = 120;

export async function POST(request: Request) {
  let body: Partial<MockupRequestDto>;
  try {
    body = (await request.json()) as Partial<MockupRequestDto>;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const image = typeof body.image === "string" ? body.image : "";
  const mimeType =
    typeof body.mimeType === "string" ? body.mimeType : "image/jpeg";

  if (!image) {
    return NextResponse.json<MockupResponseDto>({ mockup: null });
  }

  const issues = Array.isArray(body.issues)
    ? body.issues.slice(0, 20).map((i) => ({
        severity: String(i?.severity ?? "MEDIUM"),
        category: String(i?.category ?? "General"),
        title: String(i?.title ?? ""),
        description: String(i?.description ?? ""),
      }))
    : [];

  try {
    const mockup = await generateFixMockup({
      imageBase64: image,
      mimeType,
      host: String(body.host ?? ""),
      primaryBottleneck: body.primaryBottleneck
        ? String(body.primaryBottleneck)
        : undefined,
      issues,
    });

    const dto: MockupDto | null = mockup
      ? {
          id: randomUUID(),
          device: mockup.device,
          url: mockup.dataUri,
          width: mockup.width,
          height: mockup.height,
        }
      : null;

    return NextResponse.json<MockupResponseDto>({ mockup: dto });
  } catch (err) {
    console.error("[api/mockup] generation failed:", err);
    return NextResponse.json<MockupResponseDto>({ mockup: null });
  }
}
