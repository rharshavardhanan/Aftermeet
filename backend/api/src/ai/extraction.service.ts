import { Injectable } from '@nestjs/common';
import { extractionSchema, extractionJsonSchema, Extraction } from './schema';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt';
import { withRetry } from './retry';
import {
  openai,
  OPENAI_MODEL,
  groq,
  GROQ_MODEL,
  isGroqConfigured,
  gemini,
  GEMINI_MODEL,
  isGeminiConfigured,
  isQuotaError,
} from './providers';

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

const MAX_CHARS = 48_000;

// Ported from the monolith's lib/ai/extract.ts: enforced JSON output, schema
// validation, retries, and Gemini -> Groq quota fallback.
@Injectable()
export class ExtractionService {
  async extract(input: ExtractInput): Promise<ExtractResult> {
    const transcript = input.transcript?.trim() ?? '';
    if (transcript.length < 12) {
      throw new Error('Transcript is too short to analyze.');
    }
    const clipped =
      transcript.length > MAX_CHARS ? transcript.slice(-MAX_CHARS) : transcript;
    const userPrompt = buildUserPrompt({ ...input, transcript: clipped });

    if (isGeminiConfigured()) {
      try {
        return await withRetry(() => this.withGemini(userPrompt), {
          retries: 1,
          baseDelayMs: 600,
        });
      } catch (err) {
        if (isQuotaError(err) && isGroqConfigured()) {
          return withRetry(() => this.withGroq(userPrompt), {
            retries: 1,
            baseDelayMs: 600,
          });
        }
        throw err;
      }
    }
    if (isGroqConfigured()) {
      return withRetry(() => this.withGroq(userPrompt), {
        retries: 2,
        baseDelayMs: 600,
      });
    }
    return withRetry(() => this.withOpenAI(userPrompt), {
      retries: 2,
      baseDelayMs: 800,
    });
  }

  private async withGroq(userPrompt: string): Promise<ExtractResult> {
    const completion = await groq().chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}

Return ONE JSON object matching exactly this JSON Schema (no markdown, no commentary):
${JSON.stringify(extractionJsonSchema.schema)}`,
        },
        { role: 'user', content: userPrompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty response from model');
    const parsed = extractionSchema.parse(JSON.parse(raw));
    return {
      data: parsed,
      model: completion.model,
      tokensUsed: completion.usage?.total_tokens ?? 0,
    };
  }

  private async withOpenAI(userPrompt: string): Promise<ExtractResult> {
    const completion = await openai().chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_schema', json_schema: extractionJsonSchema },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty response from model');
    const parsed = extractionSchema.parse(JSON.parse(raw));
    return {
      data: parsed,
      model: completion.model,
      tokensUsed: completion.usage?.total_tokens ?? 0,
    };
  }

  private async withGemini(userPrompt: string): Promise<ExtractResult> {
    const model = gemini().getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: `${SYSTEM_PROMPT}

You MUST return a single JSON object that conforms exactly to this JSON Schema (no markdown, no commentary):
${JSON.stringify(extractionJsonSchema.schema)}`,
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    });
    const res = await model.generateContent(userPrompt);
    const raw = res.response.text();
    if (!raw) throw new Error('Empty response from model');
    const parsed = extractionSchema.parse(JSON.parse(raw));
    const tokensUsed = res.response.usageMetadata?.totalTokenCount ?? 0;
    return { data: parsed, model: GEMINI_MODEL, tokensUsed };
  }
}
