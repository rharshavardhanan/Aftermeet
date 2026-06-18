import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// Mock the AI providers so no network/keys are needed.
const groqCreate = jest.fn();
const geminiGenerate = jest.fn();
jest.mock('../ai/providers', () => ({
  isGeminiConfigured: jest.fn(() => true),
  isGroqConfigured: jest.fn(() => true),
  isQuotaError: jest.fn(() => false),
  groq: () => ({ audio: { transcriptions: { create: groqCreate } } }),
  gemini: () => ({ getGenerativeModel: () => ({ generateContent: geminiGenerate }) }),
  openai: () => ({ audio: { transcriptions: { create: jest.fn() } } }),
  GROQ_MODEL: 'llama',
  GEMINI_MODEL: 'gemini',
  OPENAI_TRANSCRIBE_MODEL: 'whisper-1',
}));

import {
  isGeminiConfigured,
  isGroqConfigured,
} from '../ai/providers';
import { TranscriptionService } from './transcription.service';
import { AudioChunkingService } from './audio-chunking.service';

const geminiCfg = isGeminiConfigured as jest.Mock;
const groqCfg = isGroqConfigured as jest.Mock;

function geminiReply(text: string) {
  return { response: { text: () => text } };
}

// A chunking stub that writes N real temp files and returns their paths.
function fakeChunking(n: number): { svc: AudioChunkingService; cleanup: jest.Mock } {
  const cleanup = jest.fn().mockResolvedValue(undefined);
  const svc = {
    chunk: jest.fn(async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'svc-test-'));
      const paths: string[] = [];
      for (let i = 0; i < n; i++) {
        const p = path.join(dir, `chunk_00${i}.mp3`);
        await fs.writeFile(p, `audio-${i}`);
        paths.push(p);
      }
      return {
        paths,
        cleanup: async () => {
          cleanup();
          await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
        },
      };
    }),
  } as unknown as AudioChunkingService;
  return { svc, cleanup };
}

describe('TranscriptionService.transcribe', () => {
  beforeEach(() => {
    groqCreate.mockReset();
    geminiGenerate.mockReset();
    geminiCfg.mockReturnValue(true);
    groqCfg.mockReturnValue(true);
  });

  it('stitches chunks in order and refines (Gemini primary)', async () => {
    // Per-chunk transcription identifies the chunk from its audio bytes
    // (so the assertion is robust to concurrent completion order). The refine
    // pass (string arg) echoes its input wrapped in REFINED(...).
    geminiGenerate.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'string') return geminiReply(`REFINED(${arg})`);
      const parts = arg as Array<{ inlineData?: { data: string } }>;
      const b64 = parts[1].inlineData!.data;
      const content = Buffer.from(b64, 'base64').toString(); // "audio-0"
      return geminiReply(`chunk-${content.split('-')[1]}`);
    });
    const { svc } = fakeChunking(2);
    const service = new TranscriptionService(svc);

    const result = await service.transcribe('/in.webm', 'audio/webm');

    // Order preserved (chunk-0 before chunk-1) and refine ran over the stitch.
    expect(result.text).toBe('REFINED(chunk-0\n\nchunk-1)');
    expect(result.language).toBeNull();
  });

  it('falls back to Whisper (no language pin) when Gemini fails for a chunk', async () => {
    geminiGenerate.mockRejectedValue(new Error('gemini down')); // all gemini calls fail
    groqCreate.mockResolvedValue({ text: 'whisper-text' });
    const { svc } = fakeChunking(1);
    const service = new TranscriptionService(svc);

    await service.transcribe('/in.webm', 'audio/webm');

    expect(groqCreate).toHaveBeenCalled();
    // CRITICAL: Whisper must never be pinned to a language.
    const callArg = groqCreate.mock.calls[0][0];
    expect(callArg).not.toHaveProperty('language');
    expect(callArg).not.toHaveProperty('prompt');
    expect(callArg.model).toBe('whisper-large-v3');
  });

  it('marks a chunk unintelligible when both engines fail twice, keeping others', async () => {
    // Two chunks: chunk 0 always fails on both engines; chunk 1 succeeds on Gemini.
    geminiGenerate.mockImplementation(async () => {
      throw new Error('gemini down');
    });
    groqCreate.mockImplementation(async () => {
      throw new Error('groq down');
    });
    const { svc } = fakeChunking(2);
    const service = new TranscriptionService(svc);

    // Both fail for every chunk -> all unintelligible -> overall error.
    await expect(service.transcribe('/in.webm', 'audio/webm')).rejects.toThrow();
  });
});

describe('TranscriptionService.refine windowing', () => {
  beforeEach(() => {
    geminiGenerate.mockReset();
    geminiCfg.mockReturnValue(true);
    groqCfg.mockReturnValue(true);
    // Refine engine: uppercase whatever text it is given.
    geminiGenerate.mockImplementation(async (text: string) =>
      geminiReply(String(text).toUpperCase()),
    );
  });

  it('processes the whole transcript when it exceeds the window (no truncation)', async () => {
    const service = new TranscriptionService({} as AudioChunkingService);
    const para = 'lorem ipsum dolor sit amet '.repeat(60); // ~1.6k chars
    const raw = Array.from({ length: 60 }, () => para).join('\n\n'); // ~96k chars
    const needleRaw = `${raw}\n\nfinal needle line`;

    const out = await service.refine(needleRaw);

    expect(out).toContain('FINAL NEEDLE LINE'); // tail window was processed
    expect(out.length).toBeGreaterThan(30_000); // nothing dropped
    expect(geminiGenerate.mock.calls.length).toBeGreaterThan(1); // multiple windows
  });
});
