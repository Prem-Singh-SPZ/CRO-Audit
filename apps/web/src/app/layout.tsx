import type { Metadata, Viewport } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Spiralyze";
const siteTitle = process.env.NEXT_PUBLIC_SITE_TITLE ?? `CRO Audit by ${brand}`;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: `${siteTitle} - Know why your website isn't converting`,
    template: `%s | ${brand}`,
  },
  description:
    `Get a complete Conversion Rate Optimization audit in under 60 seconds. Screenshots, Lighthouse, and expert CRO analysis with a prioritized action plan — from ${brand}, the predictive CRO agency.`,
  keywords: [
    "CRO",
    "conversion rate optimization",
    "website audit",
    "CRO agency",
    brand,
    "landing page analysis",
    "Lighthouse",
  ],
  openGraph: {
    title: siteTitle,
    description:
      "Complete CRO audit in under 60 seconds. Find out why your website isn't converting.",
    url: appUrl,
    siteName: brand,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: "Complete CRO audit in under 60 seconds.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000F29" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${montserrat.variable} ${inter.variable} font-sans`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
