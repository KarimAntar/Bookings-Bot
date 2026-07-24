export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new TimeoutError(timeoutMs)),
    timeoutMs,
  );
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: {
    readonly maxAttempts: number;
    readonly shouldRetry: (error: unknown) => boolean;
    readonly baseDelayMs?: number;
  },
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= options.maxAttempts || !options.shouldRetry(error))
        throw error;
      const base = options.baseDelayMs ?? 500;
      const delay =
        base * 2 ** (attempt - 1) + Math.floor(Math.random() * base);
      await Bun.sleep(delay);
    }
  }
}
