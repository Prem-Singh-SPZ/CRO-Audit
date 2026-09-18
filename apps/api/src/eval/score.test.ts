import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReportJson } from "@cro/shared";
import { goldByHost, scoreCase, scoreSuite, suiteRank } from "./score";

const dir = dirname(fileURLToPath(import.meta.url));

function load(name: string): ReportJson {
  return JSON.parse(
    readFileSync(join(dir, "fixtures", name), "utf8")
  ) as ReportJson;
}

describe("gold set", () => {
  it("defines at least 10 pages with expected issues and pin boxes", () => {
    const gold = JSON.parse(
      readFileSync(join(dir, "gold-set.json"), "utf8")
    ) as { cases: unknown[] };
    expect(gold.cases.length).toBeGreaterThanOrEqual(10);
    for (const raw of gold.cases) {
      const c = raw as {
        url: string;
        expectedIssues: unknown[];
        expectedPins: unknown[];
        sections: unknown[];
      };
      expect(c.url).toMatch(/^https:\/\//);
      expect(c.expectedIssues.length).toBeGreaterThan(0);
      expect(c.expectedPins.length).toBeGreaterThan(0);
      expect(c.sections.length).toBeGreaterThan(0);
    }
  });
});

describe("scoreCase", () => {
  it("scores the grounded ActivTrak fixture higher than the weak alternate", () => {
    const gold = goldByHost("activtrak.com");
    expect(gold).toBeTruthy();
    const gemini = scoreCase(gold!, load("activtrak-gemini.json"));
    const alt = scoreCase(gold!, load("activtrak-alternate.json"));
    expect(gemini.recall).toBeGreaterThan(alt.recall);
    expect(gemini.pinHits).toBeGreaterThan(alt.pinHits);
    expect(gemini.bottleneckHit).toBe(true);
    expect(alt.bottleneckHit).toBe(false);
  });
});

describe("suiteRank", () => {
  it("keeps Gemini when the alternate is weaker", () => {
    const gold = goldByHost("activtrak.com")!;
    const gemini = scoreSuite([{ gold, report: load("activtrak-gemini.json") }]);
    const alt = scoreSuite([{ gold, report: load("activtrak-alternate.json") }]);
    expect(suiteRank(gemini)).toBeGreaterThan(suiteRank(alt));
  });
});
