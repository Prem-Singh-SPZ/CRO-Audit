import {
  SCORE_CATEGORY_LABELS,
  SEVERITIES,
  type EmailReportInput,
  type ReportResponse,
  type SeverityLevel,
} from "@cro/shared";
import { safeHost } from "@/lib/utils";

const SEVERITY_RANK: Record<SeverityLevel, number> = Object.fromEntries(
  SEVERITIES.map((s, i) => [s, i])
) as Record<SeverityLevel, number>;

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export function emailReportPayload(
  data: ReportResponse,
  token: string,
  shareUrl?: string | null
): Omit<EmailReportInput, "token"> & { token: string } {
  const issues = [...data.issues]
    .sort(
      (a, b) =>
        (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
    )
    .slice(0, 5)
    .map((issue) => ({
      title: clip(issue.title || "Untitled issue", 200),
      severity: issue.severity,
      category:
        SCORE_CATEGORY_LABELS[
          issue.category as keyof typeof SCORE_CATEGORY_LABELS
        ] ?? clip(issue.category || "General", 80),
      description: clip(issue.description || "See the full report for details.", 400),
    }));

  const bottleneck = data.report.primaryBottleneck?.trim();

  return {
    token,
    host: safeHost(data.scan.url, "your site"),
    score: data.report.overallScore,
    summary: clip(data.report.summary || "Your CRO report is ready.", 1200),
    ...(bottleneck ? { primaryBottleneck: clip(bottleneck, 400) } : {}),
    issues,
    ...(shareUrl ? { shareUrl } : {}),
  };
}
