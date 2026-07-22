import type { ReviewResult } from "../domain/review-result";

export const terminalReaction: Record<ReviewResult["status"], string> = { approved: "white_check_mark", correction_required: "memo", needs_human_review: "warning", rejected: "x" };

const escapeSlack = (value: unknown): string => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const bullets = (heading: string, values: readonly string[]) => values.length ? `\n*${heading}:*\n${values.map((value) => `• ${escapeSlack(value)}`).join("\n")}` : "";

export function formatReviewResult(result: ReviewResult): string {
  const heading = { approved: "Approved", correction_required: "Correction required", needs_human_review: "Needs human review", rejected: "Rejected" }[result.status];
  const mismatches = result.mismatches.map(({ field, crmValue, bookingValue }) => `${field}: CRM is “${String(crmValue)}”; booking is “${String(bookingValue)}”`);
  const mention = result.status === "needs_human_review" ? "<!here> " : "";
  const details = `${bullets("Mismatches", mismatches)}${bullets("Missing note entries", result.missingNoteEntries)}${bullets("Missing evidence", result.missingEvidence)}${bullets("Failed requirements", result.failedRequirements)}`;
  const instruction = result.status === "correction_required" ? "\nPlease reply in this thread with updated text and/or screenshots. Text can clarify booking values but cannot replace required screenshot evidence." : "";
  return `${mention}*Booking review: ${heading}*\n${escapeSlack(result.reasoning)}${details}${instruction}`;
}
