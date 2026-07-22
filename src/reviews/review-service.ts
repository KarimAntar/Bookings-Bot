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
      const result = ReviewResultSchema.parse(await this.provider.review(request));
      if (result.status === "approved" && result.confidence < this.lowConfidenceThreshold) {
        return {
          ...result,
          status: "needs_human_review",
          flags: [...new Set([...result.flags, "low_confidence_approval"])],
        };
      }
      return result;
    } catch (error) {
      this.logger.error({ err: error, eventId: request.eventId }, "Automated review failed");
      return humanReviewFallback("automated_review_failed");
    }
  }
}
