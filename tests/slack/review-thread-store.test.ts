import { expect, test } from "bun:test";
import { ReviewThreadStore } from "../../src/slack/review-thread-store";

const image = (id: string) => ({ id, name: `${id}.png`, mimeType: "image/png" as const, data: new Uint8Array([1]), source: "original" as const });

test("retains original and accumulates corrections", () => {
  let now = 100;
  const store = new ReviewThreadStore(2, 1_000, () => now);
  store.create({ channel: "C1", rootTs: "1", originalText: "root", originalImages: [image("original:o1")], lastEventId: "E1" });
  store.applyCorrection("C1", "1", { text: "first", images: [{ ...image("correction:c1"), source: "correction" }], eventId: "E2" });
  store.applyCorrection("C1", "1", { text: "latest", images: [{ ...image("correction:c2"), source: "correction" }], eventId: "E3" });
  expect(store.get("C1", "1")?.evidence.images.map((item) => item.id)).toEqual(["original:o1", "correction:c1", "correction:c2"]);
  expect(store.get("C1", "1")?.evidence.messageText).toContain("latest");
  expect(store.get("C1", "1")?.evidence.messageText).toContain("first");
  expect(store.get("C1", "1")?.lastEventId).toBe("E3");

  now = 1_101;
  expect(store.has("C1", "1")).toBe(false);
});

test("keys by channel and root and evicts oldest at capacity", () => {
  let now = 1;
  const store = new ReviewThreadStore(1, 1_000, () => now);
  store.create({ channel: "C1", rootTs: "same", originalText: "", originalImages: [image("original:1")], lastEventId: "1" });
  now++;
  store.create({ channel: "C2", rootTs: "same", originalText: "", originalImages: [image("original:2")], lastEventId: "2" });
  expect(store.has("C1", "same")).toBe(false);
  expect(store.has("C2", "same")).toBe(true);
  store.close("C2", "same");
  expect(store.has("C2", "same")).toBe(false);
});
