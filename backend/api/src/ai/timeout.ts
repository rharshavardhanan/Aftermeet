// Race a promise against a timeout. The Gemini SDK has no per-call timeout, so
// a hung request would otherwise hang the whole HTTP handler.
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

// Ceilings (ms): long enough for real audio, short enough to fail over.
export const AI_TIMEOUT_MS = 60_000;
export const TRANSCRIBE_TIMEOUT_MS = 120_000;
