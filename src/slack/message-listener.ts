import type { App, Logger } from "@slack/bolt";
import type { AppConfig } from "../config/env";
import { humanReviewFallback, type ReviewResult } from "../domain/review-result";
import { DedupeCache } from "../runtime/dedupe-cache";
import { BoundedSemaphore } from "../runtime/semaphore";
import type { ReviewService } from "../reviews/review-service";
import { downloadSlackImage, selectImageFiles, type SlackFile } from "./files";
import { formatReviewResult, terminalReaction } from "./format";
import { ReviewThreadStore } from "./review-thread-store";

export interface SlackMessage { type: "message"; subtype?: string; channel: string; ts: string; thread_ts?: string; text?: string; bot_id?: string; files?: SlackFile[] }
export type MessageKind = "root" | "correction" | "ignore";
export function classifyMessage(message: SlackMessage, activeThread: boolean): MessageKind {
  if (message.bot_id || (message.subtype !== undefined && message.subtype !== "file_share")) return "ignore";
  if (message.thread_ts) return activeThread && (message.text?.trim() || message.files?.length) ? "correction" : "ignore";
  return message.files?.length ? "root" : "ignore";
}
export function isReviewableMessage(message: SlackMessage): boolean { return classifyMessage(message, false) === "root"; }

export function registerMessageListener(app: App, config: AppConfig, reviewService: ReviewService, logger: Logger, store = new ReviewThreadStore(config.maxActiveReviews, config.activeReviewTtlMs)): void {
  const dedupe = new DedupeCache(config.dedupeTtlMs);
  const queue = new BoundedSemaphore(config.maxConcurrentReviews, config.maxQueuedReviews);
  app.event("message", async ({ event, body, client }) => {
    const message = event as SlackMessage;
    if (config.allowedChannelIds.size && !config.allowedChannelIds.has(message.channel)) return;
    const rootTs = message.thread_ts ?? message.ts;
    const kind = classifyMessage(message, Boolean(message.thread_ts && store.has(message.channel, rootTs)));
    if (kind === "ignore") return;
    const eventId = "event_id" in body && typeof body.event_id === "string" ? body.event_id : `${message.channel}:${message.ts}`;
    if (!dedupe.addIfNew(eventId)) return;
    const reaction = async (name: string) => { try { await client.reactions.add({ channel: message.channel, timestamp: message.ts, name }); } catch (error) { logger.debug({ err: error, eventId, reaction: name }, "Slack reaction unavailable"); } };
    try {
      await queue.run(async () => {
        await reaction("hourglass_flowing_sand");
        let result: ReviewResult;
        try {
          const files = selectImageFiles(message.files ?? [], config.maxAttachments, config.maxImageBytes);
          const downloaded = await Promise.all(files.map((file) => downloadSlackImage(file, config.slackBotToken, config.maxImageBytes, config.downloadTimeoutMs)));
          const source = kind === "root" ? "original" as const : "correction" as const;
          const images = downloaded.map((image) => ({ ...image, id: `${source}:${image.id}`, source }));
          const session = kind === "root"
            ? store.create({ channel: message.channel, rootTs, originalText: message.text ?? "", originalImages: images, lastEventId: eventId })
            : store.applyCorrection(message.channel, rootTs, { text: message.text ?? "", images, eventId });
          if (!session) return;
          result = await reviewService.review({ eventId, messageText: session.evidence.messageText, images: session.evidence.images });
        } catch (error) {
          if (kind === "root") store.close(message.channel, rootTs);
          logger.error({ err: error, eventId, channel: message.channel, rootTs, kind }, "Slack submission processing failed");
          result = humanReviewFallback("submission_processing_failed");
        }
        await client.chat.postMessage({ channel: message.channel, thread_ts: rootTs, text: formatReviewResult(result) });
        await reaction(terminalReaction[result.status]);
        if (result.status === "approved" || result.status === "rejected") store.close(message.channel, rootTs);
      });
    } catch (error) {
      logger.warn({ err: error, eventId, channel: message.channel, rootTs }, "Review queue rejected submission");
      const fallback = humanReviewFallback("review_queue_unavailable");
      await client.chat.postMessage({ channel: message.channel, thread_ts: rootTs, text: formatReviewResult(fallback) });
      await reaction(terminalReaction.needs_human_review);
    }
  });
}
