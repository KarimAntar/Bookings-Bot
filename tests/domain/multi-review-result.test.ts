import { describe, expect, test } from "bun:test";
import { ReviewResultSchema } from "../../src/domain/review-result";
import { formatReviewResult } from "../../src/slack/format";

const result = {
  status: "correction_required",
  reasoning: "Correctable evidence gaps remain.",
  confidence: 0.9,
  evidenceRoles: [
    { imageId: "original:1", roles: ["crm_prospect"], readable: true },
  ],
  crmFields: { firstName: "Ada", sales: 12 },
  bookingFields: { firstName: "Ava" },
  campaignRequirements: [
    {
      name: "Minimum sales",
      requiredValue: 10,
      actualValue: 12,
      passed: true,
      mustAppearInNotes: true,
    },
  ],
  qualificationQuestions: [
    {
      question: "Annual sales?",
      answer: "12",
      required: true,
      presentInNotes: false,
    },
  ],
  notesSummary: {
    present: true,
    contentSummary: "Annual sales entry is missing.",
    requiredEntriesPresent: false,
  },
  mismatches: [{ field: "firstName", crmValue: "Ada", bookingValue: "Ava" }],
  missingNoteEntries: ["Annual sales: 12"],
  missingEvidence: ["Booking notes screenshot"],
  failedRequirements: [],
  flags: ["correctable", "safe_public_summary"],
} as const;

describe("rich ReviewResult", () => {
  test("accepts a bounded correction result", () => {
    expect(ReviewResultSchema.parse(result).status).toBe("correction_required");
  });

  test("rejects unknown nested fields", () => {
    expect(() =>
      ReviewResultSchema.parse({
        ...result,
        evidenceRoles: [{ ...result.evidenceRoles[0], captionDecision: true }],
      }),
    ).toThrow();
  });

  test("formats corrections without mentions and human review with <!here>", () => {
    const correction = formatReviewResult(ReviewResultSchema.parse(result));
    expect(correction).toContain("reply to this thread");
    expect(correction).toContain("firstName");
    expect(correction).not.toContain("<!here>");
    expect(
      formatReviewResult(
        ReviewResultSchema.parse({ ...result, status: "needs_human_review" }),
      ),
    ).toContain("<!here>");
  });

  test("requires an exact safe-public contract and falls back without exposing model output", () => {
    expect(() =>
      ReviewResultSchema.parse({ ...result, flags: ["correctable"] }),
    ).toThrow();
    const unsafe = ReviewResultSchema.parse({
      ...result,
      status: "needs_human_review",
      flags: ["unsafe_public_output"],
    });
    const formatted = formatReviewResult(unsafe);
    expect(formatted).toContain("could not be shared safely");
    expect(formatted).not.toContain(result.reasoning);
    expect(formatted).not.toContain("firstName");
  });
});
