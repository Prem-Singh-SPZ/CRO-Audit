import type { ReportJson } from "@cro/shared";
import gold from "./gold-set.json";

export interface GoldIssue {
  id: string;
  keywords: string[];
}

export interface GoldPin {
  elementId: string;
  yMin: number;
  yMax: number;
}

export interface GoldCase {
  id: string;
  url: string;
  host: string;
  sections: string[];
  bottleneckKeywords: string[];
  expectedIssues: GoldIssue[];
  expectedPins: GoldPin[];
}

export interface CaseScore {
  id: string;
  precision: number;
  recall: number;
  bottleneckHit: boolean;
  sectionCoverage: number;
  pinHits: number;
  pinTotal: number;
}

export interface SuiteScore {
  cases: CaseScore[];
  meanPrecision: number;
  meanRecall: number;
  pinAccuracy: number;
  bottleneckRate: number;
}

export function goldCases(): GoldCase[] {
  return gold.cases as GoldCase[];
}

export function goldByHost(host: string): GoldCase | undefined {
  const h = host.replace(/^www\./, "").toLowerCase();
  return goldCases().find(
    (c) => c.host.replace(/^www\./, "").toLowerCase() === h || c.id === host
  );
}

function blob(issue: { title: string; description: string; category: string }): string {
  return `${issue.title} ${issue.description} ${issue.category}`.toLowerCase();
}

function keywordsHit(text: string, keywords: string[]): boolean {
  const hits = keywords.filter((k) => text.includes(k.toLowerCase())).length;
  return hits >= Math.ceil(keywords.length / 2);
}

export function scoreCase(goldCase: GoldCase, report: ReportJson): CaseScore {
  const issues = report.issues ?? [];
  const texts = issues.map((i) => blob(i));
  const matchedExpected = goldCase.expectedIssues.filter((exp) =>
    texts.some((t) => keywordsHit(t, exp.keywords))
  );
  const matchedPredicted = issues.filter((i) =>
    goldCase.expectedIssues.some((exp) => keywordsHit(blob(i), exp.keywords))
  );
  const recall =
    goldCase.expectedIssues.length === 0
      ? 1
      : matchedExpected.length / goldCase.expectedIssues.length;
  const precision =
    issues.length === 0 ? 0 : matchedPredicted.length / issues.length;

  const bottleneck = `${report.primaryBottleneck ?? ""} ${report.summary}`.toLowerCase();
  const bottleneckHit = keywordsHit(bottleneck, goldCase.bottleneckKeywords);

  const reportText = [
    report.summary,
    report.primaryBottleneck,
    ...report.strengths,
    ...issues.map((i) => blob(i)),
  ]
    .join(" ")
    .toLowerCase();
  const sectionsHit = goldCase.sections.filter((s) =>
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3)
      .some((w) => reportText.includes(w))
  );
  const sectionCoverage =
    goldCase.sections.length === 0
      ? 1
      : sectionsHit.length / goldCase.sections.length;

  let pinHits = 0;
  for (const pin of goldCase.expectedPins) {
    const hit = issues.some((issue) => {
      const el = issue.annotation?.element;
      const y = issue.annotation?.y;
      if (y == null) return false;
      const elementOk = !el || el === pin.elementId;
      const inferred = blob(issue).includes(pin.elementId);
      return (elementOk || inferred) && y >= pin.yMin && y <= pin.yMax;
    });
    if (hit) pinHits += 1;
  }

  return {
    id: goldCase.id,
    precision,
    recall,
    bottleneckHit,
    sectionCoverage,
    pinHits,
    pinTotal: goldCase.expectedPins.length,
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function scoreSuite(
  pairs: Array<{ gold: GoldCase; report: ReportJson }>
): SuiteScore {
  const cases = pairs.map((p) => scoreCase(p.gold, p.report));
  const pinHits = cases.reduce((a, c) => a + c.pinHits, 0);
  const pinTotal = cases.reduce((a, c) => a + c.pinTotal, 0);
  return {
    cases,
    meanPrecision: mean(cases.map((c) => c.precision)),
    meanRecall: mean(cases.map((c) => c.recall)),
    pinAccuracy: pinTotal === 0 ? 0 : pinHits / pinTotal,
    bottleneckRate: mean(cases.map((c) => (c.bottleneckHit ? 1 : 0))),
  };
}

/** Higher is better. Used to keep Gemini unless an alternate clearly wins. */
export function suiteRank(suite: SuiteScore): number {
  return (
    suite.meanPrecision * 0.35 +
    suite.meanRecall * 0.35 +
    suite.pinAccuracy * 0.2 +
    suite.bottleneckRate * 0.1
  );
}
