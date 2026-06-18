# Automatic Multilingual Code-Switch Transcription — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Implement task-by-task with TDD.

**Goal:** Replace single-language-pinned transcription with a fully automatic, code-switch-aware pipeline that chunks long audio server-side and routes each chunk to Gemini (primary) → Whisper-auto (fallback).

**Architecture:** Upload streamed to `/tmp` → ffmpeg normalizes to mono 16 kHz MP3 and segments at 300 s → each chunk transcribed (Gemini multimodal auto → Whisper-auto fallback) with a concurrency pool of 4, order preserved → stitched → refined (code-switch-aware, windowed). No language is ever pinned. Picker removed from the UI.

**Tech Stack:** NestJS 11, `ffmpeg-static`, Node `child_process`, Groq/Gemini/OpenAI SDKs, Jest, Next.js 15.

## Global Constraints

- No `language` parameter is ever sent to Whisper or Gemini. True auto-detect only.
- Delete all native-script `bootstrap` priming.
- Chunk format: mono, 16 kHz, MP3, `segment_time=300`.
- Upload limit: 200 MB, multer `diskStorage` to `os.tmpdir()`.
- Concurrency pool size: 4.
- All temp files/dirs removed in `finally`.
- `AudioChunkingService` and AI providers must be mockable (no real ffmpeg/network in tests).

---

### Task 1: AudioChunkingService (ffmpeg wrapper)

**Files:**
- Create: `backend/api/src/transcription/audio-chunking.service.ts`
- Test: `backend/api/src/transcription/audio-chunking.service.spec.ts`
- Modify: `backend/api/package.json` (add `ffmpeg-static`)

**Interfaces:**
- Produces: `class AudioChunkingService { chunk(inputPath: string): Promise<{ paths: string[]; cleanup: () => Promise<void> }> }`
- `ffmpegArgs(inputPath, outDir): string[]` (exported pure helper for unit testing the command).

- [ ] **Step 1:** Add dep: `cd backend/api && npm install ffmpeg-static`.
- [ ] **Step 2:** Write failing test for `ffmpegArgs` — asserts args include `-ac 1`, `-ar 16000`, `-f segment`, `-segment_time 300`, `-c:a libmp3lame`, and an output pattern ending `chunk_%03d.mp3` inside `outDir`.
- [ ] **Step 3:** Implement `ffmpegArgs`. Implement `chunk()`: mkdtemp dir under `os.tmpdir()`, spawn `require('ffmpeg-static')` with `ffmpegArgs`, on exit read+sort `chunk_*.mp3`, return absolute paths + `cleanup` that `rm -rf` the dir. On non-zero exit reject with the ffmpeg stderr tail.
- [ ] **Step 4:** Test `chunk()` with spawn mocked (jest mock of `child_process.spawn` emitting `close` 0) + `fs` reading two fake files ⇒ returns 2 sorted paths; `cleanup()` removes dir.
- [ ] **Step 5:** Run `npm test -- audio-chunking`. Expected PASS.
- [ ] **Step 6:** Commit `feat(api): ffmpeg-based audio chunking service`.

---

### Task 2: TranscriptionService — auto, chunked, fallback

**Files:**
- Modify: `backend/api/src/transcription/transcription.service.ts`
- Modify: `backend/api/src/transcription/transcription.module.ts` (provide `AudioChunkingService`)
- Test: `backend/api/src/transcription/transcription.service.spec.ts`
- Delete: `backend/api/src/transcription/languages.ts`

**Interfaces:**
- Consumes: `AudioChunkingService.chunk` (Task 1).
- Produces:
  - `transcribe(inputPath: string, mimetype: string): Promise<{ text: string; language: string | null }>`
  - `transcribeChunk(path: string, mimetype: string): Promise<string>` (Gemini→Whisper→retry→`[unintelligible segment]`)
  - `refine(raw: string): Promise<string>` (no language arg)

- [ ] **Step 1:** Write failing unit tests (inject a fake `AudioChunkingService` + mock `../ai/providers`):
  - chunk yields `[a,b]`; Gemini returns `"X"`/`"Y"` ⇒ `transcribe` text contains `X` then `Y` in order; `cleanup` called.
  - Gemini throws for a chunk ⇒ Whisper used for it; assert Whisper called **without** `language`.
  - Both engines throw twice ⇒ chunk becomes `[unintelligible segment]`, others still present.
