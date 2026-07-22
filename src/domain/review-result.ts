import { z } from "zod";

export const ReviewStatusSchema = z.enum([
  "approved",
  "needs_human_review",
  "rejected",
]);

const ExtractedFieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const ReviewResultSchema = z.object({
  status: ReviewStatusSchema,
  reasoning: z.string().trim().min(1).max(1_000),
  confidence: z.number().min(0).max(1),
  extractedFields: z.record(z.string(), ExtractedFieldValueSchema),
  flags: z.array(z.string().trim().min(1).max(100)).max(50),
}).strict();

export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

export function humanReviewFallback(flag: string): ReviewResult {
  return ReviewResultSchema.parse({
    status: "needs_human_review",
    reasoning: "Automated review could not complete safely.",
    confidence: 0,
    extractedFields: {},
    flags: [flag],
  });
}
