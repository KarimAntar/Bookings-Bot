import type { ReviewRequest } from "../domain/review-request";
import type { ReviewResult } from "../domain/review-result";

export interface AIProvider {
  review(request: ReviewRequest): Promise<ReviewResult>;
}
