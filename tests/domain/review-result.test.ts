import { describe, expect, test } from "bun:test";
import { humanReviewFallback, ReviewResultSchema } from "../../src/domain/review-result";

const valid = {
  status: "approved" as const,
  reasoning: "  Booking details match.  ",
  confidence: 0.95,
  evidenceRoles: [], crmFields: { guest: "Ada", nights: 3, prepaid: true, note: null }, bookingFields: {},
  campaignRequirements: [], qualificationQuestions: [], notesSummary: { present: true, contentSummary: "Booking notes verified.", requiredEntriesPresent: true }, mismatches: [], missingNoteEntries: [], missingEvidence: [], failedRequirements: [],
  flags: ["  verified  "],
};

describe("ReviewResultSchema", () => {
  test("parses and normalizes a valid review", () => {
    expect(ReviewResultSchema.parse(valid)).toEqual({ ...valid, reasoning: "Booking details match.", flags: ["verified"] });
  });
  test("rejects unknown top-level provider fields", () => expect(() => ReviewResultSchema.parse({ ...valid, providerMetadata: "no" })).toThrow());
  test("rejects confidence outside zero through one", () => expect(() => ReviewResultSchema.parse({ ...valid, confidence: 1.01 })).toThrow());
  test("rejects empty reasoning and oversized flags", () => expect(() => ReviewResultSchema.parse({ ...valid, reasoning: " ", flags: Array.from({ length: 51 }, (_, i) => `f-${i}`) })).toThrow());
});

test("humanReviewFallback returns a conservative rich result", () => {
  expect(humanReviewFallback("  ai_timeout  ")).toEqual({
    status: "needs_human_review", reasoning: "Automated review could not complete safely.", confidence: 0,
    evidenceRoles: [], crmFields: {}, bookingFields: {}, campaignRequirements: [], qualificationQuestions: [], notesSummary: { present: false, contentSummary: "Notes could not be verified.", requiredEntriesPresent: false }, mismatches: [], missingNoteEntries: [], missingEvidence: [], failedRequirements: [], flags: ["ai_timeout"],
  });
});
