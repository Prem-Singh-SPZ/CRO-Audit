import type { Device } from "./constants";

// Structured data extracted from the target page by the cheerio analyzer.
// This is what we hand to the AI provider alongside PageSpeed metrics.

export interface FormFieldInfo {
  type: string;
  name: string | null;
  label: string | null;
  required: boolean;
  placeholder: string | null;
}

export interface FormInfo {
  action: string | null;
  method: string | null;
  fieldCount: number;
  fields: FormFieldInfo[];
  submitText: string | null;
}

export interface ButtonInfo {
  text: string;
  isPrimary: boolean;
}

export interface LinkInfo {
  text: string;
  href: string;
}

export interface ImageStats {
  total: number;
  withAlt: number;
  withoutAlt: number;
}

export interface ScreenshotRef {
  device: Device;
  path: string;
  width: number;
  height: number;
}

export interface PageContext {
  url: string;
  finalUrl: string;
  title: string | null;
  metaDescription: string | null;
  lang: string | null;
  hasViewportMeta: boolean;
  isHttps: boolean;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  buttons: ButtonInfo[];
  ctaTexts: string[];
  navLinks: LinkInfo[];
  forms: FormInfo[];
  images: ImageStats;
  fonts: string[];
  colors: string[];
  wordCount: number;
  /**
   * Cleaned, visible page copy (scripts/styles/nav chrome stripped, whitespace
   * collapsed, truncated). Gives the model the raw wording to critique instead
   * of only structural signals.
   */
  copyText: string;
  hasTestimonials: boolean;
  hasPricing: boolean;
  hasTrustBadges: boolean;
  hasSocialProof: boolean;
  hasVideo: boolean;
  loadTimeMs: number;
  /**
   * True when the fetch landed on a bot-protection / verification interstitial
   * (e.g. Cloudflare "Just a moment", CAPTCHA) instead of the real page. When
   * set, the absence of on-page signals is NOT reliable, so downstream analysis
   * avoids reporting false "missing X" issues.
   */
  blocked: boolean;
  blockReason: string | null;
  screenshots: ScreenshotRef[];
}

export interface LighthouseSummary {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  metrics: {
    lcp?: number;
    fcp?: number;
    cls?: number;
    tbt?: number;
    si?: number;
    tti?: number;
    [key: string]: number | undefined;
  };
}
