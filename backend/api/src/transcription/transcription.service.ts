import { BadRequestException, Injectable } from '@nestjs/common';
import { toFile } from 'openai';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  groq,
  GROQ_MODEL,
  gemini,
  GEMINI_MODEL,
  isGeminiConfigured,
  isGroqConfigured,
  openai,
  OPENAI_TRANSCRIBE_MODEL,
  isQuotaError,
} from '../ai/providers';
import { withTimeout, AI_TIMEOUT_MS, TRANSCRIBE_TIMEOUT_MS } from '../ai/timeout';
import { AudioChunkingService } from './audio-chunking.service';

const GEMINI_INLINE_MAX_BYTES = 18 * 1024 * 1024;
const POOL_SIZE = 4;
const REFINE_WINDOW = 30_000;
const CHUNK_MIME = 'audio/mpeg'; // ffmpeg emits mp3 chunks
const UNINTELLIGIBLE = '[unintelligible segment]';

const CODE_SWITCH_PROMPT =
  'Transcribe this meeting audio verbatim in the ORIGINAL spoken language(s). ' +
  'The conversation may switch between languages within or across sentences ' +
  '(code-switching) — keep each word in the language it was actually spoken; do ' +
  'NOT translate or normalize to one language. Detect the languages yourself. ' +
  'Preserve names and technical terms as spoken. If distinct speakers are ' +
  "audible, prefix lines with a label like 'Speaker 1:'. Output only the " +
  'transcript text — no preamble, no commentary.';

export interface TranscribeResult {
  text: string;
  language: string | null;
}

@Injectable()
export class TranscriptionService {
  constructor(private readonly chunking: AudioChunkingService) {}

  // Full pipeline: chunk -> transcribe each chunk (auto, code-switch aware,
  // Gemini primary / Whisper fallback) with bounded concurrency -> stitch ->
  // refine. Never pins a language. Always cleans up temp chunk files.
  async transcribe(inputPath: string, mimetype: string): Promise<TranscribeResult> {
    let paths: string[];
    let cleanup: () => Promise<void>;
    let chunkMime = CHUNK_MIME;
    try {
      ({ paths, cleanup } = await this.chunking.chunk(inputPath));
    } catch {
      // ffmpeg unavailable/failed — best effort: transcribe the original file whole.
      paths = [inputPath];
      cleanup = async () => undefined;
      chunkMime = mimetype;
    }

    try {
      const texts = await this.pool(paths, POOL_SIZE, (p) =>
        this.transcribeChunk(p, chunkMime),
      );
      const stitched = texts.join('\n\n').trim();
      if (!stitched || texts.every((t) => t === UNINTELLIGIBLE)) {
        throw new BadRequestException('Could not transcribe the audio.');
      }
      const refined = await this.refine(stitched);
      return { text: refined, language: null };
    } finally {
      await cleanup();
    }
  }

  // One chunk through the engine chain with a single retry, then a placeholder
  // so one bad segment never fails an entire (possibly hours-long) transcript.
  async transcribeChunk(filePath: string, mimetype: string): Promise<string> {
    const attempt = async (): Promise<string> => {
      if (isGeminiConfigured()) {
        try {
          return await this.withGemini(filePath, mimetype);
        } catch (err) {
          if (isGroqConfigured()) return await this.withGroq(filePath, mimetype);
          if (process.env.OPENAI_API_KEY) return await this.withWhisperOpenAI(filePath, mimetype);
          throw err;
        }
      }
      if (isGroqConfigured()) return await this.withGroq(filePath, mimetype);
      if (process.env.OPENAI_API_KEY) return await this.withWhisperOpenAI(filePath, mimetype);
      throw new BadRequestException('No transcription provider is configured.');
    };

    try {
      return await attempt();
    } catch {
      try {
        return await attempt();
      } catch {
        return UNINTELLIGIBLE;
      }
    }
  }

