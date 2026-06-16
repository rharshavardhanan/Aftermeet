import { BadRequestException, Injectable } from '@nestjs/common';
import { toFile } from 'openai';
import {
  groq,
  GROQ_MODEL,
  GROQ_STT_MODEL,
  isGroqConfigured,
  gemini,
  GEMINI_MODEL,
  isGeminiConfigured,
  openai,
  OPENAI_TRANSCRIBE_MODEL,
  isQuotaError,
} from '../ai/providers';
import { LANG_BY_CODE, LangSpec } from './languages';
import { withTimeout, AI_TIMEOUT_MS, TRANSCRIBE_TIMEOUT_MS } from '../ai/timeout';

const GEMINI_INLINE_MAX_BYTES = 18 * 1024 * 1024;
const REFINE_MAX_CHARS = 40_000;

export interface TranscribeResult {
  text: string;
  language?: string;
}

@Injectable()
export class TranscriptionService {
  // Two-tier provider selection:
  //   • Whisper-supported language (or auto) -> Groq Whisper (OpenAI fallback).
  //   • Whisper-unsupported language -> Gemini multimodal (broad coverage).
  async transcribe(
    file: Express.Multer.File,
    language?: string,
  ): Promise<TranscribeResult> {
    const meta = language ? LANG_BY_CODE[language] : undefined;
    const geminiOnly = Boolean(language && meta && !meta.whisper);

    if (geminiOnly && isGeminiConfigured()) return this.withGemini(file, language, meta);
    if (isGroqConfigured() && !geminiOnly) return this.withGroq(file, language, meta);
    if (isGeminiConfigured()) return this.withGemini(file, language, meta);
    if (process.env.OPENAI_API_KEY) return this.withWhisperOpenAI(file, language);
    throw new BadRequestException('No transcription provider is configured.');
  }

  private async withGroq(
    file: Express.Multer.File,
    language: string | undefined,
    meta: LangSpec | undefined,
  ): Promise<TranscribeResult> {
    const upload = await toFile(file.buffer, file.originalname || 'audio.webm', {
      type: file.mimetype || 'audio/webm',
    });
    // Full large-v3 is markedly better than turbo for non-English (e.g. Tamil);
    // use it when a non-English Whisper language is requested, else fast turbo.
    const model =
      language && language !== 'en' && meta?.whisper
        ? 'whisper-large-v3'
        : GROQ_STT_MODEL;
    const res = await groq().audio.transcriptions.create({
      file: upload,
      model,
      response_format: 'verbose_json',
      ...(language ? { language } : {}),
      ...(meta?.bootstrap ? { prompt: meta.bootstrap } : {}),
    });
    return { text: res.text, language: (res as { language?: string }).language };
  }

  private async withWhisperOpenAI(
    file: Express.Multer.File,
    language?: string,
  ): Promise<TranscribeResult> {
    const upload = await toFile(file.buffer, file.originalname || 'audio.webm', {
      type: file.mimetype || 'audio/webm',
    });
    const res = await openai().audio.transcriptions.create({
      file: upload,
      model: OPENAI_TRANSCRIBE_MODEL,
      response_format: 'verbose_json',
      ...(language ? { language } : {}),
    });
    return { text: res.text, language: (res as { language?: string }).language };
  }

  private async withGemini(
    file: Express.Multer.File,
    language: string | undefined,
    meta: LangSpec | undefined,
  ): Promise<TranscribeResult> {
    if (file.size > GEMINI_INLINE_MAX_BYTES) {
      throw new BadRequestException(
        'Audio is too large for transcription (over ~18MB). Use a shorter clip or paste the transcript.',
      );
    }
    const base64 = file.buffer.toString('base64');
    const model = gemini().getGenerativeModel({ model: GEMINI_MODEL });
    const langName = meta?.label;
    const instruction = langName ? `The primary language is ${langName}. ` : '';
    const res = await withTimeout(
      model.generateContent([
      {
        text:
          `${instruction}Transcribe this meeting audio verbatim in the ORIGINAL spoken language(s). ` +
          'The conversation may switch between languages within or across sentences ' +
          '(code-switching) — keep each word in the language it was actually spoken; do ' +
          'NOT translate or normalize to one language. Preserve names and technical terms ' +
          'as spoken. If distinct speakers are audible, prefix lines with a label like ' +
          "'Speaker 1:'. Output only the transcript text — no preamble, no commentary.",
      },
      { inlineData: { mimeType: file.mimetype || 'audio/webm', data: base64 } },
      ]),
      TRANSCRIBE_TIMEOUT_MS,
      'gemini transcription',
    );
    const text = res.response.text()?.trim();
    if (!text) throw new Error('Transcription returned no text.');
    return { text, language };
  }

  // Second stage: clean raw STT into a polished, speaker-labeled transcript in
  // the original language. Never blocks — returns raw text on any failure.
  async refine(raw: string, language?: string): Promise<string> {
    const text = raw.trim();
    if (text.length < 12 || text.length > REFINE_MAX_CHARS) return text;
    const prompt = this.buildRefinePrompt(language);
    try {
      if (isGeminiConfigured()) {
        try {
          return await this.refineWithGemini(text, prompt);
        } catch (err) {
          if (isQuotaError(err) && isGroqConfigured()) {
            return await this.refineWithGroq(text, prompt);
          }
          throw err;
        }
      }
      if (isGroqConfigured()) return await this.refineWithGroq(text, prompt);
      return text;
    } catch {
      return text;
    }
  }

  private buildRefinePrompt(language?: string): string {
    const label = language ? LANG_BY_CODE[language]?.label : undefined;
    const langLine = label
      ? `\n- The primary spoken language is ${label}. Preserve all words in that script/language exactly. Keep English technical terms and loanwords as spoken — do NOT translate them.`
      : '';
    return `You are a transcription editor. You receive a raw, machine-generated speech-to-text transcript that may contain recognition errors, no punctuation, and no speaker labels.

Produce a clean, faithful transcript:
- Keep the ORIGINAL spoken language(s) exactly. Do NOT translate. Preserve code-switching (words/phrases in different languages) exactly as spoken.${langLine}
- Fix obvious mis-recognitions using context; add natural punctuation, capitalization, and paragraph breaks.
- If distinct speakers are discernible, label each turn as "Speaker 1:", "Speaker 2:", etc. Use real names only if clearly stated in the audio.
- Do NOT summarize, add, or remove meaning. Output ONLY the cleaned transcript text — no preamble, no commentary.`;
  }

  private async refineWithGemini(text: string, prompt: string): Promise<string> {
    const model = gemini().getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: prompt,
      generationConfig: { temperature: 0.2 },
    });
    const res = await withTimeout(
      model.generateContent(text),
      AI_TIMEOUT_MS,
      'gemini refine',
    );
    return res.response.text()?.trim() || text;
  }

  private async refineWithGroq(text: string, prompt: string): Promise<string> {
    const res = await groq().chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text },
      ],
    });
    return res.choices[0]?.message?.content?.trim() || text;
  }
}
