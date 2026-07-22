import { describe, expect, test, spyOn } from "bun:test";
import type { AIProvider } from "../../src/ai/ai-provider";
import type { ReviewRequest } from "../../src/domain/review-request";
import { type ReviewResult, ReviewResultSchema } from "../../src/domain/review-result";
import { ReviewService } from "../../src/reviews/review-service";
import { registerMessageListener } from "../../src/slack/message-listener";
import type { SlackMessage } from "../../src/slack/message-listener";
import { ReviewThreadStore } from "../../src/slack/review-thread-store";
import type { AppConfig } from "../../src/config/env";
import { buildGeminiParts } from "../../src/ai/gemini-provider";

const logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
} as never;

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

class FakeSlackApp {
  handlers = new Map<string, (...args: unknown[]) => unknown>();
  event(name: string, handler: (...args: unknown[]) => unknown) {
    this.handlers.set(name, handler);
  }
}

class FakeSlackClient {
  readonly posts: { text?: string }[] = [];
  readonly _reactions: { name?: string }[] = [];
  chat = {
    postMessage: async (args: { text?: string }) => { this.posts.push(args); },
  };
  reactions = {
    add: async (args: { name?: string }) => { this._reactions.push(args); },
  };
}

describe("Slack booking scenarios (Listener Flow)", () => {
  const config: AppConfig = {
    logLevel: "silent",
    slackBotToken: "xoxb-fake",
    slackAppToken: "xapp-fake",
    geminiApiKey: "fake-key",
    geminiModel: "fake-model",
    allowedChannelIds: new Set(["C1"]),
    dedupeTtlMs: 60000,
    maxConcurrentReviews: 2,
    maxQueuedReviews: 10,
    maxAttachments: 10,
    maxImageBytes: 1024 * 1024,
    downloadTimeoutMs: 1000,
    aiTimeoutMs: 1000,
    lowConfidenceThreshold: 0.8,
    maxActiveReviews: 10,
    adminUserIds: new Set<string>(),
    activeReviewTtlMs: 60000,
    rulesFilePath: "data/custom-rules.json",
  };

  test("approved matching package flows through listener", async () => {
    const provider = new ScenarioProvider(() => result());
    const service = new ReviewService(provider, config.lowConfidenceThreshold, logger);
    const store = new ReviewThreadStore(10, 60000);
    const app = new FakeSlackApp();
    registerMessageListener(app as any, config, service, logger, store);

    const client = new FakeSlackClient();
    const handler = app.handlers.get("message") as any;

    // removed
    spyOn(global, "fetch").mockImplementation((async () => new Response(new Uint8Array([1]), { status: 200 })) as unknown as typeof fetch);

    try {
      const message: SlackMessage = {
        type: "message",
        channel: "C1",
        ts: "1",
        text: "g2g?",
        files: [
          { id: "crm", mimetype: "image/png", size: 10, url_private_download: "https://fake/crm" },
          { id: "campaign", mimetype: "image/png", size: 10, url_private_download: "https://fake/campaign" },
          { id: "booking", mimetype: "image/png", size: 10, url_private_download: "https://fake/booking" }
        ],
      };

      await handler({ event: message, body: { event_id: "Ev1" }, client });

      expect(provider.requests.length).toBe(1);
      expect(provider.requests[0]?.images.map(i => i.id)).toEqual(["original:crm", "original:campaign", "original:booking"]);

      expect(client.posts.length).toBe(1);
      expect(client.posts[0]?.text).toContain("All good! 🎉 Booking approved.");
      expect(client._reactions.map(r => r.name)).toContain("white_check_mark");
      expect(store.has("C1", "1")).toBe(false);

      const req0 = provider.requests[0];
      expect(req0).toBeDefined();
      const geminiParts = buildGeminiParts(req0 as any);
      expect(geminiParts[0]).toEqual({ text: expect.stringContaining("original:crm [original], original:campaign [original], original:booking [original]") });
      expect(geminiParts[1]).toEqual({ text: expect.stringContaining("Image original:crm [original]") });

    } finally {
      spyOn(global, "fetch").mockRestore();
    }
  });

  test("corrected-thread with replacement screenshot flows from root -> correction -> approved", async () => {
    const provider = new ScenarioProvider((request) => request.images.some(img => img.id.startsWith("correction")) ? result() : result({
      status: "correction_required",
      missingNoteEntries: ["Annual sales: 12"],
    }));

    const service = new ReviewService(provider, config.lowConfidenceThreshold, logger);
    const store = new ReviewThreadStore(10, 60000);
    const app = new FakeSlackApp();
    registerMessageListener(app as any, config, service, logger, store);

    const client = new FakeSlackClient();
    const handler = app.handlers.get("message") as any;
    // removed
    spyOn(global, "fetch").mockImplementation((async () => new Response(new Uint8Array([1]), { status: 200 })) as unknown as typeof fetch);

    try {
      const rootMsg: SlackMessage = {
        type: "message", channel: "C1", ts: "1", text: "g2g?",
        files: [
          { id: "crm", mimetype: "image/png", size: 10, url_private_download: "https://fake/crm" },
          { id: "campaign", mimetype: "image/png", size: 10, url_private_download: "https://fake/campaign" },
          { id: "booking", mimetype: "image/png", size: 10, url_private_download: "https://fake/booking" }
        ],
      };
      await handler({ event: rootMsg, body: { event_id: "Ev1" }, client });

      expect(client.posts.length).toBe(1);
      expect(client.posts[0]?.text).toContain("Annual sales: 12");
      expect(client.posts[0]?.text).toContain("reply to this thread");
      expect(store.has("C1", "1")).toBe(true);

      const correctionMsg: SlackMessage = {
        type: "message", channel: "C1", ts: "2", thread_ts: "1", text: "Annual sales: 12",
        files: [
          { id: "notes-fixed", mimetype: "image/png", size: 10, url_private_download: "https://fake/notes-fixed" }
        ],
      };
      await handler({ event: correctionMsg, body: { event_id: "Ev2" }, client });

      expect(provider.requests.length).toBe(2);
      expect(provider.requests[1]?.images.map(i => i.id)).toEqual(["original:crm", "original:campaign", "original:booking", "correction:notes-fixed"]);
      expect(provider.requests[1]?.messageText).toContain("Correction (authoritative where conflicting): Annual sales: 12");

      expect(client.posts.length).toBe(2);
      expect(client.posts[1]?.text).toContain("All good! 🎉 Booking approved.");
      expect(store.has("C1", "1")).toBe(false);

      const req1 = provider.requests[1];
      expect(req1).toBeDefined();
      const geminiParts = buildGeminiParts(req1 as any);
      expect(geminiParts[0]).toEqual({ text: expect.stringContaining("original:crm [original], original:campaign [original], original:booking [original], correction:notes-fixed [correction]") });

    } finally {
      spyOn(global, "fetch").mockRestore();
    }
  });

  test("minimum-sales failure is rejected", async () => {
    const provider = new ScenarioProvider(() => result({
      status: "rejected",
      reasoning: "Authoritative CRM sales are below the campaign minimum.",
      failedRequirements: ["Minimum sales: requires 10, CRM shows 7"],
    }));

    const service = new ReviewService(provider, config.lowConfidenceThreshold, logger);
    const store = new ReviewThreadStore(10, 60000);
    const app = new FakeSlackApp();
    registerMessageListener(app as any, config, service, logger, store);

    const client = new FakeSlackClient();
    const handler = app.handlers.get("message") as any;
    // removed
    spyOn(global, "fetch").mockImplementation((async () => new Response(new Uint8Array([1]), { status: 200 })) as unknown as typeof fetch);

    try {
      const msg: SlackMessage = {
        type: "message", channel: "C1", ts: "1", text: "g2g?",
        files: [
          { id: "crm", mimetype: "image/png", size: 10, url_private_download: "https://fake/crm" },
          { id: "campaign", mimetype: "image/png", size: 10, url_private_download: "https://fake/campaign" },
          { id: "booking", mimetype: "image/png", size: 10, url_private_download: "https://fake/booking" }
        ],
      };
      await handler({ event: msg, body: { event_id: "Ev1" }, client });

      expect(client.posts.length).toBe(1);
      expect(client.posts[0]?.text).toContain("Minimum sales: requires 10, CRM shows 7");
      expect(client._reactions.map(r => r.name)).toContain("x");
      expect(store.has("C1", "1")).toBe(false);
    } finally {
      spyOn(global, "fetch").mockRestore();
    }
  });

  test("ambiguous evidence requests human review with <!here>", async () => {
    const provider = new ScenarioProvider(() => result({ status: "needs_human_review", reasoning: "The sales value is unreadable in the CRM screenshot.", confidence: 0.45, evidenceRoles: [{ imageId: "original:crm", roles: ["crm_prospect"], readable: false }] }));
    const service = new ReviewService(provider, config.lowConfidenceThreshold, logger);
    const store = new ReviewThreadStore(10, 60000);
    const app = new FakeSlackApp();
    registerMessageListener(app as any, config, service, logger, store);

    const client = new FakeSlackClient();
    const handler = app.handlers.get("message") as any;
    // removed
    spyOn(global, "fetch").mockImplementation((async () => new Response(new Uint8Array([1]), { status: 200 })) as unknown as typeof fetch);

    try {
      const msg: SlackMessage = {
        type: "message", channel: "C1", ts: "1", text: "g2g?",
        files: [
          { id: "crm", mimetype: "image/png", size: 10, url_private_download: "https://fake/crm" },
          { id: "campaign", mimetype: "image/png", size: 10, url_private_download: "https://fake/campaign" },
          { id: "booking", mimetype: "image/png", size: 10, url_private_download: "https://fake/booking" }
        ],
      };
      await handler({ event: msg, body: { event_id: "Ev1" }, client });

      expect(client.posts.length).toBe(1);
      expect(client.posts[0]?.text).toStartWith("<!here>");
      expect(client._reactions.map(r => r.name)).toContain("warning");
    } finally {
      spyOn(global, "fetch").mockRestore();
    }
  });

  test("fewer than 3 screenshots returns correction_required without calling AI", async () => {
    const provider = new ScenarioProvider(() => result()); // Should not be called
    const service = new ReviewService(provider, config.lowConfidenceThreshold, logger);
    const store = new ReviewThreadStore(10, 60000);
    const app = new FakeSlackApp();
    registerMessageListener(app as any, config, service, logger, store);

    const client = new FakeSlackClient();
    const handler = app.handlers.get("message") as any;
    spyOn(global, "fetch").mockImplementation((async () => new Response(new Uint8Array([1]), { status: 200 })) as unknown as typeof fetch);

    try {
      const msg: SlackMessage = {
        type: "message", channel: "C1", ts: "1", text: "g2g?",
        files: [
          { id: "crm", mimetype: "image/png", size: 10, url_private_download: "https://fake/crm" },
          { id: "campaign", mimetype: "image/png", size: 10, url_private_download: "https://fake/campaign" }
        ], // Only 2 images
      };
      await handler({ event: msg, body: { event_id: "Ev1" }, client });

      expect(provider.requests.length).toBe(0);
      expect(client.posts.length).toBe(1);
      expect(client.posts[0]?.text).toContain("Please send all screenshots (minimum 3 required).");
    } finally {
      spyOn(global, "fetch").mockRestore();
    }
  });
});
