import { EventEmitter } from 'node:events';
import { writeFileSync, existsSync, promises as fs } from 'node:fs';
import * as path from 'node:path';

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));
// ffmpeg-static resolves to a binary path string; pin it for the test.
jest.mock('ffmpeg-static', () => '/fake/ffmpeg');

import { spawn } from 'node:child_process';
import { AudioChunkingService, ffmpegArgs, SEGMENT_SECONDS } from './audio-chunking.service';

const spawnMock = spawn as unknown as jest.Mock;

describe('ffmpegArgs', () => {
  it('builds a normalize + segment command (mono 16k mp3, 300s)', () => {
    const args = ffmpegArgs('/in.webm', '/out');
    expect(args).toEqual(
      expect.arrayContaining(['-ac', '1', '-ar', '16000', '-f', 'segment']),
    );
    const i = args.indexOf('-segment_time');
    expect(args[i + 1]).toBe(String(SEGMENT_SECONDS));
    expect(args).toEqual(expect.arrayContaining(['-c:a', 'libmp3lame']));
    expect(args[args.length - 1]).toBe(path.join('/out', 'chunk_%03d.mp3'));
  });
});

describe('AudioChunkingService.chunk', () => {
  const service = new AudioChunkingService();

  afterEach(() => spawnMock.mockReset());

  it('returns ordered chunk paths and cleanup removes the temp dir', async () => {
    // Simulate ffmpeg: write two real chunk files into the output dir, then exit 0.
    spawnMock.mockImplementation((_bin: string, args: string[]) => {
      const outDir = path.dirname(args[args.length - 1]);
      writeFileSync(path.join(outDir, 'chunk_001.mp3'), 'b');
      writeFileSync(path.join(outDir, 'chunk_000.mp3'), 'a');
      const proc = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      proc.stderr = new EventEmitter();
      process.nextTick(() => proc.emit('close', 0));
      return proc;
    });

    const { paths, cleanup } = await service.chunk('/in.webm');

    expect(paths).toHaveLength(2);
    expect(path.basename(paths[0])).toBe('chunk_000.mp3'); // sorted
    expect(path.basename(paths[1])).toBe('chunk_001.mp3');
    expect(existsSync(paths[0])).toBe(true);

    const dir = path.dirname(paths[0]);
    await cleanup();
    expect(existsSync(dir)).toBe(false);
  });

  it('rejects (and cleans up) when ffmpeg exits non-zero', async () => {
    let captured = '';
    spawnMock.mockImplementation((_bin: string, args: string[]) => {
      captured = path.dirname(args[args.length - 1]);
      const proc = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      proc.stderr = new EventEmitter();
      process.nextTick(() => {
        proc.stderr.emit('data', Buffer.from('boom'));
        proc.emit('close', 1);
      });
      return proc;
    });

    await expect(service.chunk('/in.webm')).rejects.toThrow(/ffmpeg exited with code 1/);
    // temp dir removed on failure
    await expect(fs.access(captured)).rejects.toBeDefined();
  });
});
