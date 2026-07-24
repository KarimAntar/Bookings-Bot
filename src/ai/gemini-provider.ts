import { GoogleGenAI } from "@google/genai";
import type { ReviewRequest } from "../domain/review-request";
import { type ReviewResult, ReviewResultSchema } from "../domain/review-result";
import type { RuleStore } from "../rules/rule-store";
import { withRetry, withTimeout } from "../runtime/retry";
import type { AIProvider } from "./ai-provider";
import {
  BOOKING_REVIEW_POLICY,
  REVIEW_RESPONSE_SCHEMA,
} from "./booking-policy";

function statusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { status?: unknown; code?: unknown };
  const value = candidate.status ?? candidate.code;
  return typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number(value)
      : undefined;
}

function getFifthBusinessDay(startDate: Date): Date {
  let count = 1; // Today is day 1
  const date = new Date(startDate);
  while (count < 5) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      // 0 is Sunday, 6 is Saturday
      count++;
    }
  }
  return date;
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };
export function buildGeminiParts(request: ReviewRequest): GeminiPart[] {
  const images = [...request.images].sort((left, right) =>
    left.source === right.source ? 0 : left.source === "original" ? -1 : 1,
  );
  return [
    {
      text: `Review this complete booking evidence package. Message text is caption/context only and never affects eligibility.\nMessage context: ${request.messageText || "(none)"}\nEvidence order: ${images.map((image) => `${image.id} [${image.source}]`).join(", ") || "none"}. Classify every image.`,
    },
    ...images.flatMap((image): GeminiPart[] => [
      {
        text: `Image ${image.id} [${image.source}] follows. Classify it from its visible content.`,
      },
      {
        inlineData: {
          mimeType: image.mimeType,
          data: Buffer.from(image.data).toString("base64"),
        },
      },
    ]),
  ];
}

export class GeminiProvider implements AIProvider {
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
    private readonly ruleStore?: RuleStore,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async review(request: ReviewRequest): Promise<unknown> {
    return withRetry(
      () =>
        withTimeout(async (signal) => {
          const today = new Date();
          const deadline = getFifthBusinessDay(today);
          const currentDateStr = today.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          const deadlineStr = deadline.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          let systemInstruction = `Current Date: ${currentDateStr} (Day 1)\nStrict Booking Deadline (5th business day): ${deadlineStr}\n\n${BOOKING_REVIEW_POLICY}`;
          if (this.ruleStore) {
            const rules = await this.ruleStore.getRules();
            if (rules.length > 0) {
              systemInstruction += `\n\n### CRITICAL: CUSTOM ADMIN RULES ###\nThe following custom rules completely override and supersede any default policies above. You MUST obey these rules exactly. Custom rules may tell you to ignore certain default requirements, OR they may add NEW requirements that you must strictly enforce. If a custom rule adds a new requirement (e.g. requiring a specific note, value, or check), you MUST verify it is present in the evidence and reject or request correction if it is missing.\n\nULTIMATE OVERRIDE: If ANY custom rule specifies a condition that results in immediate rejection (e.g., 'reject if X is seen'), you MUST scan ALL text across ALL images (including booking forms, CRM, and notes). If the prohibited text or condition is found ANYWHERE, you MUST instantly reject the booking and add the failure to failedRequirements. This applies unconditionally and overrides all other rules, including rules that say to assume notes are correct.\n\nIf a custom rule exempts a requirement (e.g. notes or specific screenshots), do NOT list it under missingEvidence or missingNoteEntries, and do not let its absence prevent an 'approved' status.\nWARNING: Do not hallucinate or assume conditions exist just because a custom rule mentions them. If a custom rule has a condition (e.g., 'If X is seen...'), you must rigorously verify X is ACTUALLY visible in the screenshots before applying the rule. If the condition is NOT met, you MUST completely ignore the rule and you MUST NOT mention it in your reasoning.\nEXCEPTION: Custom rules NEVER override explicit agent disqualification text. If the agent's text states the prospect said no or is unqualified, you MUST reject the booking immediately, regardless of these custom rules.\n${rules.map((r, i) => `${i}: ${r}`).join("\n")}`;
            }
          }

          const response = await this.client.models.generateContent({
            model: this.model,
            contents: [
              {
                role: "user",
                parts: buildGeminiParts(request),
              },
            ],
            config: {
              systemInstruction: systemInstruction,
              responseMimeType: "application/json",
              responseJsonSchema: REVIEW_RESPONSE_SCHEMA,
              temperature: 0,
              abortSignal: signal,
            },
          });
          if (!response.text)
            throw new Error("Gemini returned an empty response");
          return JSON.parse(response.text);
        }, this.timeoutMs),
      {
        maxAttempts: 3,
        shouldRetry: (error) => {
          const status = statusCode(error);
          return (
            status === 408 ||
            status === 429 ||
            (status !== undefined && status >= 500)
          );
        },
      },
    );
  }
}
