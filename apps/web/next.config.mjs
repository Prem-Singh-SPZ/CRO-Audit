import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// High-value, low-risk security headers applied to every response. A strict
// Content-Security-Policy is intentionally omitted here because it requires
// per-request nonces to coexist with Next.js's inline runtime scripts; add one
// via middleware if/when you adopt nonces.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Optional standalone output for containerized UI deploys (not required for
  // Vercel Hobby). Set BUILD_STANDALONE=1 to enable.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  transpilePackages: ["@cro/shared"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
    // Monorepo: trace files from the repo root so workspace deps are included.
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
