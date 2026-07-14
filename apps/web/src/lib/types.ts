import type { CategoryScores, SeverityLevel } from "@/lib/cro";

export type ScanStatus = "QUEUED" | "RUNNING" | "COMPLETE" | "FAILED";

export interface ScanStatusResponse {
  id: string;
  url: string;
  status: ScanStatus;
  progress: number;
  stage: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ScreenshotDto {
  id: string;
  device: "desktop" | "tablet" | "mobile";
  url: string;
  width: number;
  height: number;
}

export interface IssueDto {
  id: string;
  category: string;
  title: string;
  description: string;
  whyItMatters: string;
  severity: SeverityLevel;
  confidence: number;
  businessImpact: string;
  suggestedFix: string;
  estimatedConversionImpact: string;
  device: "desktop" | "tablet" | "mobile" | null;
  annotationX: number | null;
  annotationY: number | null;
}

export interface RecommendationDto {
  id: string;
  title: string;
  description: string;
  impact: number;
  effort: number;
  category: string;
}

export interface LighthouseDto {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  metrics: Record<string, number | undefined>;
}

export interface ReportResponse {
  scan: ScanStatusResponse & { shareId: string | null };
  report: {
    id: string;
    overallScore: number;
    categoryScores: CategoryScores;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    priority: "high" | "medium" | "low";
    confidence: number;
    estimatedImpact: string;
    aiProvider: string;
  };
  issues: IssueDto[];
  recommendations: RecommendationDto[];
  screenshots: ScreenshotDto[];
  lighthouse: LighthouseDto | null;
}
