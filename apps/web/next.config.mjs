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
  // Emit a self-contained server build for containerized (Docker) deploys only
  // (the Dockerfile sets BUILD_STANDALONE=1). Kept opt-in because the extra
  // build-trace copy step conflicts with locked font assets on some platforms
  // (Windows) and is unnecessary on Vercel, which uses its own build output.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
    // Keep the headless-Chromium packages external so the binary isn't bundled
    // / mangled by the build and resolves correctly at runtime.
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
    // The app lives in a monorepo (apps/web); trace files from the repo root so
    // the standalone bundle includes workspace-level dependencies.
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
