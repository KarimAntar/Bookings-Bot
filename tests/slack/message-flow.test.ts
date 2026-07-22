import { expect, test } from "bun:test";
import { classifyMessage } from "../../src/slack/message-listener";

const file = { id: "F1", mimetype: "image/png", size: 1, url_private_download: "https://example.test" };
test("reviews every top-level image regardless of caption", () => {
  for (const text of ["test", "g2g?", "@here"]) expect(classifyMessage({ type: "message", channel: "C", ts: text, text, files: [file] }, false)).toBe("root");
});
test("accepts text or image replies only for active roots", () => {
  expect(classifyMessage({ type: "message", channel: "C", ts: "2", thread_ts: "1", text: "Sales are 12" }, true)).toBe("correction");
  expect(classifyMessage({ type: "message", channel: "C", ts: "3", thread_ts: "1", files: [file] }, true)).toBe("correction");
  expect(classifyMessage({ type: "message", channel: "C", ts: "4", thread_ts: "unknown", files: [file] }, false)).toBe("ignore");
});
test("ignores edits deletions and bots", () => {
  for (const subtype of ["message_changed", "message_deleted"]) expect(classifyMessage({ type: "message", subtype, channel: "C", ts: subtype, files: [file] }, false)).toBe("ignore");
  expect(classifyMessage({ type: "message", channel: "C", ts: "5", bot_id: "B", files: [file] }, false)).toBe("ignore");
});
