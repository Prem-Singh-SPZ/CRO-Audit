/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
    // Keep the headless-Chromium packages external so the binary isn't bundled
    // / mangled by the build and resolves correctly at runtime.
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  },
};

export default nextConfig;
