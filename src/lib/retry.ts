import { logError } from "@/lib/log";

export class CamuTransientError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "CamuTransientError";
  }
}

export class CamuAuthError extends Error {
  constructor(message = "Camu rejected the session") {
    super(message);
    this.name = "CamuAuthError";
  }
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 4000;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const transient =
        error instanceof CamuTransientError ||
        (error instanceof Error && error.name === "AbortError") ||
        (error instanceof TypeError &&
          /fetch|network/i.test(error.message));
      if (!transient || attempt === attempts) break;
      const delayMs = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await sleep(delayMs);
    }
  }
  if (lastError instanceof CamuTransientError && lastError.status) {
    logError("camu.request.failed", lastError, { status: lastError.status });
  } else if (lastError instanceof Error) {
    logError("camu.request.failed", lastError);
  }
  throw lastError;
}
