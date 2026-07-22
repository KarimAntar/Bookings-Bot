import type { ReviewImage } from "../domain/review-request";
import { withTimeout } from "../runtime/retry";

export interface SlackFile {
  readonly id?: string;
  readonly name?: string;
  readonly mimetype?: string;
  readonly size?: number;
  readonly url_private_download?: string;
  readonly url_private?: string;
}

const supportedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export function selectImageFiles(
  files: readonly SlackFile[],
  maxCount: number,
  maxBytes: number,
): SlackFile[] {
  if (files.length > maxCount) throw new Error(`At most ${maxCount} files are allowed`);
  return files.map((file) => {
    if (!file.id || !file.mimetype || !supportedTypes.has(file.mimetype)) {
      throw new Error("Only PNG, JPEG, and WebP images are supported");
    }
    if (typeof file.size === "number" && file.size > maxBytes) {
      throw new Error(`Image ${file.name ?? file.id} exceeds the size limit`);
    }
    if (!(file.url_private_download ?? file.url_private)) {
      throw new Error("Slack image download URL is missing");
    }
    return file;
  });
}

export async function downloadSlackImage(
  file: SlackFile,
  token: string,
  maxBytes: number,
  timeoutMs: number,
): Promise<ReviewImage> {
  const url = file.url_private_download ?? file.url_private;
  if (!url || !file.id || !file.mimetype || !supportedTypes.has(file.mimetype)) {
    throw new Error("Invalid Slack image metadata");
  }
  const data = await withTimeout(async (signal) => {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal });
    if (!response.ok || !response.body) throw new Error(`Slack download failed with ${response.status}`);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`Image ${file.name ?? file.id} exceeds the size limit`);
      }
      chunks.push(value);
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  }, timeoutMs);
  return {
    id: file.id,
    name: file.name ?? file.id,
    mimeType: file.mimetype as ReviewImage["mimeType"],
    data,
  };
}
