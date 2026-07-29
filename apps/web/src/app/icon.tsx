import { ImageResponse } from "next/og";

// Edge runtime avoids a Node-runtime font-path resolution bug in @vercel/og
// during static export, and is the recommended runtime for OG image routes.
export const runtime = "edge";

// Route segment config for the generated favicon.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// A simple, brand-colored "C" mark so the app has a real favicon instead of the
// Next.js default.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000F29",
          color: "#F5A623",
          fontSize: 22,
          fontWeight: 700,
          borderRadius: 7,
        }}
      >
        C
      </div>
    ),
    { ...size }
  );
}
