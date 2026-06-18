# Automatic Multilingual, Code-Switch-Aware Transcription

**Date:** 2026-06-18
**Status:** Approved (user delegated all production decisions)
**Area:** `backend/api` transcription pipeline + `frontend/web` capture UI

## Problem

Today the user picks **one** spoken language. The backend then pins Whisper to
that language (`language: 'ta'`) *and* seeds it with a native-script `bootstrap`
primer. Whisper decodes monolingually, so any other language spoken (typically
English mixed into Tamil/Hindi/etc.) is forced into the wrong script and
mangled. Pinning one language is the worst possible setting for real,
code-switched meetings.

A code-switch-capable engine already exists in the codebase (Gemini multimodal,
whose prompt preserves each word's original language) but it is only used for
~11 rare languages — never for common ones. So mixed speech is always routed to
the wrong engine.

Meetings are also long. A 1-hour recording is ~15–30 MB and a 2-hour one
30–60 MB — both exceed Gemini's ~18 MB inline limit *and* Groq Whisper's 25 MB
limit. The current upload cap is 25 MB, so long meetings fail outright on every
engine today.

## Goals

- Transcribe **any mix of any world languages**, fully automatically, with no
  language picker.
- Preserve each word in the language/script it was actually spoken (no
  translation, no transliteration).
- Handle **long meetings** (multi-hour) reliably.
- Keep it production-deployable on Render (Node runtime, modest RAM).

## Non-Goals

- A job queue / live progress bar (documented as the next iteration).
- Real-time / streaming transcription during recording.
- Perfect global speaker-numbering across very long transcripts.

## Decisions (production-best, locked)

| Decision | Choice |
| --- | --- |
| Language selection | **Fully automatic** — no picker, no `language` param |
| Code-switch engine | **Gemini multimodal** (auto), primary |
| Fallback engine | **Whisper-auto** (Groq `whisper-large-v3`, no language pin) |
| Long-audio handling | **Server-side ffmpeg** chunking (one path for record + upload) |
| Chunk format | mono 16 kHz **MP3**, ~300 s segments |
| Concurrency | worker pool of **4**, order preserved |
| Request model | **Synchronous** (browser → Render direct; no serverless timeout) |
| Upload limit | **200 MB**, disk storage to `/tmp` |

## Architecture & Data Flow

```
audio (record | upload, any format/length)
        │  multer diskStorage → /tmp/<uuid>.<ext>   (limit 200 MB)
        ▼
AudioChunkingService (ffmpeg-static + child_process.spawn)
   ffmpeg -i in -ac 1 -ar 16000 -f segment -segment_time 300 \
          -c:a libmp3lame -q:a 5 /tmp/<uuid>/chunk_%03d.mp3
        │  → ordered [chunk_000.mp3, chunk_001.mp3, …] + cleanup()
        ▼
TranscriptionService.transcribe()
   pool(4): per chunk → transcribeChunk()
            ├─ Gemini multimodal (auto, code-switch prompt)   [primary]
            └─ Whisper-auto (Groq large-v3, NO language)      [fallback]
            └─ retry once; else "[unintelligible segment]"
        │  stitch raw chunk texts in order (\n\n join)
        ▼
   refine() — code-switch-aware, auto-language,
              windowed (~30k chars) for long transcripts
        ▼
   { text, language: detected|null }   (temp files removed in finally)
```

## Components

### Backend (`backend/api/src/transcription/`)

- **`audio-chunking.service.ts`** (new) — wraps the bundled ffmpeg binary.
  - `chunk(filePath): Promise<{ paths: string[]; cleanup: () => Promise<void> }>`
  - Normalizes to mono/16 kHz MP3 and segments at 300 s in a single ffmpeg pass.
  - Short audio yields exactly one chunk. Always run through ffmpeg so the
    webm-header repair + format normalization always happen.
  - Injectable so it can be mocked in tests (no real ffmpeg in unit/e2e).
- **`transcription.service.ts`** (refactor)
  - `transcribe(filePath, mimetype)` orchestrates: chunk → pooled
    `transcribeChunk` → stitch. No `language` parameter anymore.
  - `transcribeChunk(path)`: Gemini primary → Whisper fallback → retry-once →
    placeholder. Whisper called **without** `language`; Gemini in auto mode.
  - `refine(raw)`: keep two-stage cleanup; remove language-pinning; window long
    inputs instead of bailing at 40k chars.
  - Delete `LANG_BY_CODE`/`bootstrap` usage.
- **`transcription.controller.ts`** (change)
  - `FileInterceptor` → `diskStorage` to `/tmp`, `limits.fileSize = 200 MB`.
  - Drop the `language` body param. Remove the `GET /languages` route.
- **`languages.ts`** — delete (no longer referenced).
- **`ai/providers.ts`** — unchanged; reused for `gemini`/`groq`/`openai`.

### Frontend (`frontend/web`)

- **`components/workspace/new-meeting.tsx`**
  - Remove `LanguageSheet`, `language` state, `languages` fetch, and the
    `form.append("language", …)` call.
  - Add a small static hint near the audio tabs: "Auto · detects & preserves
    every language spoken."
  - Update transcribing copy to note long meetings can take a couple minutes.
- **`components/workspace/language-sheet.tsx`** — delete.
- **`lib/api-client.ts`** — remove `fetchLanguages`; `transcribeViaApi` keeps
  posting `FormData` (just without `language`).

## Engine Behaviour

- **Gemini (primary):** existing multimodal prompt — verbatim, original
  language(s) per word, explicit code-switching instruction, speaker labels,
  no translation. Runs in auto mode (no language naming needed).
- **Whisper (fallback):** Groq `whisper-large-v3`, `response_format: verbose_json`,
  **no `language`**, **no `prompt`/bootstrap**. True auto-detect.
- **OpenAI Whisper:** retained as a final fallback if neither Gemini nor Groq is
  configured.

## Error Handling

- ffmpeg failure → surface a clear `BadRequestException`; as a safety net, fall
  back to transcribing the original file as a single chunk.
- Per-chunk: 1 retry, then alternate engine, then `[unintelligible segment]`
  marker — never fail the whole job for one chunk.
- `finally` removes the temp upload + chunk directory even on error.
- File > 200 MB → rejected by multer with a clear message.

## Testing (TDD)

Unit (`*.spec.ts`):
- `AudioChunkingService` — ffmpeg arg/command construction (spawn mocked);
  ordered path return; cleanup removes the temp dir.
- `transcribeChunk` fallback — Gemini throws ⇒ Whisper used; both throw ⇒
  placeholder; assert Whisper is **never** called with a `language`.
- stitch — chunks joined in numeric order.
- `refine` windowing — input > window split, refined per window, rejoined.

e2e (`test/transcription.e2e-spec.ts`, extend):
- Mock `AudioChunkingService` to yield 2 chunks + mock providers ⇒ assert
  stitched + refined output, and that no language is ever pinned.

## Deploy / Config

- Add dependency: **`ffmpeg-static`** (ships a Linux static binary; resolve its
  path at runtime via `require('ffmpeg-static')`).
- `/tmp` is writable on Render; chunk dirs are namespaced by UUID and removed.
- Env on Render `aftermeet-api`: `GEMINI_API_KEY` (primary) + `GROQ_API_KEY`
  (fallback) — both already in the blueprint.

## Risks / Future

- **Long synchronous requests.** Mitigated by the concurrency pool (a 2-hour
  meeting ≈ a few minutes) and Render's direct browser→backend path (no
  serverless cutoff). If real usage outgrows this, move to an async job +
  polling progress bar — the chunk pipeline already produces natural progress
  units (`done/total`).
- **ffmpeg memory.** Mitigated by disk storage + ffmpeg streaming (it does not
  load the whole file into RAM).
