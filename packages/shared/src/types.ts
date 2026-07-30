import type { SeverityLevel } from "./constants";
import type {
  CategoryScores,
  ComplexityLevel,
  DiyRiskLevel,
} from "./schema";

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

// An AI-generated "after" concept: the same page re-imagined with the audit's
// top conversion fixes applied. Rendered next to the annotated "before".
export interface MockupDto {
  id: string;
  device: "desktop" | "tablet" | "mobile";
  url: string;
  width: number;
  height: number;
}

// The compact seed the report page posts to /api/mockup to generate the "after"
// concept out-of-band (so the slow image model never blocks the main audit).
export interface MockupSeed {
  // Raw base64 (no data-URI prefix) of the above-the-fold hero capture.
  image: string;
  mimeType: string;
}

export interface IssueDto {
  id: string;
  category: string;
  title: string;
  description: string;
  whyItMatters: string;
  psychology: string;
  severity: SeverityLevel;
  confidence: number;
  businessImpact: string;
  suggestedFix: string;
  estimatedConversionImpact: string;
  complexity: ComplexityLevel | null;
  riskOfDiy: DiyRiskLevel | null;
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
  // True when the target served a bot-protection / verification wall and the
  // real page could not be read. The report fields below are neutral
  // placeholders in that case; the UI shows a dedicated blocked state instead.
  blocked?: boolean;
  blockReason?: string | null;
  report: {
    id: string;
    overallScore: number;
    primaryBottleneck: string;
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
  mockups: MockupDto[];
  // Seed for the deferred "after" mockup; null when no screenshot was captured.
  mockupSeed: MockupSeed | null;
  lighthouse: LighthouseDto | null;
}

// Request/response contract for the out-of-band mockup endpoint.
export interface MockupRequestDto {
  image: string;
  mimeType: string;
  host: string;
  primaryBottleneck?: string;
  issues: {
    severity: string;
    category: string;
    title: string;
    description: string;
  }[];
}

export interface MockupResponseDto {
  mockup: MockupDto | null;
}
