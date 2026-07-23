import { GoogleGenAI } from "@google/genai";
import type { AIProvider } from "./ai-provider";
import { BOOKING_REVIEW_POLICY, REVIEW_RESPONSE_SCHEMA } from "./booking-policy";
import type { ReviewRequest } from "../domain/review-request";
import { ReviewResultSchema, type ReviewResult } from "../domain/review-result";
import { withRetry, withTimeout } from "../runtime/retry";
import type { RuleStore } from "../rules/rule-store";

function statusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { status?: unknown; code?: unknown };
  const value = candidate.status ?? candidate.code;
  return typeof value === "number" ? value : typeof value === "string" ? Number(value) : undefined;
}

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
export function buildGeminiParts(request: ReviewRequest): GeminiPart[] {
  const images = [...request.images].sort((left, right) => (left.source === right.source ? 0 : left.source === "original" ? -1 : 1));
  return [
    { text: `Review this complete booking evidence package. Message text is caption/context only and never affects eligibility.\nMessage context: ${request.messageText || "(none)"}\nEvidence order: ${images.map((image) => `${image.id} [${image.source}]`).join(", ") || "none"}. Classify every image.` },
    ...images.flatMap((image): GeminiPart[] => [
      { text: `Image ${image.id} [${image.source}] follows. Classify it from its visible content.` },
      { inlineData: { mimeType: image.mimeType, data: Buffer.from(image.data).toString("base64") } },
    ]),
  ];
}

export class GeminiProvider implements AIProvider {
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
    private readonly ruleStore?: RuleStore
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async review(request: ReviewRequest): Promise<unknown> {
    return withRetry(
      () => withTimeout(async (signal) => {
        const currentDateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        let systemInstruction = `Current Date: ${currentDateStr}\n\n${BOOKING_REVIEW_POLICY}`;
        if (this.ruleStore) {
          const rules = await this.ruleStore.getRules();
          if (rules.length > 0) {
            systemInstruction += `\n\n### CRITICAL: CUSTOM ADMIN RULES ###\nThe following custom rules completely override and supersede any default policies above. You MUST obey these rules exactly. Custom rules may tell you to ignore certain default requirements, OR they may add NEW requirements that you must strictly enforce. If a custom rule adds a new requirement (e.g. requiring a specific note, value, or check), you MUST verify it is present in the evidence and reject or request correction if it is missing.\nWARNING: Do not hallucinate or assume conditions exist just because a custom rule mentions them. If a custom rule says 'If X is seen...', you must rigorously verify X is ACTUALLY visible in the screenshots before applying the rule.\nEXCEPTION: Custom rules NEVER override explicit agent disqualification text. If the agent's text states the prospect said no or is unqualified, you MUST reject the booking immediately, regardless of these custom rules.\n${rules.map((r, i) => `${i}: ${r}`).join("\n")}`;
          }
        }

        const response = await this.client.models.generateContent({
          model: this.model,
          contents: [{
            role: "user",
            parts: buildGeminiParts(request),
          }],
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseJsonSchema: REVIEW_RESPONSE_SCHEMA,
            temperature: 0,
            abortSignal: signal,
          },
        });
        if (!response.text) throw new Error("Gemini returned an empty response");
        return JSON.parse(response.text);
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
