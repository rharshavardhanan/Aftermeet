/** Retry an async op with exponential backoff. Ported from the monolith. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 2, baseDelayMs = 600 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastErr;
}
