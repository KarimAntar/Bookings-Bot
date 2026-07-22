import { describe, expect, test } from "bun:test";
import { parseEnv } from "../../src/config/env";

const requiredEnv = {
  SLACK_BOT_TOKEN: "xoxb-valid-bot-token",
  SLACK_APP_TOKEN: "xapp-valid-app-token",
  GEMINI_API_KEY: "gemini-key-long-enough",
};

describe("parseEnv", () => {
  test("applies production-safe defaults", () => {
    const config = parseEnv(requiredEnv);

    expect(config).toEqual({
      slackBotToken: requiredEnv.SLACK_BOT_TOKEN,
      slackAppToken: requiredEnv.SLACK_APP_TOKEN,
      geminiApiKey: requiredEnv.GEMINI_API_KEY,
      geminiModel: "gemini-3.5-flash-lite",
      allowedChannelIds: new Set(),
      maxImageBytes: 8_388_608,
      maxAttachments: 4,
      downloadTimeoutMs: 15_000,
      aiTimeoutMs: 45_000,
      maxConcurrentReviews: 2,
      maxQueuedReviews: 20,
      dedupeTtlMs: 600_000,
      maxActiveReviews: 500,
      activeReviewTtlMs: 86_400_000,
      lowConfidenceThreshold: 0.8,
      logLevel: "info",
      adminUserIds: new Set(),
      rulesFilePath: "data/custom-rules.json",
    });
  });

  test("trims and parses ADMIN_USER_IDS", () => {
    const config = parseEnv({
      ...requiredEnv,
      ADMIN_USER_IDS: " U123, U456 ",
    });
    expect([...config.adminUserIds]).toEqual(["U123", "U456"]);
  });

  test("trims, removes blanks, and deduplicates the channel allowlist", () => {
    const config = parseEnv({
      ...requiredEnv,
      ALLOWED_CHANNEL_IDS: " C123, C456, C123, , ",
    });

    expect([...config.allowedChannelIds]).toEqual(["C123", "C456"]);
  });

  test("rejects a user OAuth token for the bot token", () => {
    expect(() =>
      parseEnv({ ...requiredEnv, SLACK_BOT_TOKEN: "xoxp-user-token" }),
    ).toThrow();
  });

  test("rejects impractical numeric boundaries", () => {
    expect(() => parseEnv({ ...requiredEnv, MAX_ATTACHMENTS: "0" })).toThrow();
    expect(() =>
      parseEnv({ ...requiredEnv, LOW_CONFIDENCE_THRESHOLD: "1.1" }),
    ).toThrow();
    expect(() =>
      parseEnv({ ...requiredEnv, DOWNLOAD_TIMEOUT_MS: "not-a-number" }),
    ).toThrow();
  });
});
