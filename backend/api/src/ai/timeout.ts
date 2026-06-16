/**
 * Race a promise against a timeout. The Gemini SDK has no per-call timeout, so
 * a hung request would otherwise hang the whole HTTP handler. On timeout this
 * rejects with a clear, retry-friendly error (callers already retry/fallback).
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'operation',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

// Default ceilings (ms). Generous enough for long transcripts/audio, short
// enough to fail fast and let the fallback chain take over.
export const AI_TIMEOUT_MS = 60_000;
export const TRANSCRIBE_TIMEOUT_MS = 120_000;
