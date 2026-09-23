import type { SeverityLevel } from "./constants";
import type {
  CategoryScores,
  ComplexityLevel,
  DiyRiskLevel,
} from "./schema";
import type { LiveTestInfo } from "./page-context";

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
// "hero" = marketing page. Form-page mockups store the proven-pattern name
// on `patternName` and keep a slug on `variant` for older clients.
export type MockupVariant = "form-over-ui" | "spz-baseline" | "hero" | "pattern";

export interface MockupDto {
  id: string;
  device: "desktop" | "tablet" | "mobile";
  url: string;
  width: number;
  height: number;
  variant?: MockupVariant;
  patternName?: string;
  uplift?: number;
  winRate?: number;
  sampleSize?: number;
  /** Gemini image vs. local overlay on the real screenshot. */
  source?: "generated" | "composed";
  /**
   * Where the redesign actually painted each element (0–1, center + size).
   * Callouts use these boxes. Missing keys are not guessed.
   */
  regions?: MockupRegions;
}

export interface MockupRegionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type MockupRegions = Partial<
  Record<"headline" | "bullets" | "cta", MockupRegionBox>
>;

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
  annotationW: number | null;
  annotationH: number | null;
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
  // Real page captured, but a late form / empty hero slot never painted.
  incompleteCapture?: boolean;
  captureNote?: string | null;
  liveTest?: LiveTestInfo | null;
  /** live = Chromium shot of the URL; archive = Internet Archive replay. */
  screenshotSource?: "live" | "archive";
  /** Human date of the IA snapshot when screenshotSource is archive. */
  archiveCapturedAt?: string | null;
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
  competitorCompare?: CompetitorCompareDto | null;
}

export interface CompetitorCompareDimension {
  key: string;
  label: string;
  you: number;
  them: number;
}

export interface CompetitorCompareDto {
  host: string;
  competitorHost: string;
  dimensions: CompetitorCompareDimension[];
  topGap: string;
}

// Request/response contract for the out-of-band mockup endpoint.
export interface MockupRequestDto {
  image: string;
  mimeType: string;
  host: string;
  // Host + scan id (or similar) so each audit rotates to the next pattern pair.
  rotateSeed?: string;
  primaryBottleneck?: string;
  issues: {
    severity: string;
    category: string;
    title: string;
    description: string;
  }[];
}

export type MockupFailureReason =
  | "disabled"
  | "no_key"
  | "payload_too_large"
  | "rate_limited"
  | "upstream_failed";

export interface MockupResponseDto {
  mockup: MockupDto | null;
  mockups?: MockupDto[];
  reason?: MockupFailureReason;
}
