import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// AI provider clients + capability flags. Ported from the monolith's lib/openai,
// lib/groq, lib/gemini. Lazily constructed so the app boots without keys.

let openaiClient: OpenAI | null = null;
export function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  openaiClient ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 60_000,
    maxRetries: 2,
  });
  return openaiClient;
}
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-2024-11-20';
export const OPENAI_TRANSCRIBE_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL ?? 'whisper-1';

let groqClient: OpenAI | null = null;
export function groq(): OpenAI {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');
  groqClient ??= new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
    timeout: 120_000,
    maxRetries: 2,
  });
  return groqClient;
}
export const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
export const GROQ_STT_MODEL = process.env.GROQ_STT_MODEL ?? 'whisper-large-v3-turbo';
export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

let geminiClient: GoogleGenerativeAI | null = null;
export function gemini(): GoogleGenerativeAI {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  geminiClient ??= new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return geminiClient;
}
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** True if ANY supported AI provider is configured. Else demo mode. */
export function isAiConfigured(): boolean {
  return Boolean(
    process.env.GROQ_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.OPENAI_API_KEY,
  );
}

/** True if an error looks like a quota / rate-limit exhaustion (for fallback). */
export function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /429|quota|rate.?limit|RESOURCE_EXHAUSTED|exhausted/i.test(msg);
}
