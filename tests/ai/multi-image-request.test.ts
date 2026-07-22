import { expect, test } from "bun:test";
import { buildGeminiParts } from "../../src/ai/gemini-provider";

const image = (id: string, source: "original" | "correction") => ({ id, name: `${id}.png`, mimeType: "image/png" as const, data: new Uint8Array([1]), source });
test("labels and orders original then correction evidence in one package", () => {
  const parts = buildGeminiParts({ eventId: "E", messageText: "test booking", images: [image("o1", "original"), image("o2", "original"), image("c1", "correction")] });
  expect(parts[0]).toEqual({ text: expect.stringContaining("caption/context only") });
  expect(parts.filter((part) => "text" in part).map((part) => "text" in part ? part.text : "").join(" ")).toContain("o1 [original]");
  expect(parts.filter((part) => "text" in part).map((part) => "text" in part ? part.text : "").join(" ")).toContain("c1 [correction]");
  expect(parts.filter((part) => "inlineData" in part)).toHaveLength(3);
});
