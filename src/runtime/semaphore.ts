export class QueueFullError extends Error {
  constructor() {
    super("Review queue is full");
    this.name = "QueueFullError";
  }
}

type Waiter = { resolve: (release: () => void) => void };

export class BoundedSemaphore {
  private active = 0;
  private readonly waiters: Waiter[] = [];

  constructor(
    private readonly concurrency: number,
    private readonly maxQueued: number,
  ) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private acquire(): Promise<() => void> {
    if (this.active < this.concurrency) {
      this.active += 1;
      return Promise.resolve(this.createRelease());
    }
    if (this.waiters.length >= this.maxQueued) {
      return Promise.reject(new QueueFullError());
    }
    return new Promise((resolve) => this.waiters.push({ resolve }));
  }

  private createRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiters.shift();
      if (next) next.resolve(this.createRelease());
      else this.active -= 1;
    };
  }
}
