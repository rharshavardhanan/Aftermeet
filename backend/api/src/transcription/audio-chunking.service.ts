import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

// One ffmpeg pass normalizes ANY input (webm/m4a/mp3/wav…) to a uniform,
// STT-friendly format AND splits it into fixed-length segments. Normalizing to
// mono 16 kHz MP3 also repairs the flaky webm headers MediaRecorder produces
// and shrinks each chunk well under every engine's upload limit.
export const SEGMENT_SECONDS = 300;
const CHUNK_RE = /^chunk_\d+\.mp3$/;

export function ffmpegArgs(inputPath: string, outDir: string): string[] {
  return [
    '-i',
    inputPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-f',
    'segment',
    '-segment_time',
    String(SEGMENT_SECONDS),
    '-c:a',
    'libmp3lame',
    '-q:a',
    '5',
    path.join(outDir, 'chunk_%03d.mp3'),
  ];
}

export interface ChunkResult {
  paths: string[];
  cleanup: () => Promise<void>;
}

@Injectable()
export class AudioChunkingService {
  // Split an audio file into ordered, normalized MP3 segments. Short audio
  // yields exactly one chunk. The caller MUST invoke `cleanup()` when done.
  async chunk(inputPath: string): Promise<ChunkResult> {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aftermeet-chunks-'));
    const cleanup = async () => {
      await fs.rm(outDir, { recursive: true, force: true }).catch(() => undefined);
    };
    try {
      await this.runFfmpeg(ffmpegArgs(inputPath, outDir));
      const files = (await fs.readdir(outDir))
        .filter((f) => CHUNK_RE.test(f))
        .sort();
      if (files.length === 0) {
        throw new Error('ffmpeg produced no audio segments');
      }
      return { paths: files.map((f) => path.join(outDir, f)), cleanup };
    } catch (err) {
      await cleanup();
      throw err;
    }
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const bin: string = ffmpegPath ?? 'ffmpeg';
      const proc = spawn(bin, args);
      let stderr = '';
      proc.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
        if (stderr.length > 4000) stderr = stderr.slice(-4000);
      });
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim().slice(-500)}`));
      });
    });
  }
}
