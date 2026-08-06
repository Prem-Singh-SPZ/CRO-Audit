import { NextResponse } from "next/server";
import { list, del } from "@vercel/blob";

// Daily cleanup for shared-report blobs. Keeps the Blob store within the free
// Hobby limits (1 GB storage) by:
//   1. Deleting reports older than TTL_DAYS.
//   2. Safety net — if the remaining total still exceeds MAX_TOTAL_BYTES,
//      deleting oldest-first until under budget (guards against share spikes
//      that would blow past 1 GB before anything ages out).
//
// Invoked by Vercel Cron (see apps/web/vercel.json). Vercel automatically sends
// `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set on the project,
// so we reject anything that doesn't match.

export const runtime = "nodejs";
// Never cache — this must run fresh and perform side effects each invocation.
export const dynamic = "force-dynamic";

const TTL_DAYS = 30;
const MAX_TOTAL_BYTES = 800 * 1024 * 1024; // 800 MB — headroom under the 1 GB cap
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

type BlobEntry = {
  url: string;
  pathname: string;
  uploadedAt: number;
  size: number;
};

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Collect every shared report (paginating past the 1000/page limit).
    const entries: BlobEntry[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: "reports/", cursor, limit: 1000 });
      for (const b of page.blobs) {
        entries.push({
          url: b.url,
          pathname: b.pathname,
          uploadedAt: new Date(b.uploadedAt).getTime(),
          size: b.size,
        });
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    const now = Date.now();
    const toDelete = new Set<string>();

    // 1. Age-based expiry.
    let deletedByAge = 0;
    const survivors: BlobEntry[] = [];
    for (const e of entries) {
      if (now - e.uploadedAt > TTL_MS) {
        toDelete.add(e.url);
        deletedByAge += 1;
      } else {
        survivors.push(e);
      }
    }

    // 2. Size-cap safety net: drop oldest survivors until under budget.
    let remainingBytes = survivors.reduce((sum, e) => sum + e.size, 0);
    let deletedBySize = 0;
    if (remainingBytes > MAX_TOTAL_BYTES) {
      survivors.sort((a, b) => a.uploadedAt - b.uploadedAt); // oldest first
      for (const e of survivors) {
        if (remainingBytes <= MAX_TOTAL_BYTES) break;
        toDelete.add(e.url);
        remainingBytes -= e.size;
        deletedBySize += 1;
      }
    }

    if (toDelete.size > 0) {
      await del([...toDelete]);
    }

    return NextResponse.json({
      scanned: entries.length,
      deletedByAge,
      deletedBySize,
      remainingBytes,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cleanup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
