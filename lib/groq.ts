import OpenAI from "openai";

/**
 * Groq — free, fast inference with an OpenAI-compatible API. We use it for:
 *  - Speech-to-text (Whisper large-v3-turbo), and
 *  - As an automatic fallback LLM for extraction when Gemini's quota fails.
 * Because the API is OpenAI-compatible we reuse the OpenAI SDK with a baseURL.
 */
let client: OpenAI | null = null;

export function groq() {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");
  client ??= new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
  return client;
}

export const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
export const GROQ_STT_MODEL = process.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo";

export function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

/** True if an error looks like a quota / rate-limit exhaustion (for fallback). */
export function isQuotaError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /429|quota|rate.?limit|RESOURCE_EXHAUSTED|exhausted/i.test(msg);
}
