# Audit cleanup, Groq-first ASR, and split deployment

Date: 2026-08-23
Status: in progress

## Context

Two things drove this plan:

1. An assignment spec ("Meeting Summarizer": audio in → transcript + summary +
   action items; ASR API; backend to store & process; LLM for summary;
   deliverables = repo + README + demo video).
2. A repo-wide over-engineering audit, which found the frontend still carries a
   complete second copy of the AI pipeline that nothing calls any more. The
   Phase 0–7 frontend/backend split moved every write path to the NestJS
   backend but never deleted the Next.js originals.

### Decisions taken before planning

- **Scope**: cut dead code only. Auth, billing, extension, and the Android
  shell stay, even though they exceed the assignment spec.
- **History**: rewrite all 39 commits to drop the `Co-Authored-By: Claude`
  trailer, then force-push to `origin/main`. Explicitly authorised, overriding
  the standing "never force-push" rule.
- **Deploy**: prepare configs and a runbook. The operator runs both deploys.
- **Credentials**: none available this session. Verification is limited to
  install / typecheck / build / unit tests. No end-to-end runtime proof.

### Correction to the original request

There is no Sarvam API in this repository — zero references in any file.
Groq Whisper is already wired as a transcription provider. The real gap is
that the backend prefers **Gemini** for ASR and only falls back to Groq, and
that `GROQ_STT_MODEL` is documented in both env templates and in
`render.yaml` but never read by the code. Task 3 addresses both.

## Audit findings (ranked, biggest cut first)

| # | Tag | Finding | Path |
|---|-----|---------|------|
| 1 | `delete:` | Entire duplicate AI pipeline — superseded by `backend/api/src/ai/*`. Zero live importers once the dead routes below go. | `frontend/web/lib/ai/{transcribe,extract,prompt,mock}.ts` |
| 2 | `delete:` | Five API routes with no callers; every one has a live NestJS equivalent. | `frontend/web/app/api/{transcribe,extension/process,google/export-doc,stripe/checkout,stripe/webhook}/route.ts` |
| 3 | `delete:` | Provider shims that only the dead pipeline imported. | `frontend/web/lib/{openai,gemini,groq,stripe,google,export}.ts` |
| 4 | `delete:` | `processMeeting` + `deleteMeeting` server actions — sole caller is the dead extension route. | `frontend/web/app/actions/meetings.ts` |
| 5 | `delete:` | `updateTask` / `toggleTaskDone` / `archiveTask` — zero callers, superseded by `setTaskDoneViaApi`. | `frontend/web/app/actions/tasks.ts` |
| 6 | `delete:` | `segmentSpeakers` — zero callers anywhere in the repo. | `frontend/web/lib/ai/transcribe.ts:195` |
| 7 | `yagni:` | `DEFAULTS` is never imported; `content.js` and `popup.js` each hardcode their own copy. Its own comment admits it only "documents the contract". | `frontend/extension/config.js` |
| 8 | `delete:` | Language picker survived the commit that removed it — `<select id="m2t-lang">`, the `ASR_LANG` map, and a `language` form field the backend ignores. | `frontend/extension/content.js:63,89,97,117,189` |
| 9 | `yagni:` | `GROQ_STT_MODEL` is set in both env templates and `render.yaml` but no code reads it — `whisper-large-v3` is hardcoded. | `backend/api/src/transcription/transcription.service.ts:112` |

Net: roughly **-1,300 lines, -3 runtime deps** from `frontend/web`
(`openai`, `stripe`, `@google/generative-ai` all become backend-only).

### Requirements coverage against the assignment spec

| Requirement | Status |
|---|---|
| Input: meeting audio files | Met — upload + in-browser record + extension tab capture |
| Output: transcript + summary + action items | Met — `TranscriptionService` + `ExtractionService` |
| Optional frontend | Met — Next.js app, exceeds the ask |
| ASR API integration | Met, but Gemini-first. Task 3 makes Groq Whisper primary |
| Backend to store & process | Met — NestJS + Prisma + Postgres |
| LLM for summary generation | Met — `backend/api/src/ai/prompt.ts` |
| GitHub repo + README | Repo yes; README is stale (Task 5) |
| Demo video | Out of scope for this plan — operator deliverable |

## Tasks

### Task 1 — Dead frontend pipeline is gone

- **Goal**: `frontend/web` contains exactly one implementation of every code
  path, and that implementation is the one that actually runs.
- **Why**: A reviewer grading "code structure" opens `lib/ai/transcribe.ts`,
  reads 210 lines of Whisper language-bootstrap logic, and has no way to know
  it is unreachable. It also makes the repo look like it was generated rather
  than maintained.
- **Files**: delete `frontend/web/lib/ai/{transcribe,extract,prompt,mock}.ts`,
  `frontend/web/lib/{openai,gemini,groq,stripe,google,export}.ts`,
  `frontend/web/app/api/{transcribe,extension/process,google/export-doc,stripe/checkout,stripe/webhook}/`;
  edit `frontend/web/app/actions/{meetings,tasks}.ts`,
  `frontend/web/package.json`.
- **Steps**:
  1. Delete the five dead route directories.
  2. Delete the now-unimported lib modules. Keep `lib/ai/schema.ts` — 7 live
     importers use its types.
  3. Strip the dead server actions; keep `completeOnboarding` and
     `updatePreferences`.
  4. Drop `openai`, `stripe`, and `@google/generative-ai` from web deps.
- **Done when**: `cd frontend/web && npx tsc --noEmit` exits 0, and
  `grep -rn "lib/ai/transcribe\|lib/openai\|lib/groq" frontend/web --include=*.ts --include=*.tsx`
  returns nothing.

### Task 2 — Extension stops sending a parameter the backend ignores

