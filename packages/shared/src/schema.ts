import { z } from "zod";
import { SCORE_CATEGORIES, SEVERITIES, DEVICES } from "./constants";
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
});
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

export const emailReportSchema = z.object({
  token: z.string().min(1),
  shareUrl: z.string().url(),
  host: z.string().min(1).max(255),
  score: z.number().int().min(0).max(100),
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
