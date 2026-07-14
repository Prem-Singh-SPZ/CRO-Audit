const company = process.env.NEXT_PUBLIC_COMPANY ?? "Spiralyze LLC";
const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Spiralyze";

export const config = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  aiProvider: process.env.AI_PROVIDER ?? "mock",

  // Brand
  company,
  brandName,
  logoText: process.env.NEXT_PUBLIC_LOGO_TEXT ?? `CRO Audit by ${brandName}`,
  heroBadge: process.env.NEXT_PUBLIC_HERO_BADGE ?? `Predictive CRO by ${brandName} · 30% lift guaranteed in 90 days`,
  footerDescription:
    process.env.NEXT_PUBLIC_FOOTER_DESCRIPTION ??
    `Predictive conversion rate optimization by ${brandName}. Find out why your website isn't converting — and let our team fix it, with a 30% lift guaranteed in 90 days.`,

  // Contact
  bookCallUrl:
    process.env.NEXT_PUBLIC_BOOK_CALL_URL ??
    "https://www.spiralyze.com/get-demo",
  contactUrl:
    process.env.NEXT_PUBLIC_CONTACT_URL ?? "mailto:contact@spiralyze.com",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contact@spiralyze.com",
  phone: process.env.NEXT_PUBLIC_PHONE ?? "888.677.4725",
  phoneHref: `tel:${(process.env.NEXT_PUBLIC_PHONE ?? "888.677.4725").replace(/[^0-9]/g, "")}`,
  address: {
    line1: process.env.NEXT_PUBLIC_ADDRESS_LINE1 ?? "1718 Peachtree St. #1080",
    city: process.env.NEXT_PUBLIC_ADDRESS_CITY ?? "Atlanta, GA 30309",
  },
} as const;
