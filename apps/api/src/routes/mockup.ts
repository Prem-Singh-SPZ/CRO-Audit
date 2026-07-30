import { Hono } from "hono";
import { randomUUID } from "node:crypto";

import type {
  MockupDto,
  MockupRequestDto,
  MockupResponseDto,
} from "@cro/shared";
import { generateFixMockup } from "../lib/mockup";
import { getClientIp, rateLimit, RATE_LIMITS } from "../lib/rate-limit";

const mockup = new Hono();

// Bound the inbound base64 image so a caller can't push huge payloads into
// memory / the image API. ~3M chars of base64 ≈ 2.2MB binary.
const MAX_IMAGE_BASE64_LEN = 3_000_000;

mockup.post("/", async (c) => {
  const { limit, windowMs } = RATE_LIMITS.mockup;
  const rl = rateLimit(`mockup:${getClientIp(c.req.raw)}`, limit, windowMs);
  if (!rl.success) {
    c.header(
      "Retry-After",
      String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)))
    );
    return c.json(
      { error: "Too many requests. Please wait a moment and try again." },
      429
    );
  }

  let body: Partial<MockupRequestDto>;
  try {
    body = (await c.req.json()) as Partial<MockupRequestDto>;
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const image = typeof body.image === "string" ? body.image : "";
  const mimeType =
    typeof body.mimeType === "string" ? body.mimeType : "image/jpeg";

  if (!image) {
    return c.json({ mockup: null } satisfies MockupResponseDto);
  }

  if (image.length > MAX_IMAGE_BASE64_LEN) {
    return c.json({ error: "Image payload too large." }, 413);
  }

  if (!/^image\/(png|jpeg|jpg|webp)$/i.test(mimeType)) {
    return c.json({ error: "Unsupported image type." }, 400);
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
    const result = await generateFixMockup({
      imageBase64: image,
      mimeType,
      host: String(body.host ?? ""),
      primaryBottleneck: body.primaryBottleneck
        ? String(body.primaryBottleneck)
        : undefined,
      issues,
    });

    const dto: MockupDto | null = result
      ? {
          id: randomUUID(),
          device: result.device,
          url: result.dataUri,
          width: result.width,
          height: result.height,
        }
      : null;

    return c.json({ mockup: dto } satisfies MockupResponseDto);
  } catch (err) {
    console.error("[api/mockup] generation failed:", err);
    return c.json({ mockup: null } satisfies MockupResponseDto);
  }
});

export default mockup;