  private async withGroq(filePath: string, mimetype: string): Promise<string> {
    const buf = await fs.readFile(filePath);
    const upload = await toFile(buf, path.basename(filePath), {
      type: mimetype || CHUNK_MIME,
    });
    // No `language`, no script-priming prompt — true auto-detect handles
    // arbitrary code-switching far better than pinning a single language.
    const res = await groq().audio.transcriptions.create({
      file: upload,
      model: 'whisper-large-v3',
      response_format: 'verbose_json',
    });
    return res.text;
  }

  private async withWhisperOpenAI(filePath: string, mimetype: string): Promise<string> {
    const buf = await fs.readFile(filePath);
    const upload = await toFile(buf, path.basename(filePath), {
      type: mimetype || CHUNK_MIME,
    });
    const res = await openai().audio.transcriptions.create({
      file: upload,
      model: OPENAI_TRANSCRIBE_MODEL,
      response_format: 'verbose_json',
    });
    return res.text;
  }

  private async withGemini(filePath: string, mimetype: string): Promise<string> {
    const buf = await fs.readFile(filePath);
    if (buf.length > GEMINI_INLINE_MAX_BYTES) {
      // Should not happen for ~5-min chunks; bail so the Whisper fallback runs.
      throw new Error('chunk too large for inline Gemini transcription');
    }
    const base64 = buf.toString('base64');
    const model = gemini().getGenerativeModel({ model: GEMINI_MODEL });
    const res = await withTimeout(
      model.generateContent([
        { text: CODE_SWITCH_PROMPT },
        { inlineData: { mimeType: mimetype || CHUNK_MIME, data: base64 } },
      ]),
      TRANSCRIBE_TIMEOUT_MS,
      'gemini transcription',
    );
    const text = res.response.text()?.trim();
    if (!text) throw new Error('Transcription returned no text.');
    return text;
  }

  // Second stage: clean raw STT into a polished, speaker-labeled transcript in
  // the original language(s). Never blocks — returns raw text on any failure.
  // Long transcripts are refined in windows so nothing is dropped.
  async refine(raw: string): Promise<string> {
    const text = raw.trim();
    if (text.length < 12) return text;
    const prompt = this.buildRefinePrompt();
    try {
      if (text.length <= REFINE_WINDOW) return await this.refineOnce(text, prompt);
      const windows = this.splitWindows(text, REFINE_WINDOW);
      const out: string[] = [];
      for (const w of windows) out.push(await this.refineOnce(w, prompt));
      return out.join('\n\n');
    } catch {
      return text;
    }
  }

  private async refineOnce(text: string, prompt: string): Promise<string> {
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
  }

  // Split on paragraph boundaries, accumulating up to `size` chars per window.
  // A single oversized paragraph is hard-split so no window exceeds the cap.
  private splitWindows(text: string, size: number): string[] {
    const paras = text.split('\n\n');
    const windows: string[] = [];
    let cur = '';
    const push = () => {
      if (cur) windows.push(cur);
      cur = '';
    };
    for (const para of paras) {
      if (para.length > size) {
        push();
        for (let i = 0; i < para.length; i += size) windows.push(para.slice(i, i + size));
        continue;
      }
      if (cur.length + para.length + 2 > size) push();
      cur = cur ? `${cur}\n\n${para}` : para;
    }
    push();
    return windows;
  }

  private buildRefinePrompt(): string {
    return `You are a transcription editor. You receive a raw, machine-generated speech-to-text transcript that may contain recognition errors, no punctuation, and no speaker labels.

Produce a clean, faithful transcript:
- Keep the ORIGINAL spoken language(s) exactly. Do NOT translate. Preserve code-switching (words/phrases in different languages) exactly as spoken, each in its own script.
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

  // Bounded-concurrency map that preserves input order in the output.
  private async pool<T, R>(
    items: T[],
    size: number,
    fn: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const worker = async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i], i);
      }
    };
    const workers = Array.from({ length: Math.min(size, items.length) }, worker);
    await Promise.all(workers);
    return results;
  }
}
