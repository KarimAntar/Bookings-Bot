import { describe, expect, test } from "bun:test";
import type { Logger } from "pino";
import { ReviewResultSchema } from "../../src/domain/review-result";
import { ReviewService } from "../../src/reviews/review-service";

const valid = {
  status: "approved" as const,
  reasoning: "All requirements pass.",
  confidence: 0.95,
  evidenceRoles: [
    {
      imageId: "original:F1",
      roles: ["booking_form" as const],
      readable: true,
    },
  ],
  crmFields: { firstName: "Ada" },
  bookingFields: { firstName: "Ada" },
  campaignRequirements: [],
  qualificationQuestions: [],
  notesSummary: {
    present: true,
    contentSummary: "Required details are present.",
    requiredEntriesPresent: true,
  },
  mismatches: [],
  missingNoteEntries: [],
  missingEvidence: [],
  failedRequirements: [],
  flags: ["safe_public_summary"],
};

const logger = { error() {} } as unknown as Logger;
const request = { eventId: "E1", messageText: "", images: [] };

describe("review result policy", () => {
  test("rejects statuses that contradict the structured findings", () => {
    expect(() =>
      ReviewResultSchema.parse({
        ...valid,
        mismatches: [{ field: "name", crmValue: "Ada", bookingValue: "Ava" }],
      }),
    ).toThrow();
    expect(() =>
      ReviewResultSchema.parse({
        ...valid,
        status: "correction_required",
        mismatches: [],
        missingNoteEntries: [],
        missingEvidence: [],
      }),
    ).toThrow();
    expect(() =>
      ReviewResultSchema.parse({
        ...valid,
        status: "rejected",
        failedRequirements: [],
      }),
    ).toThrow();
  });

  test("routes every low-confidence non-human decision to human review", async () => {
    for (const status of [
      "approved",
      "correction_required",
      "rejected",
    ] as const) {
      const candidate =
        status === "correction_required"
          ? {
              ...valid,
              status,
              confidence: 0.2,
              missingEvidence: ["Booking notes"],
            }
          : status === "rejected"
            ? {
                ...valid,
                status,
                confidence: 0.2,
                failedRequirements: ["Minimum sales"],
              }
            : { ...valid, status, confidence: 0.2 };
      const service = new ReviewService(
        { review: async () => candidate },
        0.8,
        logger,
      );
      const result = await service.review(request);
      expect(result.status).toBe("needs_human_review");
      expect(result.flags).toContain("low_confidence");
    }
  });
});
