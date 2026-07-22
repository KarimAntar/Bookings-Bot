import { GoogleGenAI } from "@google/genai";
import type { AIProvider } from "./ai-provider";
import { BOOKING_REVIEW_POLICY, REVIEW_RESPONSE_SCHEMA } from "./booking-policy";
import type { ReviewRequest } from "../domain/review-request";
import { ReviewResultSchema, type ReviewResult } from "../domain/review-result";
import { withRetry, withTimeout } from "../runtime/retry";

function statusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { status?: unknown; code?: unknown };
  const value = candidate.status ?? candidate.code;
  return typeof value === "number" ? value : typeof value === "string" ? Number(value) : undefined;
}

export class GeminiProvider implements AIProvider {
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async review(request: ReviewRequest): Promise<ReviewResult> {
    return withRetry(
      () => withTimeout(async (signal) => {
        const response = await this.client.models.generateContent({
          model: this.model,
          contents: [{
            role: "user",
            parts: [
              { text: `Review this booking submission.\nMessage: ${request.messageText || "(none)"}` },
              ...request.images.map((image) => ({
                inlineData: {
                  mimeType: image.mimeType,
                  data: Buffer.from(image.data).toString("base64"),
                },
              })),
            ],
          }],
          config: {
            systemInstruction: BOOKING_REVIEW_POLICY,
            responseMimeType: "application/json",
            responseJsonSchema: REVIEW_RESPONSE_SCHEMA,
            temperature: 0,
            abortSignal: signal,
          },
        });
        if (!response.text) throw new Error("Gemini returned an empty response");
        return ReviewResultSchema.parse(JSON.parse(response.text));
      }, this.timeoutMs),
      {
        maxAttempts: 3,
        shouldRetry: (error) => {
          const status = statusCode(error);
          return status === 408 || status === 429 || (status !== undefined && status >= 500);
        },
      },
    );
  }
}
