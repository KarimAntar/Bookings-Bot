import type { App, Logger } from "@slack/bolt";
import type { AppConfig } from "../config/env";
import { humanReviewFallback, type ReviewResult } from "../domain/review-result";
import { DedupeCache } from "../runtime/dedupe-cache";
import { BoundedSemaphore } from "../runtime/semaphore";
import type { ReviewService } from "../reviews/review-service";
import { downloadSlackImage, selectImageFiles, type SlackFile } from "./files";
import { formatReviewResult, terminalReaction } from "./format";

interface SlackMessage {
  type: "message";
  subtype?: string;
  channel: string;
  ts: string;
  thread_ts?: string;
  text?: string;
  bot_id?: string;
  files?: SlackFile[];
}

export function isReviewableMessage(message: SlackMessage): boolean {
  if (message.bot_id || !message.files?.length) return false;
  return message.subtype === undefined || message.subtype === "file_share";
}

export function registerMessageListener(
  app: App,
  config: AppConfig,
  reviewService: ReviewService,
  logger: Logger,
): void {
  const dedupe = new DedupeCache(config.dedupeTtlMs);
  const queue = new BoundedSemaphore(config.maxConcurrentReviews, config.maxQueuedReviews);

  app.event("message", async ({ event, body, client }) => {
    const message = event as SlackMessage;
    if (!isReviewableMessage(message)) return;
    if (config.allowedChannelIds.size && !config.allowedChannelIds.has(message.channel)) return;
    const eventId = "event_id" in body && typeof body.event_id === "string"
      ? body.event_id
      : `${message.channel}:${message.ts}`;
    if (!dedupe.addIfNew(eventId)) return;
    const reaction = async (name: string): Promise<void> => {
      try {
        await client.reactions.add({ channel: message.channel, timestamp: message.ts, name });
      } catch (error) {
        logger.debug({ err: error, eventId, reaction: name }, "Slack reaction unavailable");
      }
    };

    try {
      await queue.run(async () => {
        await reaction("hourglass_flowing_sand");
        let result: ReviewResult;
        try {
          const files = selectImageFiles(message.files ?? [], config.maxAttachments, config.maxImageBytes);
          const images = await Promise.all(files.map((file) => downloadSlackImage(
            file,
            config.slackBotToken,
            config.maxImageBytes,
            config.downloadTimeoutMs,
          )));
          result = await reviewService.review({ eventId, messageText: message.text ?? "", images });
        } catch (error) {
          logger.error({ err: error, eventId }, "Slack submission processing failed");
          result = humanReviewFallback("submission_processing_failed");
        }
        await client.chat.postMessage({
          channel: message.channel,
          thread_ts: message.thread_ts ?? message.ts,
          text: formatReviewResult(result),
        });
        await reaction(terminalReaction[result.status]);
      });
    } catch (error) {
      logger.warn({ err: error, eventId }, "Review queue rejected submission");
      const fallback = humanReviewFallback("review_queue_unavailable");
      await client.chat.postMessage({
        channel: message.channel,
        thread_ts: message.thread_ts ?? message.ts,
        text: formatReviewResult(fallback),
      });
      await reaction(terminalReaction.needs_human_review);
    }
  });
}
