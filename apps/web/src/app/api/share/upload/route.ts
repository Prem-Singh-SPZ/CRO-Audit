import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

// Client-upload token endpoint for shareable reports. The browser calls this to
// obtain a short-lived token, then streams the (multi-MB) report JSON directly
// to Vercel Blob — bypassing the ~4.5MB serverless request-body limit. The heavy
// payload never passes through this function.

// Bound the report size to curb abuse while still allowing full reports with
// embedded screenshots + the generated mockup (typically 3-10MB).
const MAX_REPORT_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Only allow public report JSON under the deterministic reports/ prefix.
        if (!/^reports\/[0-9a-f-]{36}\.json$/i.test(pathname)) {
          throw new Error("Invalid share pathname");
        }
        return {
          allowedContentTypes: ["application/json"],
          addRandomSuffix: false,
          maximumSizeInBytes: MAX_REPORT_BYTES,
          tokenPayload: JSON.stringify({ kind: "shared-report" }),
        };
      },
      // Note: not invoked on localhost (no public callback URL). We don't rely
      // on it — the client composes the share link from the pathname it chose.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to authorize upload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
