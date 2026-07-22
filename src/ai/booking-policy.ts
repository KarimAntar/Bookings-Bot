export const BOOKING_REVIEW_POLICY = `You review booking evidence conservatively.
Approve only when the supplied message and images clearly and consistently prove a valid booking. Never infer missing names, dates, amounts, confirmation numbers, payment status, or identity. Treat unreadable, cropped, contradictory, altered, duplicate, or incomplete evidence as needing human review. Reject only when the evidence clearly proves the booking is invalid or fraudulent. Otherwise choose needs_human_review. Keep reasoning concise, do not expose chain-of-thought, and include only directly observed primitive extracted fields. Confidence must reflect evidence quality.`;

export const REVIEW_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "reasoning", "confidence", "extractedFields", "flags"],
  properties: {
    status: { type: "string", enum: ["approved", "needs_human_review", "rejected"] },
    reasoning: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    extractedFields: {
      type: "object",
      additionalProperties: { type: ["string", "number", "boolean", "null"] },
    },
    flags: { type: "array", items: { type: "string" } },
  },
} as const;
