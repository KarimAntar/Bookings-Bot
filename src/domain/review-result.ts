import { z } from "zod";

export const ReviewStatusSchema = z.enum(["approved", "correction_required", "needs_human_review", "rejected"]);
const Text = z.string().trim().min(1).max(500);
const Value = z.union([z.string().max(500), z.number(), z.boolean(), z.null()]);
const Fields = z.record(z.string().trim().min(1).max(100), Value).refine((value) => Object.keys(value).length <= 50);
const EvidenceRole = z.enum(["crm_prospect", "campaign_requirements", "campaign_script", "qualification_questions", "booking_form", "booking_notes", "unknown"]);

export const ReviewResultSchema = z.object({
  status: ReviewStatusSchema,
  reasoning: z.string().trim().min(1).max(1_000),
  confidence: z.number().min(0).max(1),
  evidenceRoles: z.array(z.object({ imageId: z.string().regex(/^(original|correction):[^\s]+$/).max(500), roles: z.array(EvidenceRole).min(1).max(7), readable: z.boolean() }).strict()).max(20),
  crmFields: Fields,
  bookingFields: Fields,
  campaignRequirements: z.array(z.object({ name: Text, requiredValue: Value, actualValue: Value, passed: z.boolean(), mustAppearInNotes: z.boolean() }).strict()).max(50),
  qualificationQuestions: z.array(z.object({ question: Text, answer: Value, required: z.boolean(), presentInNotes: z.boolean() }).strict()).max(50),
  notesSummary: z.object({ present: z.boolean(), contentSummary: Text, requiredEntriesPresent: z.boolean() }).strict(),
  mismatches: z.array(z.object({ field: Text, crmValue: Value, bookingValue: Value }).strict()).max(50),
  missingNoteEntries: z.array(Text).max(50), missingEvidence: z.array(Text).max(20), failedRequirements: z.array(Text).max(50),
  flags: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
}).strict();

export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

export function humanReviewFallback(flag: string): ReviewResult {
  return ReviewResultSchema.parse({ status: "needs_human_review", reasoning: "Automated review could not complete safely.", confidence: 0, evidenceRoles: [], crmFields: {}, bookingFields: {}, campaignRequirements: [], qualificationQuestions: [], notesSummary: { present: false, contentSummary: "Notes could not be verified.", requiredEntriesPresent: false }, mismatches: [], missingNoteEntries: [], missingEvidence: [], failedRequirements: [], flags: [flag] });
}
