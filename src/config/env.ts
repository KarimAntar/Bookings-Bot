import { z } from "zod";

const LogLevelSchema = z.enum([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
]);

const integer = (minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum);

const EnvSchema = z.object({
  SLACK_BOT_TOKEN: z.string().trim().startsWith("xoxb-").min(10),
  SLACK_APP_TOKEN: z.string().trim().startsWith("xapp-").min(10),
  GEMINI_API_KEY: z.string().trim().min(10),
  GEMINI_MODEL: z.string().trim().min(1).default("gemini-3.5-flash-lite"),
  ALLOWED_CHANNEL_IDS: z.string().default(""),
  MAX_IMAGE_BYTES: integer(1, 25 * 1024 * 1024).default(8_388_608),
  MAX_ATTACHMENTS: integer(1, 20).default(10),
  DOWNLOAD_TIMEOUT_MS: integer(1_000, 300_000).default(15_000),
  AI_TIMEOUT_MS: integer(1_000, 300_000).default(45_000),
  MAX_CONCURRENT_REVIEWS: integer(1, 100).default(2),
  MAX_QUEUED_REVIEWS: integer(0, 10_000).default(20),
  DEDUPE_TTL_MS: integer(1_000, 86_400_000).default(600_000),
  MAX_ACTIVE_REVIEWS: integer(1, 10_000).default(500),
  ACTIVE_REVIEW_TTL_MS: integer(1_000, 604_800_000).default(86_400_000),
  LOW_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  LOG_LEVEL: LogLevelSchema.default("info"),
  ADMIN_USER_IDS: z.string().default(""),
  RULES_FILE_PATH: z.string().default("data/custom-rules.json"),
});

export interface AppConfig {
  readonly slackBotToken: string;
  readonly slackAppToken: string;
  readonly geminiApiKey: string;
  readonly geminiModel: string;
  readonly allowedChannelIds: ReadonlySet<string>;
  readonly maxImageBytes: number;
  readonly maxAttachments: number;
  readonly downloadTimeoutMs: number;
  readonly aiTimeoutMs: number;
  readonly maxConcurrentReviews: number;
  readonly maxQueuedReviews: number;
  readonly dedupeTtlMs: number;
  readonly maxActiveReviews: number;
  readonly activeReviewTtlMs: number;
  readonly lowConfidenceThreshold: number;
  readonly logLevel: z.infer<typeof LogLevelSchema>;
  readonly adminUserIds: ReadonlySet<string>;
  readonly rulesFilePath: string;
}

export function parseEnv(env: Record<string, string | undefined>): AppConfig {
  const parsed = EnvSchema.parse(env);

  return {
    slackBotToken: parsed.SLACK_BOT_TOKEN,
    slackAppToken: parsed.SLACK_APP_TOKEN,
    geminiApiKey: parsed.GEMINI_API_KEY,
    geminiModel: parsed.GEMINI_MODEL,
    allowedChannelIds: new Set(
      parsed.ALLOWED_CHANNEL_IDS.split(",")
        .map((channelId) => channelId.trim())
        .filter(Boolean),
    ),
    maxImageBytes: parsed.MAX_IMAGE_BYTES,
    maxAttachments: parsed.MAX_ATTACHMENTS,
    downloadTimeoutMs: parsed.DOWNLOAD_TIMEOUT_MS,
    aiTimeoutMs: parsed.AI_TIMEOUT_MS,
    maxConcurrentReviews: parsed.MAX_CONCURRENT_REVIEWS,
    maxQueuedReviews: parsed.MAX_QUEUED_REVIEWS,
    dedupeTtlMs: parsed.DEDUPE_TTL_MS,
    maxActiveReviews: parsed.MAX_ACTIVE_REVIEWS,
    activeReviewTtlMs: parsed.ACTIVE_REVIEW_TTL_MS,
    lowConfidenceThreshold: parsed.LOW_CONFIDENCE_THRESHOLD,
    logLevel: parsed.LOG_LEVEL,
    adminUserIds: new Set(
      parsed.ADMIN_USER_IDS.split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
    rulesFilePath: parsed.RULES_FILE_PATH,
  };
}
