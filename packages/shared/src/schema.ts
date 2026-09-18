import { z } from "zod";
import { SCORE_CATEGORIES, SEVERITIES, DEVICES } from "./constants";
import { LANDMARK_IDS } from "./page-context";
import { isDisposableEmail } from "./disposable-email-domains";

// ---------------------------------------------------------------------------
// URL input validation
// ---------------------------------------------------------------------------

// Optional business context the user can supply for a sharper, message-matched
// audit. Kept short + trimmed; empty strings are normalized to undefined.
const optionalContextField = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const scanRequestSchema = z.object({
  url: z
    .string()
    .trim()
    .min(3, "Please enter a URL")
    .transform((val) => (/^https?:\/\//i.test(val) ? val : `https://${val}`))
    .refine((val) => {
      try {
        const u = new URL(val);
        return u.hostname.includes(".");
      } catch {
        return false;
      }
    }, "Please enter a valid website URL"),
  targetAudience: optionalContextField,
  coreProduct: optionalContextField,
  primaryTrafficSource: optionalContextField,
  competitorUrl: z.preprocess((v) => {
    if (typeof v !== "string") return undefined;
    const trimmed = v.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, optionalContextField),
});

export type ScanRequest = z.infer<typeof scanRequestSchema>;

// The optional context threaded into the AI prompt.
export interface AuditContext {
  targetAudience?: string;
  coreProduct?: string;
  primaryTrafficSource?: string;
}

// ---------------------------------------------------------------------------
// Category scores (0-100 for each pillar)
// ---------------------------------------------------------------------------

export const categoryScoresSchema = z.object(
  Object.fromEntries(
    SCORE_CATEGORIES.map((c) => [c, z.number().int().min(0).max(100)])
  ) as Record<(typeof SCORE_CATEGORIES)[number], z.ZodNumber>
);

export type CategoryScores = z.infer<typeof categoryScoresSchema>;

// ---------------------------------------------------------------------------
// Issues, annotations, recommendations
// ---------------------------------------------------------------------------

export const annotationSchema = z.object({
  device: z.enum(DEVICES),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1).optional(),
  height: z.number().min(0).max(1).optional(),
  // 1-based viewport band the model annotated. Stripped after the API remaps
  // x/y into full-stitch coordinates; kept optional so leftover values parse.
  band: z.number().int().min(1).optional(),
  // Measured landmark on the live page. When set, the API overwrites x/y/w/h
  // from Chromium so pins sit on the real element, not the model's guess.
  element: z.enum(LANDMARK_IDS).optional(),
});

export type Annotation = z.infer<typeof annotationSchema>;

export const COMPLEXITY_LEVELS = ["High", "Medium", "Low"] as const;
export type ComplexityLevel = (typeof COMPLEXITY_LEVELS)[number];

export const DIY_RISK_LEVELS = [
  "High Risk",
  "Moderate Risk",
  "Low Risk",
] as const;
export type DiyRiskLevel = (typeof DIY_RISK_LEVELS)[number];

export const issueSchema = z.object({
  category: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  whyItMatters: z.string(),
  // The conversion psychology — WHY users hesitate/leave because of this flaw.
  psychology: z.string().optional(),
  severity: z.enum(SEVERITIES),
  confidence: z.number().int().min(0).max(100),
  businessImpact: z.string(),
  // Gated teaser (not full technical steps) that routes the user to a call.
  suggestedFix: z.string(),
  estimatedConversionImpact: z.string(),
  // Implementation difficulty + the risk of the user breaking their own site
  // tracking/styling if they attempt the fix themselves (DIY deterrents).
  complexity: z.enum(COMPLEXITY_LEVELS).optional(),
  riskOfDiy: z.enum(DIY_RISK_LEVELS).optional(),
  annotation: annotationSchema.nullable().optional(),
});

export type IssueInput = z.infer<typeof issueSchema>;

export const recommendationSchema = z.object({
  title: z.string(),
  description: z.string(),
  impact: z.number().int().min(1).max(5),
  effort: z.number().int().min(1).max(5),
  category: z.string(),
});

export type RecommendationInput = z.infer<typeof recommendationSchema>;

// ---------------------------------------------------------------------------
// The full structured AI report
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Email verification (OTP) + report delivery
// ---------------------------------------------------------------------------

export const otpRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email")
    .refine((email) => !isDisposableEmail(email), {
      message: "Please use a permanent email — disposable inboxes aren't allowed.",
    }),
});
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  requestId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
  // Optional lead-enrichment context captured for marketing. Each field is
  // `.catch(undefined)` so malformed enrichment data can NEVER cause a
  // verification to fail — the critical requestId/code checks are unaffected.
  host: z.string().max(255).optional().catch(undefined),
  url: z.string().max(2048).optional().catch(undefined),
  score: z.number().int().min(0).max(100).optional().catch(undefined),
  device: z.enum(["desktop", "mobile"]).optional().catch(undefined),
  primaryBottleneck: z.string().max(400).optional().catch(undefined),
  topIssueTitle: z.string().max(200).optional().catch(undefined),
});
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

export const emailReportIssueSchema = z.object({
  title: z.string().min(1).max(200),
  severity: z.enum(SEVERITIES),
  category: z.string().min(1).max(80),
  description: z.string().min(1).max(400),
});

export const emailReportSchema = z.object({
  token: z.string().min(1),
  host: z.string().min(1).max(255),
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1).max(1200),
  primaryBottleneck: z.string().max(400).optional(),
  issues: z.array(emailReportIssueSchema).max(5),
  // Optional live-report link. Only included when Share already created one;
  // email never uploads to Blob just to mint this.
  shareUrl: z.string().url().optional(),
});
export type EmailReportInput = z.infer<typeof emailReportSchema>;

export const reportSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  categoryScores: categoryScoresSchema,
  summary: z.string(),
  // The single biggest conversion blocker on the page, in one sentence.
  primaryBottleneck: z.string().optional(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  // At least one issue must be present — an empty audit is never a valid report
  // (a genuinely clean page still surfaces low-severity opportunities). This
  // also forces a malformed/empty LLM payload to fall back to the heuristics.
  issues: z.array(issueSchema).min(1),
  recommendations: z.array(recommendationSchema),
  priority: z.enum(["high", "medium", "low"]),
  confidence: z.number().int().min(0).max(100),
  estimatedImpact: z.string(),
});

export type ReportJson = z.infer<typeof reportSchema>;
