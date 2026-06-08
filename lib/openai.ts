import OpenAI from "openai";

let client: OpenAI | null = null;

/** Lazily-constructed singleton so the app boots without a key in dev. */
export function openai() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-2024-11-20";
export const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1";

/**
 * True if ANY supported AI provider is configured. Gemini is preferred; OpenAI
 * is the fallback. With neither, the app runs in demo mode (local extractor).
 */
export function isAiConfigured() {
  return Boolean(
    process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
  );
}
