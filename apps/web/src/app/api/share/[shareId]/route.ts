import { NextResponse } from "next/server";
import { head } from "@vercel/blob";

// Resolves a shareId to the public Blob URL of its stored report JSON. The
// browser then fetches that URL directly from the Blob CDN, so the multi-MB
// payload never streams through this function.

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function GET(
  _request: Request,
  { params }: { params: { shareId: string } }
): Promise<NextResponse> {
  const { shareId } = params;
  if (!UUID_RE.test(shareId)) {
    return NextResponse.json({ error: "Invalid share id" }, { status: 400 });
  }

  try {
    const blob = await head(`reports/${shareId}.json`);
    return NextResponse.json({ url: blob.url });
  } catch (error) {
    // Missing object → 404. Anything else (e.g. missing token) → 500 so the
    // client can distinguish "no such report" from "sharing misconfigured".
    const name = error instanceof Error ? error.name : "";
    if (name === "BlobNotFoundError") {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Sharing is not configured" },
      { status: 500 }
    );
  }
}
