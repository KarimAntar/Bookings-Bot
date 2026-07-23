import type { AIProvider } from "../ai/ai-provider";
import type { ReviewRequest } from "../domain/review-request";
import { humanReviewFallback, ReviewResultSchema, type ReviewResult } from "../domain/review-result";
import type { Logger } from "pino";

export class ReviewService {
  constructor(
    private readonly provider: AIProvider,
    private readonly lowConfidenceThreshold: number,
    private readonly logger: Logger,
  ) {}

  async review(request: ReviewRequest): Promise<ReviewResult> {
    try {
      let raw = await this.provider.review(request) as any;
      if (typeof raw === "object" && raw !== null) {
        if (!Array.isArray(raw.flags)) {
          raw.flags = ["safe_public_summary"];
        } else {
          const hasSafe = raw.flags.includes("safe_public_summary");
          const hasUnsafe = raw.flags.includes("unsafe_public_output") || raw.flags.includes("unsafe_internal");

          if (!hasSafe && !hasUnsafe) {
            raw.flags.push("safe_public_summary");
          } else if (hasUnsafe) {
            raw.flags = raw.flags.filter((f: string) => f !== "unsafe_internal");
            if (!raw.flags.includes("unsafe_public_output")) {
              raw.flags.push("unsafe_public_output");
            }
            if (raw.status !== "needs_human_review") {
              raw.status = "needs_human_review";
            }
          }
        }

        const correctionFindings = (raw.mismatches?.length || 0) + (raw.missingNoteEntries?.length || 0) + (raw.missingEvidence?.length || 0);
        const hasFailedReqs = (raw.failedRequirements?.length || 0) > 0;

        if (raw.status === "approved" && hasFailedReqs) {
          raw.status = "rejected";
        } else if (raw.status === "approved" && correctionFindings > 0) {
          raw.status = "correction_required";
        } else if (raw.status === "correction_required" && hasFailedReqs) {
          raw.status = "rejected";
        } else if (raw.status === "correction_required" && correctionFindings === 0) {
          raw.status = "needs_human_review";
        } else if (raw.status === "rejected" && !hasFailedReqs) {
          if (correctionFindings > 0) raw.status = "correction_required";
          else raw.status = "needs_human_review";
        }
      }

      const result = ReviewResultSchema.parse(raw);
      if (result.status !== "needs_human_review" && result.confidence < this.lowConfidenceThreshold) {
        return {
          ...result,
          status: "needs_human_review",
          flags: [...new Set([...result.flags, "low_confidence"])],
        };
      }
      return result;
    } catch (error) {
      this.logger.error({ err: error, eventId: request.eventId }, "Automated review failed");
      return humanReviewFallback("automated_review_failed");
    }
  }
}
