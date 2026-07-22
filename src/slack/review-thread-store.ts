import type { ReviewImage } from "../domain/review-request";

interface CreateSession { channel: string; rootTs: string; originalText: string; originalImages: readonly ReviewImage[]; lastEventId: string }
interface Correction { text: string; images: readonly ReviewImage[]; eventId: string }
interface StoredSession extends CreateSession { latestCorrection?: Correction; expiresAt: number; updatedAt: number }
export interface ActiveReview { channel: string; rootTs: string; lastEventId: string; evidence: { messageText: string; images: readonly ReviewImage[] } }

function validateImages(images: readonly ReviewImage[], source: ReviewImage["source"]): void {
  const ids = new Set<string>();
  for (const image of images) {
    if (image.source !== source || !image.id.startsWith(`${source}:`) || ids.has(image.id)) throw new Error(`Invalid or duplicate ${source} image ID`);
    ids.add(image.id);
  }
}

export class ReviewThreadStore {
  private readonly sessions = new Map<string, StoredSession>();
  constructor(private readonly capacity: number, private readonly ttlMs: number, private readonly now: () => number = Date.now) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError("capacity must be a positive integer");
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new RangeError("ttlMs must be positive");
  }
  private key(channel: string, rootTs: string): string { return `${channel}\0${rootTs}`; }
  prune(): void { const now = this.now(); for (const [key, value] of this.sessions) if (value.expiresAt <= now) this.sessions.delete(key); }
  create(input: CreateSession): ActiveReview {
    this.prune(); const key = this.key(input.channel, input.rootTs);
    if (this.sessions.has(key)) throw new Error("Review session already exists");
    validateImages(input.originalImages, "original");
    if (this.sessions.size >= this.capacity) {
      const oldest = [...this.sessions.entries()].sort(([ka, a], [kb, b]) => a.updatedAt - b.updatedAt || ka.localeCompare(kb))[0];
      if (oldest) this.sessions.delete(oldest[0]);
    }
    const now = this.now(); this.sessions.set(key, { ...input, expiresAt: now + this.ttlMs, updatedAt: now });
    const created = this.get(input.channel, input.rootTs);
    if (!created) throw new Error("Active review session could not be created");
    return created;
  }
  get(channel: string, rootTs: string): ActiveReview | undefined {
    this.prune(); const stored = this.sessions.get(this.key(channel, rootTs)); if (!stored) return undefined;
    const correctionText = stored.latestCorrection?.text.trim();
    return { channel, rootTs, lastEventId: stored.lastEventId, evidence: { messageText: [stored.originalText, correctionText ? `Correction (authoritative where conflicting): ${correctionText}` : ""].filter(Boolean).join("\n"), images: [...stored.originalImages, ...(stored.latestCorrection?.images ?? [])] } };
  }
  has(channel: string, rootTs: string): boolean { return this.get(channel, rootTs) !== undefined; }
  applyCorrection(channel: string, rootTs: string, correction: Correction): ActiveReview | undefined {
    this.prune(); const key = this.key(channel, rootTs); const stored = this.sessions.get(key); if (!stored) return undefined;
    validateImages(correction.images, "correction");
    const originalIds = new Set(stored.originalImages.map((image) => image.id));
    if (correction.images.some((image) => originalIds.has(image.id))) throw new Error("Correction image IDs must be unique");
    const now = this.now(); stored.latestCorrection = correction; stored.lastEventId = correction.eventId; stored.expiresAt = now + this.ttlMs; stored.updatedAt = now;
    return this.get(channel, rootTs);
  }
  close(channel: string, rootTs: string): void { this.sessions.delete(this.key(channel, rootTs)); }
}
