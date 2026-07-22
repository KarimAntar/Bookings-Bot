import { describe, expect, test } from "bun:test";
import type { AIProvider } from "../../src/ai/ai-provider";
import type { ReviewRequest } from "../../src/domain/review-request";
import { type ReviewResult, ReviewResultSchema } from "../../src/domain/review-result";
import { ReviewService } from "../../src/reviews/review-service";
import { classifyMessage } from "../../src/slack/message-listener";
import { formatReviewResult } from "../../src/slack/format";
import { ReviewThreadStore } from "../../src/slack/review-thread-store";

const logger = { error: () => undefined } as never;
const image = (id: string, source: "original" | "correction" = "original") => ({
  id: `${source}:${id}`,
  name: `${id}.png`,
  mimeType: "image/png" as const,
  data: new Uint8Array([1]),
  source,
});

function result(overrides: Partial<ReviewResult> = {}): ReviewResult {
  return ReviewResultSchema.parse({
    status: "approved",
    reasoning: "CRM, campaign, booking form, qualification answers, and notes match.",
    confidence: 0.98,
    evidenceRoles: [
      { imageId: "original:crm", roles: ["crm_prospect"], readable: true },
      { imageId: "original:campaign", roles: ["campaign_requirements", "qualification_questions"], readable: true },
      { imageId: "original:booking", roles: ["booking_form", "booking_notes"], readable: true },
    ],
    crmFields: { firstName: "Ava", sales: 12 },
    bookingFields: { firstName: "Ava" },
    campaignRequirements: [{ name: "Minimum sales", requiredValue: 10, actualValue: 12, passed: true, mustAppearInNotes: true }],
    qualificationQuestions: [{ question: "Annual sales?", answer: 12, required: true, presentInNotes: true }],
    notesSummary: { present: true, contentSummary: "Required qualification answers recorded.", requiredEntriesPresent: true },
    mismatches: [],
    missingNoteEntries: [],
    missingEvidence: [],
    failedRequirements: [],
    flags: ["safe_public_summary"],
    ...overrides,
  });
}

class ScenarioProvider implements AIProvider {
  readonly requests: ReviewRequest[] = [];
  constructor(private readonly decide: (request: ReviewRequest) => ReviewResult) {}
  async review(request: ReviewRequest): Promise<ReviewResult> {
    this.requests.push(request);
    return this.decide(request);
  }
}

async function compose(provider: ScenarioProvider, request: ReviewRequest) {
  const reviewed = await new ReviewService(provider, 0.8, logger).review(request);
  return { reviewed, reply: formatReviewResult(reviewed) };
}

const completeRequest = (messageText = "g2g?"): ReviewRequest => ({
  eventId: "Ev1",
  messageText,
  images: [image("crm"), image("campaign"), image("booking")],
});

