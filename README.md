# Aftermeet

**Turn meetings into execution.** Drop in meeting audio — or a pasted transcript
— and get back a clean transcript, a summary, and the things that actually need
doing: action items with owners and dates, decisions, risks, a follow-up email,
and formatted Meeting Minutes.

Three surfaces share one backend: a **web app**, a **Chrome extension** that
runs inside Zoom and Google Meet, and an **Android** shell.

> Built to feel like Linear / Notion / Superhuman — not a chatbot. There is no
> chat box anywhere. Intelligence is embedded in the workflow.

---

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript |
| Backend | NestJS 11 — owns every write path and all AI |
| UI | Tailwind CSS + shadcn-style primitives (Radix) + Inter |
| Data | PostgreSQL (Supabase) + Prisma ORM |
| Auth | NextAuth v4 — Google OAuth only; the backend takes a short-lived HS256 bearer minted from that session |
| Speech-to-text | Groq Whisper (`whisper-large-v3-turbo`), with Gemini and OpenAI Whisper as fallbacks |
| Summarisation | Groq `llama-3.3-70b-versatile` / Gemini `gemini-2.0-flash` |
| Audio prep | ffmpeg (`ffmpeg-static`) — normalise + segment |
| Payments | Stripe Checkout + webhooks |
| Mobile | Capacitor + Gradle (Android) |
| Extension | Chrome MV3 (tabCapture + offscreen) |

---

## How a meeting becomes tasks

```
audio ──► POST /transcribe  (NestJS)
            │
            ├─ ffmpeg: normalise to mono 16 kHz MP3, split into 5-min chunks
            ├─ per chunk, up to 4 at a time: Groq Whisper ─► Gemini ─► OpenAI Whisper
            ├─ stitch chunks back in order
            └─ refine: LLM adds punctuation and speaker labels, windowed so
               nothing is dropped on long calls
            │
            ▼
       transcript ──► POST /meetings  (NestJS)
            │
            ├─ extraction: strict JSON schema, Zod-validated, retried on failure
            └─ persist Meeting + Transcript + AiOutput + Task rows in one transaction
```

Nothing is pinned to a language. Chunks are transcribed with auto-detect, which
handles code-switching — a sentence that starts in Tamil and ends in English
stays that way instead of being flattened to one language.

A chunk that fails every engine twice becomes `[unintelligible segment]` rather
than failing the whole transcript, so one bad minute of a two-hour call costs
you one minute.

---

## Project layout

```
frontend/
  web/                     Next.js app — UI, auth, and reads
    app/
      page.tsx             Landing
      login/  onboarding/
      (app)/               Authenticated shell
        dashboard/  workspace/  history/  settings/  billing/
      actions/             Server actions (onboarding, settings)
      api/
        auth/[...nextauth]/  NextAuth
        token/               Mints the backend bearer
        extension/session/   Extension session ping
    components/  lib/  hooks/
    android/  mobile/      Capacitor Android shell
  extension/               Chrome MV3 extension
backend/
  api/                     NestJS — transcription, extraction, tasks, billing, export
    src/
      transcription/       ffmpeg chunking + multi-engine ASR + refine
      ai/                  prompt, schema, extraction, providers, retry, timeout
      meetings/  tasks/  dashboard/  extension/  google/  billing/  auth/
  prisma/schema.prisma     Data model
  supabase/                Migrations + config
```

The frontend holds no AI code and no provider keys. It renders, authenticates,
and reads; the backend does the work.

> `backend/api/prisma/schema.prisma` is a deliberate copy of
> `backend/prisma/schema.prisma`. Prisma resolves its client output from the
> schema's own directory, so sharing one file would generate into the repo root
> instead of the backend package. Model changes go in both.

---

## Quick start

Two processes. Backend first — the frontend calls it on load.

```bash
# terminal 1 — backend on :4001
cd backend/api
npm install
cp .env.example .env          # fill in DATABASE_URL, DIRECT_URL, API_JWT_SECRET, GROQ_API_KEY
npm run start:dev

# terminal 2 — frontend on :4000
cd frontend/web
npm install
cp .env.example .env          # same DB + the SAME API_JWT_SECRET, plus Google OAuth
npm run db:push               # create the schema
npm run dev
```

`API_JWT_SECRET` must be byte-identical in both files or every backend call
returns 401. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Check the wiring:

```bash
curl localhost:4001/health
# {"status":"ok","db":"up","ai":"up"}
```

### Demo mode

With no AI key the backend falls back to a deterministic local extractor, so you
can click through the whole product with a pasted transcript. Audio
transcription is the one feature that genuinely needs a key — Groq's free tier
covers it.

---

## The AI engine

`backend/api/src/ai/` holds the whole thing. `extraction.service.ts` enforces a
strict JSON-schema response, validates it with Zod, and retries with backoff.
The system prompt (`ai/prompt.ts`) is tuned to:

- never invent tasks, owners, or dates,
- separate **decisions** (committed) from **discussion** (explored),
- attach a **confidence score** and a **source quote** to every action item,
- emit a ready-to-send follow-up email and clean Meeting Minutes.

Every provider call is wrapped in a timeout — the Gemini SDK has none of its own
— and falls through to the next engine rather than failing the request.

Exports: copy, Markdown, print-to-PDF, and Google Docs.

---

## Deployment

Backend on Render, frontend on Vercel. The two reference each other's URLs, so
the order matters — see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the
full runbook, the env var table per dashboard, and the CORS handshake.

---

## Tests

```bash
cd backend/api
npm test                   # unit: chunking, transcription ordering, provider fallback
npm run test:e2e           # HTTP: auth, health, transcription, extraction, domain
npm run typecheck

cd frontend/web
npm run typecheck
```

---

## Status

| Area | State |
|------|-------|
| Design system, pages, navigation | Complete |
| Auth (Google), workspace provisioning, onboarding | Complete — needs Google + DB creds |
| Audio → transcript (chunked, multilingual) | Complete — needs `GROQ_API_KEY` |
| Transcript → tasks / decisions / MoM / email | Complete — real with a key, demo without |
| Tasks, exports, Google Docs | Complete |
| Stripe checkout + webhook + plan limits | Complete — needs Stripe keys |
| Chrome extension (MV3 capture) | Loadable unpacked; set `appOrigin` + `apiBase` in the popup |
| Android Gradle shell | Config checked in; `npx cap add android` to generate the wrapper |

---

## Security

CSP and security headers (`next.config.ts`); CORS restricted to the configured
frontend origin plus `meet.google.com` / `*.zoom.us` for the extension;
short-lived HS256 bearers rather than shared cookies across origins;
server-side ownership checks on every meeting and task mutation; uploads
streamed to disk with a 200 MB cap and deleted after processing.
