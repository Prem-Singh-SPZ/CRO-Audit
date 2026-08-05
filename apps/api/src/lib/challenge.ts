// Shared detection for bot-protection / security-verification interstitials
// (Cloudflare, Imperva/Incapsula, DataDome, PerimeterX, Akamai, generic WAFs).
// Used both by the HTML analyzer (cheerio fetch) and the screenshot renderer,
// since a site may serve real HTML to a plain fetch but challenge a headless
// browser (or vice-versa).

const MARKERS: { pattern: RegExp; reason: string }[] = [
  { pattern: /just a moment/i, reason: "Cloudflare challenge" },
  { pattern: /checking your browser/i, reason: "Cloudflare challenge" },
  { pattern: /attention required/i, reason: "Cloudflare block" },
  { pattern: /performing security verification/i, reason: "Security verification" },
  {
    pattern: /security service to protect (against|itself)/i,
    reason: "Bot protection",
  },
  { pattern: /protect against malicious bots?/i, reason: "Bot protection" },
  {
    pattern: /verif(?:y|ies|ying)? (?:that )?you are (?:a )?(?:human|not a (?:ro)?bot)/i,
    reason: "Bot verification",
  },
  { pattern: /enable javascript and cookies/i, reason: "JS/cookie gate" },
  {
    pattern: /(are you a robot|i'?m not a robot|recaptcha|hcaptcha|\bcaptcha\b)/i,
    reason: "CAPTCHA",
  },
  { pattern: /access denied|ddos protection|request blocked/i, reason: "WAF block" },
  // Geo/region restrictions are distinct from bot protection: the site limits
  // access by country, so retrying or changing UA won't help. Detecting this
  // lets the UI set honest expectations instead of promising a retry.
  {
    pattern: /not available in your (country|region|location)/i,
    reason: "Region restricted",
  },
  {
    pattern:
      /access (?:from your|is)\s?(?:country|region|location).{0,20}(restricted|blocked|denied)/i,
    reason: "Region restricted",
  },
  { pattern: /geo[- ]?(restricted|blocked|blocking)/i, reason: "Region restricted" },
  {
    pattern: /(incapsula|imperva|datadome|perimeterx|distil networks)/i,
    reason: "Bot protection",
  },
];

/**
 * Returns a short reason string if the given text looks like a
 * bot-protection / verification interstitial, otherwise null. Keep the input
 * scoped to a short sample (title + first few hundred chars) so legitimate
 * pages that merely *mention* bots/security (e.g. cybersecurity vendors) don't
 * false-positive on deep body content.
 */
export function detectChallenge(text: string): string | null {
  if (!text) return null;
  for (const { pattern, reason } of MARKERS) {
    if (pattern.test(text)) return reason;
  }
  return null;
}
