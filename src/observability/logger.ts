import pino from "pino";

const redactPaths = [
  "token",
  "*.token",
  "authorization",
  "*.authorization",
  "headers.authorization",
  "req.headers.authorization",
  "slackBotToken",
  "slackAppToken",
  "geminiApiKey",
  "image",
  "*.image",
  "images",
  "*.images",
  "data",
  "*.data",
];

export function createLogger(level = "info"): pino.Logger {
  return pino({
    level,
    base: { service: "bookings-bot" },
    redact: { paths: redactPaths, censor: "[REDACTED]" },
  });
}

export const logger = createLogger(process.env.LOG_LEVEL);