describe("Slack booking scenarios", () => {
  test("approved matching package", async () => {
    const provider = new ScenarioProvider(() => result());
    const { reviewed, reply } = await compose(provider, completeRequest());
    expect(reviewed.status).toBe("approved");
    expect(reply).toContain("Booking review: Approved");
    expect(reply).not.toContain("<!here>");
    expect(provider.requests[0]?.images.map(({ id }) => id)).toEqual(["original:crm", "original:campaign", "original:booking"]);
  });

  test("missing qualification notes requests a correction", async () => {
    const provider = new ScenarioProvider(() => result({
      status: "correction_required",
      reasoning: "A required qualification answer is absent from booking notes.",
      qualificationQuestions: [{ question: "Annual sales?", answer: 12, required: true, presentInNotes: false }],
      notesSummary: { present: true, contentSummary: "Qualification answer is absent.", requiredEntriesPresent: false },
      missingNoteEntries: ["Annual sales: 12"],
    }));
    const { reviewed, reply } = await compose(provider, completeRequest());
    expect(reviewed.status).toBe("correction_required");
    expect(reply).toContain("Annual sales: 12");
    expect(reply).toContain("reply in this thread");
    expect(reply).not.toContain("<!here>");
  });

  test("corrected thread combines original and latest evidence and approves", async () => {
    const store = new ReviewThreadStore(10, 60_000);
    store.create({ channel: "C1", rootTs: "1", originalText: "g2g?", originalImages: completeRequest().images, lastEventId: "Ev1" });
    const combined = store.applyCorrection("C1", "1", { text: "Annual sales: 12", images: [image("notes-fixed", "correction")], eventId: "Ev2" });
    expect(combined).toBeDefined();
    if (!combined) throw new Error("Expected the active correction to be retained");
    expect(classifyMessage({ type: "message", channel: "C1", ts: "2", thread_ts: "1", text: "Annual sales: 12", files: [] }, store.has("C1", "1"))).toBe("correction");
    const provider = new ScenarioProvider((request) => request.images.some(({ source }) => source === "correction") ? result() : result({ status: "correction_required", missingNoteEntries: ["Annual sales: 12"] }));
    const { reviewed } = await compose(provider, { eventId: "Ev2", ...combined.evidence });
    expect(reviewed.status).toBe("approved");
    expect(provider.requests[0]?.messageText).toContain("Correction (authoritative where conflicting): Annual sales: 12");
    expect(provider.requests[0]?.images.map(({ id }) => id)).toEqual(["original:crm", "original:campaign", "original:booking", "correction:notes-fixed"]);
  });

  test("minimum-sales failure is rejected", async () => {
    const provider = new ScenarioProvider(() => result({
      status: "rejected",
      reasoning: "Authoritative CRM sales are below the campaign minimum.",
      crmFields: { firstName: "Ava", sales: 7 },
      campaignRequirements: [{ name: "Minimum sales", requiredValue: 10, actualValue: 7, passed: false, mustAppearInNotes: true }],
      failedRequirements: ["Minimum sales: requires 10, CRM shows 7"],
    }));
    const { reviewed, reply } = await compose(provider, completeRequest());
    expect(reviewed.status).toBe("rejected");
    expect(reply).toContain("Minimum sales: requires 10, CRM shows 7");
    expect(reply).not.toContain("reply in this thread");
  });

  test("missing screenshot requests the exact evidence", async () => {
    const provider = new ScenarioProvider(() => result({ status: "correction_required", reasoning: "Campaign requirements are not supplied.", missingEvidence: ["Campaign requirements screenshot"] }));
    const request = completeRequest();
    const { reviewed, reply } = await compose(provider, { ...request, images: request.images.filter(({ id }) => id !== "original:campaign") });
    expect(reviewed.status).toBe("correction_required");
    expect(reply).toContain("Campaign requirements screenshot");
  });

  test("ambiguous evidence requests human review with <!here>", async () => {
    const provider = new ScenarioProvider(() => result({ status: "needs_human_review", reasoning: "The sales value is unreadable in the CRM screenshot.", confidence: 0.45, evidenceRoles: [{ imageId: "original:crm", roles: ["crm_prospect"], readable: false }] }));
    const { reviewed, reply } = await compose(provider, completeRequest());
    expect(reviewed.status).toBe("needs_human_review");
    expect(reply).toStartWith("<!here>");
  });

  test("caption wording is neutral to eligibility and decision", async () => {
    const provider = new ScenarioProvider(() => result());
    for (const [index, caption] of ["test", "g2g?", "@here g2g?", "test booking"].entries()) {
      expect(classifyMessage({ type: "message", channel: "C1", ts: String(index), text: caption, files: [{ id: "F1", mimetype: "image/png", size: 1, url_private_download: "https://example.test/F1" }] }, false)).toBe("root");
      expect((await compose(provider, completeRequest(caption))).reviewed.status).toBe("approved");
    }
    expect(provider.requests.map(({ messageText }) => messageText)).toEqual(["test", "g2g?", "@here g2g?", "test booking"]);
  });
});
