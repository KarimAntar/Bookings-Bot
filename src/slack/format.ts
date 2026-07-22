import type { ReviewResult } from "../domain/review-result";

export const terminalReaction: Record<ReviewResult["status"], string> = { approved: "white_check_mark", correction_required: "memo", needs_human_review: "warning", rejected: "x" };

const escapeSlack = (value: unknown): string => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const bullets = (heading: string, values: readonly string[]) => values.length ? `\n*${heading}:*\n${values.map((value) => `• ${escapeSlack(value)}`).join("\n")}` : "";

export function formatReviewResult(result: ReviewResult): string {
  if (!result.flags.includes("safe_public_summary")) {
    return "<!here> *Hmm, I need a second pair of eyes on this one.*\nAutomated review output could not be shared safely.";
  }
  const heading = { approved: "All good! 🎉 Booking approved.", correction_required: "Hey there! 👋 I need a quick fix before I can approve this.", needs_human_review: "Hmm, I need a second pair of eyes on this one.", rejected: "I can't approve this one based on the campaign rules." }[result.status];
  const mismatches = result.mismatches.map(({ field, crmValue, bookingValue }) => `${field}: CRM is “${String(crmValue)}”; booking is “${String(bookingValue)}”`);
  const mention = result.status === "needs_human_review" ? "<!here> " : "";
  const details = `${bullets("Mismatches", mismatches)}${bullets("Missing note entries", result.missingNoteEntries)}${bullets("Missing evidence", result.missingEvidence)}${bullets("Failed requirements", result.failedRequirements)}`;
  const instruction = result.status === "correction_required" ? "\nJust reply to this thread with the missing screenshots or info and I'll take another look!" : "";
  return `${mention}*${heading}*\n${escapeSlack(result.reasoning)}${details}${instruction}`;
}
