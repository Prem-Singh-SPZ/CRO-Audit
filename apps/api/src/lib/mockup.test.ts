import { afterEach, describe, expect, it } from "vitest";

import { isFormFirstPage, leadFormBrief, mockupSkipReason } from "./mockup";

describe("mockupSkipReason", () => {
  const prevKey = process.env.GEMINI_API_KEY;
  const prevEnabled = process.env.ENABLE_FIX_MOCKUP;

  afterEach(() => {
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevKey;
    if (prevEnabled === undefined) delete process.env.ENABLE_FIX_MOCKUP;
    else process.env.ENABLE_FIX_MOCKUP = prevEnabled;
  });

  it("returns no_key when Gemini is not configured", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.ENABLE_FIX_MOCKUP;
    expect(mockupSkipReason()).toBe("no_key");
  });

  it("returns disabled when mockups are turned off", () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.ENABLE_FIX_MOCKUP = "false";
    expect(mockupSkipReason()).toBe("disabled");
  });

  it("returns null when mockups can run", () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.ENABLE_FIX_MOCKUP = "true";
    expect(mockupSkipReason()).toBeNull();
  });
});

describe("isFormFirstPage", () => {
  it("treats demo / lead-capture findings as form-first", () => {
    expect(
      isFormFirstPage([
        {
          severity: "HIGH",
          category: "Friction",
          title: "Lead Capture Form",
          description: "Nine fields on the get-demo page.",
        },
      ])
    ).toBe(true);
  });

  it("treats a measured form as form-first even when the issues never mention one", () => {
    expect(
      isFormFirstPage(
        [
          {
            severity: "HIGH",
            category: "Clarity",
            title: "Hero Headline",
            description: "Vague curiosity-gap headline.",
          },
        ],
        {
          present: true,
          source: "fields",
          fields: ["First name", "Business email", "Company"],
          submitLabel: "Get a demo",
        }
      )
    ).toBe(true);
  });

  it("treats a form-vendor iframe as form-first even without readable fields", () => {
    expect(
      isFormFirstPage([], {
        present: true,
        source: "iframe",
        fields: [],
        submitLabel: null,
      })
    ).toBe(true);
  });

  it("ignores a one-field newsletter box (pricing page is not form-first)", () => {
    expect(
      isFormFirstPage(
        [
          {
            severity: "MEDIUM",
            category: "Pricing",
            title: "Plan comparison is hard to scan",
            description: "Three tiers with mismatched feature rows.",
          },
        ],
        {
          present: true,
          source: "fields",
          fields: ["Email"],
          submitLabel: "Subscribe",
        }
      )
    ).toBe(false);
  });

  it("ignores a two-field form as well (needs more than two inputs)", () => {
    expect(
      isFormFirstPage([], {
        present: true,
        source: "fields",
        fields: ["Email", "Country"],
        submitLabel: "Subscribe",
      })
    ).toBe(false);
  });

  it("trusts a measured no-form result over sign-up wording in the findings", () => {
    expect(
      isFormFirstPage(
        [
          {
            severity: "HIGH",
            category: "CTA",
            title: "Sign up CTA is below the fold",
            description: "Primary plan CTA appears after the comparison table.",
          },
        ],
        { present: false, source: null, fields: [], submitLabel: null }
      )
    ).toBe(false);
  });

  it("does not flag a marketing-hero-only brief", () => {
    expect(
      isFormFirstPage([
        {
          severity: "HIGH",
          category: "Clarity",
          title: "Hero Headline",
          description: "Vague curiosity-gap headline.",
        },
      ])
    ).toBe(false);
  });

  it("lists only the fields read from the DOM", () => {
    const brief = leadFormBrief({
      present: true,
      source: "fields",
      fields: ["First name", "Business email", "Company"],
      submitLabel: "Get a demo",
    });
    expect(brief).toContain("1. First name");
    expect(brief).toContain("2. Business email");
    expect(brief).toContain("3. Company");
    expect(brief).not.toMatch(/\n4\./);
    expect(brief).toContain('The only button on the form is "Get a demo"');
  });

  it("emits no form brief for a newsletter box, so the hero mockup is not forced to draw it", () => {
    const brief = leadFormBrief({
      present: true,
      source: "fields",
      fields: ["Email"],
      submitLabel: "Subscribe",
    });
    expect(brief).toBe("");
  });

  it("does not name fields when only an iframe was found", () => {
    const brief = leadFormBrief({
      present: true,
      source: "iframe",
      fields: [],
      submitLabel: null,
    });
    expect(brief).toMatch(/Do NOT invent or append inputs/);
    expect(brief).not.toMatch(/^\d+\. /m);
  });
});
