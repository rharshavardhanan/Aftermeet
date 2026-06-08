import { GoogleGenerativeAI } from "@google/generative-ai";

let client: GoogleGenerativeAI | null = null;

/** Lazily-constructed Gemini client. Throws if the key is missing. */
export function gemini() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  client ??= new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client;
}

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}
