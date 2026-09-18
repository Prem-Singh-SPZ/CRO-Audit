/**
 * Score report JSON against the gold set. Default: compare the checked-in
 * Gemini-like fixture vs a weaker alternate (no live API calls).
 *
 * Live optional:
 *   EVAL_API_URL=http://localhost:4000 npx tsx apps/api/src/eval/run-ab.ts --live
 *   hits POST /api/analyze for each gold URL (slow, needs a running API).
 *
 * File pair:
 *   npx tsx apps/api/src/eval/run-ab.ts --a path/to/a.json --b path/to/b.json --host activtrak.com
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReportJson } from "@cro/shared";
import {
  goldByHost,
  goldCases,
  scoreSuite,
  suiteRank,
  type GoldCase,
} from "./score";

const dir = dirname(fileURLToPath(import.meta.url));

function loadJson(path: string): ReportJson {
  return JSON.parse(readFileSync(path, "utf8")) as ReportJson;
}

function printSuite(label: string, suite: ReturnType<typeof scoreSuite>) {
  console.log(`\n${label}`);
  console.log(
    `  precision=${suite.meanPrecision.toFixed(2)} recall=${suite.meanRecall.toFixed(2)} pins=${suite.pinAccuracy.toFixed(2)} bottleneck=${suite.bottleneckRate.toFixed(2)} rank=${suiteRank(suite).toFixed(3)}`
  );
  for (const c of suite.cases) {
    console.log(
      `  - ${c.id}: P=${c.precision.toFixed(2)} R=${c.recall.toFixed(2)} pins=${c.pinHits}/${c.pinTotal} bottleneck=${c.bottleneckHit}`
    );
  }
}

function pickWinner(aLabel: string, a: number, bLabel: string, b: number) {
  if (b > a + 0.03) {
    console.log(`\nWinner: ${bLabel} (clear gain vs ${aLabel}).`);
    return bLabel;
  }
  console.log(
    `\nKeep ${aLabel} — ${bLabel} did not beat it by a meaningful margin.`
  );
  return aLabel;
}

async function liveReports(): Promise<Array<{ gold: GoldCase; report: ReportJson }>> {
  const base = process.env.EVAL_API_URL ?? "http://localhost:4000";
  const out: Array<{ gold: GoldCase; report: ReportJson }> = [];
  for (const gold of goldCases()) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: gold.url }),
    });
    if (!res.ok) {
      console.warn(`skip ${gold.id}: HTTP ${res.status}`);
      continue;
    }
    const body = (await res.json()) as {
      report?: { primaryBottleneck?: string; summary?: string };
      issues?: Array<{
        title: string;
        description: string;
        category: string;
        annotationY?: number | null;
        device?: string | null;
      }>;
    };
    const report: ReportJson = {
      overallScore: 0,
      primaryBottleneck: body.report?.primaryBottleneck ?? "",
      categoryScores: {
        hero: 0,
        trust: 0,
        cta: 0,
        copy: 0,
        design: 0,
        forms: 0,
        accessibility: 0,
        performance: 0,
        mobile: 0,
        psychology: 0,
        seo: 0,
        navigation: 0,
      },
      summary: body.report?.summary ?? "",
      strengths: [],
      weaknesses: [],
      issues: (body.issues ?? []).map((i) => ({
        category: i.category,
        title: i.title,
        description: i.description,
        whyItMatters: "",
        severity: "MEDIUM",
        confidence: 70,
        businessImpact: "",
        suggestedFix: "",
        estimatedConversionImpact: "n/a",
        annotation:
          i.annotationY != null
            ? {
                device: (i.device as "desktop") ?? "desktop",
                x: 0.5,
                y: i.annotationY,
              }
            : null,
      })),
      recommendations: [],
      priority: "medium",
      confidence: 70,
      estimatedImpact: "n/a",
    };
    out.push({ gold, report });
    console.log(`scored live ${gold.id} (${report.issues.length} issues)`);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--live")) {
    const pairs = await liveReports();
    printSuite("live /api/analyze vs gold set", scoreSuite(pairs));
    return;
  }

  const hostFlag = args.indexOf("--host");
  const host = hostFlag >= 0 ? args[hostFlag + 1] : "activtrak.com";
  const aFlag = args.indexOf("--a");
  const bFlag = args.indexOf("--b");
  const gold = goldByHost(host ?? "activtrak.com");
  if (!gold) {
    console.error(`No gold case for ${host}`);
    process.exit(1);
  }

  const aPath =
    aFlag >= 0
      ? args[aFlag + 1]!
      : join(dir, "fixtures", "activtrak-gemini.json");
  const bPath =
    bFlag >= 0
      ? args[bFlag + 1]!
      : join(dir, "fixtures", "activtrak-alternate.json");

  const aReport = loadJson(aPath);
  const bReport = loadJson(bPath);
  const a = scoreSuite([{ gold, report: aReport }]);
  const b = scoreSuite([{ gold, report: bReport }]);
  printSuite(`A (Gemini / primary) ${aPath}`, a);
  printSuite(`B (alternate) ${bPath}`, b);
  const winner = pickWinner("Gemini", suiteRank(a), "alternate", suiteRank(b));
  if (winner === "Gemini") {
    console.log(
      "Recommendation: keep AI_PROVIDER=gemini (gemini-3.1-pro-preview)."
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
