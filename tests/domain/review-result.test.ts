import { describe, expect, test } from "bun:test";
import {
  humanReviewFallback,
  ReviewResultSchema,
} from "../../src/domain/review-result";

describe("ReviewResultSchema", () => {
  test("parses and normalizes a valid review", () => {
    const result = ReviewResultSchema.parse({
      status: "approved",
      reasoning: "  Booking details match.  ",
      confidence: 0.95,
      extractedFields: {
        guest: "Ada",
        nights: 3,
        prepaid: true,
        note: null,
      },
      flags: ["  verified  "],
    });

    expect(result).toEqual({
      status: "approved",
      reasoning: "Booking details match.",
      confidence: 0.95,
      extractedFields: {
        guest: "Ada",
        nights: 3,
        prepaid: true,
        note: null,
      },
      flags: ["verified"],
    });
  });

  test("rejects confidence outside zero through one", () => {
    expect(() =>
      ReviewResultSchema.parse({
        status: "rejected",
        reasoning: "Mismatch.",
        confidence: 1.01,
        extractedFields: {},
        flags: [],
      }),
    ).toThrow();
  });

  test("rejects empty trimmed reasoning and oversized flag collections", () => {
    expect(() =>
      ReviewResultSchema.parse({
        status: "approved",
        reasoning: "   ",
        confidence: 1,
        extractedFields: {},
        flags: Array.from({ length: 51 }, (_, index) => `flag-${index}`),
      }),
    ).toThrow();
  });
});

test("humanReviewFallback returns the exact conservative result", () => {
  expect(humanReviewFallback("  ai_timeout  ")).toEqual({
    status: "needs_human_review",
    reasoning: "Automated review could not complete safely.",
    confidence: 0,
    extractedFields: {},
    flags: ["ai_timeout"],
  });
});
