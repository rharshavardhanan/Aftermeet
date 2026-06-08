import "server-only";
import { openai, MODEL } from "@/lib/openai";
import { gemini, GEMINI_MODEL, isGeminiConfigured } from "@/lib/gemini";
import { groq, GROQ_MODEL, isGroqConfigured, isQuotaError } from "@/lib/groq";
import { withRetry } from "@/lib/utils";
import { extractionSchema, extractionJsonSchema, type Extraction } from "./schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

export interface ExtractInput {
  transcript: string;
  meetingDate?: string;
  knownParticipants?: string[];
  priority?: string | null;
}

export interface ExtractResult {
  data: Extraction;
  model: string;
  tokensUsed: number;
}

/**
 * Run the extraction with enforced JSON output, schema validation, and retries.
 * Throws after exhausting retries; callers translate to a friendly error.
 */
export async function extractMeeting(input: ExtractInput): Promise<ExtractResult> {
  const transcript = input.transcript?.trim() ?? "";
  if (transcript.length < 12) {
    throw new Error("Transcript is too short to analyze.");
  }
  // Guard against runaway cost; truncate very long transcripts at the tail.
  const MAX_CHARS = 48_000;
  const clipped = transcript.length > MAX_CHARS ? transcript.slice(-MAX_CHARS) : transcript;
  const userPrompt = buildUserPrompt({ ...input, transcript: clipped });

  // Gemini is preferred for processing. If its quota fails (e.g. free-tier
  // limit: 0), automatically fall back to Groq's LLM so the app keeps working.
  if (isGeminiConfigured()) {
    try {
      return await withRetry(() => extractWithGemini(userPrompt), { retries: 1, baseDelayMs: 600 });
    } catch (err) {
      if (isQuotaError(err) && isGroqConfigured()) {
        return withRetry(() => extractWithGroq(userPrompt), { retries: 1, baseDelayMs: 600 });
      }
      throw err;
    }
  }
  if (isGroqConfigured()) {
    return withRetry(() => extractWithGroq(userPrompt), { retries: 2, baseDelayMs: 600 });
  }
  return withRetry(() => extractWithOpenAI(userPrompt), { retries: 2, baseDelayMs: 800 });
}

async function extractWithGroq(userPrompt: string): Promise<ExtractResult> {
  const completion = await groq().chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.2,
    // Groq supports JSON mode (not strict json_schema), so we pin the shape in
    // the system message and validate with Zod below.
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}

Return ONE JSON object matching exactly this JSON Schema (no markdown, no commentary):
${JSON.stringify(extractionJsonSchema.schema)}`,
      },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty response from model");

  const parsed = extractionSchema.parse(JSON.parse(raw));
  return { data: parsed, model: completion.model, tokensUsed: completion.usage?.total_tokens ?? 0 };
}

async function extractWithOpenAI(userPrompt: string): Promise<ExtractResult> {
  const completion = await openai().chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: "json_schema", json_schema: extractionJsonSchema },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty response from model");

  const parsed = extractionSchema.parse(JSON.parse(raw));
  return { data: parsed, model: completion.model, tokensUsed: completion.usage?.total_tokens ?? 0 };
}

async function extractWithGemini(userPrompt: string): Promise<ExtractResult> {
  const model = gemini().getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: `${SYSTEM_PROMPT}

You MUST return a single JSON object that conforms exactly to this JSON Schema (no markdown, no commentary):
${JSON.stringify(extractionJsonSchema.schema)}`,
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  });

  const res = await model.generateContent(userPrompt);
  const raw = res.response.text();
  if (!raw) throw new Error("Empty response from model");

  const parsed = extractionSchema.parse(JSON.parse(raw));
  const tokensUsed = res.response.usageMetadata?.totalTokenCount ?? 0;
  return { data: parsed, model: GEMINI_MODEL, tokensUsed };
}
