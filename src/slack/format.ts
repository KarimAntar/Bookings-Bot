import type { ReviewResult } from "../domain/review-result";

export const terminalReaction: Record<ReviewResult["status"], string> = {
  approved: "white_check_mark",
  needs_human_review: "warning",
  rejected: "x",
};

export function formatReviewResult(result: ReviewResult): string {
  const heading = {
    approved: "Approved",
    needs_human_review: "Needs human review",
    rejected: "Rejected",
  }[result.status];
  const fields = Object.entries(result.extractedFields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `• ${key}: ${String(value)}`);
  const flags = result.flags.length ? `\n*Flags:* ${result.flags.join(", ")}` : "";
  return `*Booking review: ${heading}*\n${result.reasoning}\n*Confidence:* ${Math.round(result.confidence * 100)}%${fields.length ? `\n*Extracted fields:*\n${fields.join("\n")}` : ""}${flags}`;
}
