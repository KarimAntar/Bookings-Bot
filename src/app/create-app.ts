import { App, LogLevel, type Logger as SlackLogger } from "@slack/bolt";
import type { AppConfig } from "../config/env";
import { GeminiProvider } from "../ai/gemini-provider";
import { createLogger } from "../observability/logger";
import { ReviewService } from "../reviews/review-service";
import { registerMessageListener } from "../slack/message-listener";

export function createApp(config: AppConfig): App {
  const logger = createLogger(config.logLevel);
  const slackLogger: SlackLogger = {
    debug: (...messages) => logger.debug({ messages }, "Slack Bolt"),
    info: (...messages) => logger.info({ messages }, "Slack Bolt"),
    warn: (...messages) => logger.warn({ messages }, "Slack Bolt"),
    error: (...messages) => logger.error({ messages }, "Slack Bolt"),
    setLevel: () => undefined,
    getLevel: () => LogLevel.INFO,
    setName: () => undefined,
  };
  const app = new App({
    token: config.slackBotToken,
    appToken: config.slackAppToken,
    socketMode: true,
    logger: slackLogger,
  });
  const provider = new GeminiProvider(config.geminiApiKey, config.geminiModel, config.aiTimeoutMs);
  const service = new ReviewService(provider, config.lowConfidenceThreshold, logger);
  registerMessageListener(app, config, service, slackLogger);
  app.error(async (error) => logger.error({ err: error }, "Unhandled Slack application error"));
  return app;
}
