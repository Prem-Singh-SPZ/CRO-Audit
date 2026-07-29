import { ImageResponse } from "next/og";

// Edge runtime avoids a Node-runtime font-path resolution bug in @vercel/og
// during static export, and is the recommended runtime for OG image routes.
export const runtime = "edge";

export const alt = "CRO Audit — find out why your website isn't converting";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Spiralyze";

// Statically-generated social share card. Rendered at build/request time via
// next/og so we don't need to ship a binary asset.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #000F29 0%, #06213f 100%)",
          padding: "72px",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#F5A623",
              color: "#000F29",
              fontSize: 34,
              fontWeight: 800,
              borderRadius: 14,
            }}
          >
            C
          </div>
          <span style={{ fontSize: 30, fontWeight: 600, opacity: 0.9 }}>
            CRO Audit by {brand}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05 }}>
            Know why your website
            <br />
            isn&rsquo;t converting.
          </span>
          <span style={{ fontSize: 30, color: "#F5A623", fontWeight: 600 }}>
            A complete AI-powered CRO audit in under 60 seconds.
          </span>
        </div>

        <span style={{ fontSize: 24, opacity: 0.75 }}>
          Screenshots · Lighthouse · Prioritized action plan
        </span>
      </div>
    ),
    { ...size }
  );
}
