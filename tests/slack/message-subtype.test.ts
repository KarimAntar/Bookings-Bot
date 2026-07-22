import { describe, expect, test } from "bun:test";
import { isReviewableMessage } from "../../src/slack/message-listener";

const image = {
  id: "F1",
  mimetype: "image/png",
  size: 1024,
  url_private_download: "https://files.slack.test/F1",
};

describe("isReviewableMessage", () => {
  test("accepts ordinary and file_share image messages", () => {
    expect(isReviewableMessage({ type: "message", channel: "C1", ts: "1", files: [image] })).toBe(true);
    expect(isReviewableMessage({
      type: "message",
      subtype: "file_share",
      channel: "C1",
      ts: "2",
      files: [image],
    })).toBe(true);
  });

  test("ignores edits, deletions, bots, and messages without files", () => {
    expect(isReviewableMessage({
      type: "message",
      subtype: "message_changed",
      channel: "C1",
      ts: "3",
      files: [image],
    })).toBe(false);
    expect(isReviewableMessage({
      type: "message",
      subtype: "message_deleted",
      channel: "C1",
      ts: "4",
      files: [image],
    })).toBe(false);
    expect(isReviewableMessage({
      type: "message",
      channel: "C1",
      ts: "5",
      bot_id: "B1",
      files: [image],
    })).toBe(false);
    expect(isReviewableMessage({ type: "message", channel: "C1", ts: "6" })).toBe(false);
  });
});
