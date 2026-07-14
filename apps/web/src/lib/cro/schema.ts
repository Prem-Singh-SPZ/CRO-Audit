import { z } from "zod";
import { SCORE_CATEGORIES, SEVERITIES, DEVICES } from "./constants";

// ---------------------------------------------------------------------------
// URL input validation
// ---------------------------------------------------------------------------

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
});

export type ScanRequest = z.infer<typeof scanRequestSchema>;

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

export const issueSchema = z.object({
  category: z.string(),
  title: z.string(),
  description: z.string(),
  whyItMatters: z.string(),
  severity: z.enum(SEVERITIES),
  confidence: z.number().int().min(0).max(100),
  businessImpact: z.string(),
  suggestedFix: z.string(),
  estimatedConversionImpact: z.string(),
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

export const reportSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  categoryScores: categoryScoresSchema,
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  issues: z.array(issueSchema),
  recommendations: z.array(recommendationSchema),
  priority: z.enum(["high", "medium", "low"]),
  confidence: z.number().int().min(0).max(100),
  estimatedImpact: z.string(),
});

export type ReportJson = z.infer<typeof reportSchema>;
