import { describe, expect, it } from "vitest";
import { detectChallenge, isAutoClearingChallenge } from "./challenge";

describe("detectChallenge", () => {
  it("flags Cloudflare auto JS checks", () => {
    expect(detectChallenge("Just a moment... Checking your browser")).toBe(
      "Cloudflare challenge"
    );
    expect(detectChallenge("Checking your browser before accessing the site")).toBe(
      "Cloudflare challenge"
    );
  });

  it("flags Turnstile and verify-you-are-human walls", () => {
    expect(detectChallenge("Verify you are human to continue")).toBe("CAPTCHA");
    expect(detectChallenge("Please complete the Cloudflare Turnstile check")).toBe(
      "CAPTCHA"
    );
    expect(detectChallenge("cf-turnstile widget loading")).toBe("CAPTCHA");
  });

  it("does not false-positive on security-vendor marketing copy", () => {
    expect(
      detectChallenge(
        "Bot protection for SaaS. Our platform stops scrapers without slowing buyers."
      )
    ).toBeNull();
    expect(
      detectChallenge(
        "Enterprise cybersecurity: protect APIs, stop bots, and reduce fraud."
      )
    ).toBeNull();
  });
});

describe("isAutoClearingChallenge", () => {
  it("only waits out Cloudflare JS challenges, not captchas", () => {
    expect(isAutoClearingChallenge("Cloudflare challenge")).toBe(true);
    expect(isAutoClearingChallenge("CAPTCHA")).toBe(false);
    expect(isAutoClearingChallenge("Cloudflare block")).toBe(false);
    expect(isAutoClearingChallenge(null)).toBe(false);
  });
});
