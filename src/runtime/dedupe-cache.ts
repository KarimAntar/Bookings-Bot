export class DedupeCache {
  private readonly entries = new Map<string, number>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 10_000,
  ) {}

  addIfNew(key: string, now = Date.now()): boolean {
    this.prune(now);
    if (this.entries.has(key)) return false;
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    this.entries.set(key, now + this.ttlMs);
    return true;
  }

  private prune(now: number): void {
    for (const [key, expiresAt] of this.entries) {
      if (expiresAt > now) break;
      this.entries.delete(key);
    }
  }
}