- **Goal**: The extension's UI and payload match the automatic-multilingual
  behaviour the backend actually implements.
- **Why**: Commit `c14ccc0` removed the language picker from the web app and
  `9cff862` dropped the backend's `language` param, but the extension was
  missed. It still renders a language `<select>` that changes nothing.
- **Files**: `frontend/extension/content.js`, `frontend/extension/popup.js`,
  delete `frontend/extension/config.js`.
- **Steps**:
  1. Remove the `<select id="m2t-lang">`, its CSS, the `ASR_LANG` map, and the
     `language` form field.
  2. Pin `recognition.lang` off; let the Web Speech API auto-detect.
  3. Remove `language` from the popup's stored config.
  4. Delete `config.js` (never imported).
- **Done when**: `node --check` passes on every extension `.js`, and
  `grep -rn "language\|m2t-lang" frontend/extension/` returns nothing.

### Task 3 — Groq Whisper is the primary ASR and honours its configured model

- **Goal**: Transcription goes to Groq Whisper first, using the model named by
  `GROQ_STT_MODEL`, with Gemini and OpenAI as ordered fallbacks.
- **Why**: This is the ASR change that was asked for. Today Gemini is tried
  first, and `GROQ_STT_MODEL` is a documented env var that no code path reads —
  so setting it in the Render dashboard silently does nothing.
- **Files**: `backend/api/src/transcription/transcription.service.ts`,
  `backend/api/src/ai/providers.ts`,
  `backend/api/src/transcription/transcription.service.spec.ts`.
- **Steps**:
  1. Export `GROQ_STT_MODEL` from `providers.ts`, defaulting to
     `whisper-large-v3-turbo`.
  2. Use it in `withGroq` instead of the hardcoded string.
  3. Reorder `transcribeChunk`: Groq → Gemini → OpenAI.
  4. Wrap the Groq and OpenAI calls in `withTimeout`, as Gemini already is.
  5. Update the spec to assert the new order (TDD: change the test first).
- **Done when**: `cd backend/api && npx jest` passes, including a test named
  for Groq-primary ordering.

### Task 4 — Comments read as a maintainer wrote them

- **Goal**: Comments explain non-obvious *why*; narration of *what* the next
  line does is gone.
- **Why**: Explicitly requested. Density is already reasonable (~4% backend,
  ~9% in `lib`), so this is targeted editing, not a purge — the tell is style,
  not volume: multi-sentence block comments restating the code.
- **Files**: `backend/api/src/**`, `frontend/web/lib/**`,
  `frontend/extension/*.js`.
- **Steps**: keep comments that record a constraint, a failure mode, or a
  non-obvious ordering. Cut restatements and tutorial asides. Leave doc
  comments on exported functions.
- **Done when**: comment-line count in `backend/api/src` and
  `frontend/web/lib` drops by at least 30%, `tsc --noEmit` still passes in
  both, and no comment spans more than four lines.

### Task 5 — Deploy configs match the Render + Vercel split

- **Goal**: `render.yaml` describes the backend only; the frontend has a
  Vercel config; the two know each other's URLs.
- **Why**: `render.yaml` currently deploys the Next.js app to Render as well,
  which contradicts the chosen topology and would run two frontends. The
  README's stack table is also stale (claims OpenAI `gpt-4o` + `whisper-1`).
- **Files**: `render.yaml`, new `frontend/web/vercel.json`, `README.md`,
  `ARCHITECTURE.md`, both `.env.example` files, new
  `docs/DEPLOYMENT.md`.
- **Steps**:
  1. Drop the `aftermeet` web service from `render.yaml`; keep and complete
     `aftermeet-api` (it is missing every AI, Stripe, Google, and JWT var it
     needs at runtime).
  2. Add `frontend/web/vercel.json`.
  3. Write `docs/DEPLOYMENT.md`: ordered steps, the exact env var per
     dashboard, and the CORS/`NEXT_PUBLIC_API_BASE_URL` handshake.
  4. Correct the README stack table and layout tree.
- **Done when**: `render.yaml` parses as valid YAML with exactly one service,
  and every `process.env.X` read in `backend/api/src` appears either in
  `render.yaml` or in `docs/DEPLOYMENT.md`.

### Task 6 — History carries no Claude attribution

- **Goal**: No commit in `origin/main` contains a `Co-Authored-By: Claude`
  trailer.
- **Why**: Requested. 32 of 39 commits carry it.
- **Files**: git history only.
- **Steps**:
  1. Tag `backup/pre-trailer-strip` at current `HEAD`.
  2. `git filter-branch --msg-filter` (or `git-filter-repo` if present) to
     strip the trailer and any trailing blank line.
  3. Confirm trees are byte-identical to the originals.
  4. Force-push with `--force-with-lease`.
- **Done when**: `git log --format=%B | grep -ci claude` returns 0, and
  `git diff backup/pre-trailer-strip main` is empty.

### Task 7 — Verified build

- **Goal**: Evidence that both halves install, typecheck, build, and test.
- **Why**: The standing rule is that nothing is called done without pasted
  command output. No credentials means this is the ceiling of what can be
  proven.
- **Files**: none.
- **Steps**: `npm install` → `npx tsc --noEmit` → `npx jest` → `npm run build`
  in `backend/api`; `npm install` → `npx tsc --noEmit` → `npm run build` in
  `frontend/web`.
- **Done when**: every command above exits 0, output pasted into the summary.
  A `next build` failure caused solely by a missing `DATABASE_URL` is recorded
  as such, not hidden.

## Explicitly out of scope

- Demo video.
- Any runtime proof requiring a database, Google OAuth client, or Groq key.
- Cutting billing, the extension, or the Android shell (decided against).