- [ ] **Step 2:** Run tests — expect FAIL (signature/behavior mismatch).
- [ ] **Step 3:** Refactor service: constructor injects `AudioChunkingService`. Remove `LANG_BY_CODE`/`LangSpec`/`bootstrap`/`geminiOnly`. `withGroq` drops `language`+`prompt`, always `whisper-large-v3`. `withGemini` reads a file path (read bytes) instead of multer file; keep code-switch prompt. Add `transcribeChunk` (Gemini primary if configured, else Groq, else OpenAI; retry once; placeholder). Add `transcribe` orchestrator with a 4-worker `pool` over chunk paths preserving order, `\n\n` join, then `refine`, `finally` cleanup. Return detected language from first successful chunk if available else null.
- [ ] **Step 4:** Run `npm test -- transcription.service`. Expected PASS.
- [ ] **Step 5:** Delete `languages.ts`. Commit `feat(api): auto code-switch chunked transcription, drop language pinning`.

---

### Task 3: refine() windowing for long transcripts

**Files:**
- Modify: `backend/api/src/transcription/transcription.service.ts`
- Test: `backend/api/src/transcription/transcription.service.spec.ts`

**Interfaces:**
- Produces: `refine(raw)` handles inputs > window by splitting on paragraph boundaries into ≤30k-char windows, refining each, rejoining with `\n\n`.

- [ ] **Step 1:** Write failing test: raw of 70k chars (mock refine engine echoes input uppercased) ⇒ output fully transformed (not truncated/returned raw) and length ≈ input.
- [ ] **Step 2:** Run — expect FAIL (current code returns raw when > 40k).
- [ ] **Step 3:** Replace the `> REFINE_MAX_CHARS return text` bail with a windowing loop (`REFINE_WINDOW = 30_000`, split on `\n\n` accumulating windows). Still return raw on any engine error.
- [ ] **Step 4:** Run `npm test -- transcription.service`. Expected PASS.
- [ ] **Step 5:** Commit `feat(api): window long transcripts in refine`.

---

### Task 4: Controller — disk upload, 200 MB, no language, no /languages

**Files:**
- Modify: `backend/api/src/transcription/transcription.controller.ts`
- Test: `backend/api/test/transcription.e2e-spec.ts`

**Interfaces:**
- Consumes: `transcribe(path, mimetype)` (Task 2).

- [ ] **Step 1:** Update e2e: mock `AudioChunkingService` (2 chunks) + providers; POST audio (no language) ⇒ 200 with stitched+refined text; remove any `/languages` test; assert providers never receive `language`.
- [ ] **Step 2:** Run — expect FAIL.
- [ ] **Step 3:** Switch `FileInterceptor` to `diskStorage({ destination: os.tmpdir() })`, `limits.fileSize = 200*1024*1024`. Remove `@Body('language')` and the `GET /languages` route + `LANGUAGES` import. Call `transcription.transcribe(file.path, file.mimetype)`; respond `{ text, language }`.
- [ ] **Step 4:** Run `npm run test:e2e -- transcription`. Expected PASS.
- [ ] **Step 5:** Commit `feat(api): disk-streamed 200MB uploads, drop language endpoint/param`.

---

### Task 5: Frontend — remove picker, auto hint

**Files:**
- Modify: `frontend/web/components/workspace/new-meeting.tsx`
- Modify: `frontend/web/lib/api-client.ts` (remove `fetchLanguages` + `LanguageOption`)
- Delete: `frontend/web/components/workspace/language-sheet.tsx`

- [ ] **Step 1:** In `new-meeting.tsx`: remove `LanguageSheet` import/use, `language`/`languages` state, the `useEffect` fetch, `FALLBACK_LANGUAGES`, and `form.append("language", …)`. Replace the picker slot (audio tabs) with a static hint span: `Globe` icon + "Auto · detects & preserves every language spoken". Update transcribing copy: "Transcribing… long meetings can take a minute".
- [ ] **Step 2:** Remove `fetchLanguages` + `LanguageOption` from `api-client.ts`. Delete `language-sheet.tsx`.
- [ ] **Step 3:** `cd frontend/web && npx tsc --noEmit`. Expected: no errors.
- [ ] **Step 4:** Commit `feat(web): automatic multilingual transcription — remove language picker`.

---

### Task 6: Verify + merge

- [ ] **Step 1:** `cd backend/api && npm run build && npm test && npm run test:e2e`.
- [ ] **Step 2:** `cd frontend/web && npm run build`.
- [ ] **Step 3:** Merge `feat/auto-multilingual-transcription` → `main`, push (triggers Render + Vercel deploys). Confirm `GEMINI_API_KEY`/`GROQ_API_KEY` set on Render.

## Self-Review

- **Spec coverage:** chunking (T1), engine routing/fallback/no-pin (T2), refine windowing (T3), upload/limit/endpoint cleanup (T4), UI/auto (T5), deploy (T6). All spec sections covered.
- **Placeholder scan:** none.
- **Type consistency:** `transcribe(path, mimetype)`, `transcribeChunk(path, mimetype)`, `chunk(inputPath)→{paths,cleanup}` consistent across T1/T2/T4.
