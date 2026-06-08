# Aftermeet

**Turn meetings into execution.** A calm, premium workspace that reads meeting
transcripts and hands back the things that matter — action items, decisions,
deadlines, risks, follow-up emails, and professional Meeting Minutes — across
**web**, a **Chrome extension**, and an **Android** shell.

> Built to feel like Linear / Notion / Superhuman — not a chatbot. There is no
> chat box anywhere. Intelligence is embedded in the workflow.

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| UI | Tailwind CSS + shadcn-style primitives (Radix) + Inter |
| Data | PostgreSQL (Supabase) + Prisma ORM |
| Auth | NextAuth v4 — Google OAuth only (Prisma adapter, DB sessions) |
| AI | OpenAI (`gpt-4o` extraction + `whisper-1` transcription) |
| Audio | MediaRecorder + Web Speech API + Whisper |
| Payments | Stripe Checkout + webhooks |
| Mobile | Capacitor + Gradle (Android) |
| Extension | Chrome MV3 (tabCapture + offscreen) |

---

## Project layout

```
app/
  page.tsx                 Landing page
  login/                   Google sign-in
  onboarding/              3-step wizard
  (app)/                   Authenticated shell (sidebar + topbar)
    dashboard/             Stats, pending tasks, insights, recent meetings
    workspace/             New meeting + 3-panel meeting view ([id])
    history/  settings/  billing/
  extension/               Extension install/onboarding page
  actions/                 Server actions (meetings, tasks, onboarding, settings)
  api/
    auth/[...nextauth]/    NextAuth
    transcribe/            Whisper endpoint
    extension/process/     Extension → extraction (credentialed CORS)
    stripe/{checkout,webhook}/
components/                 ui/ (primitives), app/, workspace/, marketing/, brand/
lib/
  ai/                      schema (zod + json-schema), prompt, extract, transcribe, mock
  auth.ts prisma.ts openai.ts stripe.ts export.ts plans.ts validations.ts utils.ts
prisma/schema.prisma       Full data model
extension/                 Chrome MV3 extension (see extension/README.md)
android/                   Capacitor Android shell (see android/README.md)
capacitor.config.ts
```

---

## Quick start

```bash
npm install
cp .env.example .env          # fill in values (see below)
npm run db:generate
npm run db:push               # push schema to your Postgres
npm run dev                   # http://localhost:4000
```

### Demo mode (no keys)
Without `OPENAI_API_KEY` the app runs in **demo mode**: a deterministic local
extractor produces realistic tasks/summary/MoM from your pasted transcript, so
you can click through the entire product end-to-end. Audio transcription is the
only feature that needs a real key.

### Environment
See [`.env.example`](.env.example). To go fully live you need:
- **Supabase Postgres** → `DATABASE_URL`, `DIRECT_URL`
- **Google OAuth** → `GOOGLE_CLIENT_ID/SECRET` (redirect URI `…/api/auth/callback/google`)
- **NextAuth** → `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `NEXTAUTH_URL`
- **OpenAI** → `OPENAI_API_KEY`
- **Stripe** (optional) → `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY`

---

## The AI engine

`lib/ai/extract.ts` enforces a strict JSON-schema response, validates it with
Zod, and retries with backoff. The system prompt (`lib/ai/prompt.ts`) is tuned to:

- never invent tasks, owners, or dates,
- separate **decisions** (committed) from **discussion** (explored),
- attach a **confidence score** and a **source quote** to every action item,
- emit a ready-to-send follow-up email and a clean MoM.

Every meeting persists a `Transcript`, an `AiOutput`, and individual `Task`
rows. Exports: copy, Markdown download, and print-to-PDF (`lib/export.ts`).

---

## Surfaces

- **Web** — the full product. Paste / upload / record → analyze → manage tasks.
- **Chrome extension** — live notes inside Zoom & Google Meet. See
  [`extension/README.md`](extension/README.md).
- **Android** — Capacitor WebView shell. See [`android/README.md`](android/README.md).

---

## What's wired vs. what needs your keys

| Area | Status |
|------|--------|
| Design system, all pages, navigation | ✅ Complete |
| Auth (Google), workspace provisioning, onboarding | ✅ Code complete — needs Google + DB creds |
| Transcript → tasks/decisions/MoM/email | ✅ Complete (real with `OPENAI_API_KEY`, demo without) |
| Tasks (complete/edit/archive), exports | ✅ Complete |
| Stripe checkout + webhook + plan limits | ✅ Code complete — needs Stripe keys |
| Whisper upload/record transcription | ✅ Code complete — needs `OPENAI_API_KEY` |
| Chrome extension (MV3 capture pipeline) | ✅ Loadable unpacked; point `APP_ORIGIN` at your app |
| Android Gradle shell | ✅ Config checked in; run `npx cap add android` to generate wrapper, then build |

---

## Scripts

```bash
npm run dev / build / start
npm run typecheck          # tsc --noEmit
npm run db:push / db:studio / db:migrate
npx cap sync               # sync web build into native shells
```

## Security

CSP + security headers (`next.config.ts`), credentialed CORS scoped to
Meet/Zoom for the extension endpoint, server-side ownership checks on every
task/meeting mutation, sanitized transcript storage, HTTPS-only WebView.
