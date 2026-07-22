import { expect, test } from "bun:test";
import { downloadSlackImage, selectImageFiles } from "../../src/slack/files";

const secretName = "guest-ada-private.png";
const oversized = { id: "F-secret", name: secretName, mimetype: "image/png", size: 10, url_private_download: "https://example.test/private" };

test("file validation errors do not expose filenames or evidence identifiers", async () => {
  expect(() => selectImageFiles([oversized], 1, 1)).toThrow("Image exceeds the size limit");
  try {
    selectImageFiles([oversized], 1, 1);
  } catch (error) {
    expect(String(error)).not.toContain(secretName);
    expect(String(error)).not.toContain("F-secret");
  }

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(new Uint8Array([1, 2]), { status: 200 })) as unknown as typeof fetch;
  try {
    const { size: _size, ...withoutSize } = oversized;
    await expect(downloadSlackImage(withoutSize, "token", 1, 1_000)).rejects.toThrow("Image exceeds the size limit");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
