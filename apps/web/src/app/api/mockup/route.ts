import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { generateFixMockup } from "@/lib/mockup";
import { getClientIp, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
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

// Bound the inbound base64 image so a caller can't push huge payloads into
// memory / the image API. ~3M chars of base64 ≈ 2.2MB binary, comfortably
// above a viewport JPEG hero seed but far below an abuse payload.
const MAX_IMAGE_BASE64_LEN = 3_000_000;

export async function POST(request: Request) {
  const { limit, windowMs } = RATE_LIMITS.mockup;
  const rl = rateLimit(`mockup:${getClientIp(request)}`, limit, windowMs);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))),
        },
      }
    );
  }

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

  if (image.length > MAX_IMAGE_BASE64_LEN) {
    return NextResponse.json(
      { error: "Image payload too large." },
      { status: 413 }
    );
  }

  if (!/^image\/(png|jpeg|jpg|webp)$/i.test(mimeType)) {
    return NextResponse.json(
      { error: "Unsupported image type." },
      { status: 400 }
    );
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
