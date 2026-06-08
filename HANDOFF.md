# Aftermeet — Project Handoff & Feature Spec

> Read this top-to-bottom before continuing the project. It documents every
> feature, the architecture, how to run each surface (web / extension / Android),
> how to swap the AI provider to **Gemini**, and **how to store an API key so no
> one can access it**. Status legend: ✅ done · 🟡 coded, needs your keys · 🔭 future.

---

## 0.0 Latest additions (2026-06-08)

- **Supabase backend is now codified** under `supabase/` — drift-free SQL
  migrations (verified against `schema.prisma` with `prisma migrate diff`), an
  RLS lockdown + `updatedAt` triggers, CLI `config.toml`, and a step-by-step
  `supabase/README.md`. This is the "migration detail" — start there to stand up
  the DB. `next build` passes (17 routes); migrations apply cleanly + idempotently.
- **Mobile is now first-class.** The app shell had no navigation below `md`
  (sidebar was `hidden md:flex`). Added a premium bottom tab bar
  (`components/app/mobile-nav.tsx`) with an elevated ember "New meeting" FAB,
  safe-area insets (`viewport-fit=cover` + `env(safe-area-inset-*)`), a mobile
  brand mark in the topbar, and a segmented Output/Tasks/Transcript control for
  the meeting view (`components/workspace/meeting-panels.tsx`) so all three
  panels are usable on a phone. Immersive routes hide the nav for full-screen
  focus (`components/app/nav-routes.ts`). This is what the Capacitor/Android
  shell wraps, so the native app inherits all of it.

---

## 0. TL;DR for whoever continues this

- It's a **Next.js 15 (App Router) + TypeScript** app. Server actions + route
  handlers, Prisma/Postgres, NextAuth (Google), OpenAI (swappable to Gemini),
  Stripe, a **Chrome MV3 extension**, and a **Capacitor/Gradle Android** shell.
- `npm install && npm run dev` boots it. **Without an AI key it runs in demo
  mode** (a local deterministic extractor) so you can click through everything.
- The whole thing **typechecks clean and `next build` passes** (16 routes).
- Secrets live in `.env` (gitignored). The AI key is **server-only** and must
  **never** be put in the browser bundle or the Chrome extension.

---

## 1. Tech stack

| Layer | Choice | Files |
|------|--------|-------|
| Framework | Next.js 15 App Router, React 19, TS | `app/`, `next.config.ts`, `tsconfig.json` |
| Styling | Tailwind v3 + CSS variables + Inter | `tailwind.config.ts`, `app/globals.css` |
| UI primitives | Radix + shadcn-style | `components/ui/*` |
| DB | PostgreSQL (Supabase) + Prisma | `prisma/schema.prisma`, `lib/prisma.ts` |
| Auth | NextAuth v4, Google OAuth, DB sessions | `lib/auth.ts`, `app/api/auth/[...nextauth]/` |
| AI | OpenAI (`gpt-4o` + `whisper-1`) — swappable | `lib/openai.ts`, `lib/ai/*` |
| Payments | Stripe Checkout + webhooks | `lib/stripe.ts`, `app/api/stripe/*` |
| Extension | Chrome Manifest V3 | `extension/*` |
| Mobile | Capacitor + Gradle (Android) | `capacitor.config.ts`, `android/*` |

---

## 2. Directory map

```
app/
  page.tsx                     Landing page (marketing)
  login/                       Google sign-in
  onboarding/                  3-step wizard (wizard.tsx is the client UI)
  (app)/                       Auth-gated shell (sidebar + topbar)
    layout.tsx                 Redirects: no session → /login, no onboarding → /onboarding
    dashboard/                 Stats, pending tasks, insights, recent meetings
    workspace/                 page.tsx = new meeting · [id]/page.tsx = 3-panel view
    history/ settings/ billing/
  extension/                   Public extension install/onboarding page
  actions/                     Server actions: meetings, tasks, onboarding, settings
  api/
    auth/[...nextauth]/        NextAuth handler
    transcribe/                Whisper audio → text
    extension/process/         Extension → extraction (credentialed CORS)
    stripe/checkout/ + webhook/
  error.tsx not-found.tsx      Global elegant error states
components/
  ui/                          Button, Card, Input, Accordion, Dialog, etc. + copy-button
  app/                         sidebar, topbar, page-header, task-row
  workspace/                   new-meeting, transcript-panel, output-panel
  marketing/                   site-nav, site-footer, product-mockup
  brand/ settings/ billing/    logo, preferences-form, upgrade-button
lib/
  ai/  schema.ts prompt.ts extract.ts transcribe.ts mock.ts
  auth.ts prisma.ts openai.ts stripe.ts export.ts plans.ts validations.ts utils.ts
hooks/ use-recorder.ts
prisma/schema.prisma
types/next-auth.d.ts
extension/   (see §7 and extension/README.md)
android/     (see §8 and android/README.md)
```

---

## 3. Feature inventory (detailed)

### 3.1 Landing page ✅
- **File:** `app/page.tsx` + `components/marketing/*`.
- Sections: hero with copy "Turn meetings into execution", animated **product
  mockup** (`product-mockup.tsx` — static 3-panel render), trust strip, features
  grid (6), Chrome extension showcase with a dark panel mock, 3-step workflow,
  testimonials, pricing (from `lib/plans.ts`), FAQ accordion, dark CTA, footer.
- Floating translucent navbar (`site-nav.tsx`) that solidifies on scroll.
- **Continue:** wire real testimonials/logos; add OG images; analytics.

### 3.2 Auth (Google OAuth) 🟡 (needs Google creds)
- **Files:** `lib/auth.ts`, `app/login/`, `app/api/auth/[...nextauth]/route.ts`,
  `types/next-auth.d.ts`.
- One-click Google sign-in. DB sessions via Prisma adapter (30-day).
- **On first login** (`events.createUser`): provisions a personal `Workspace`,
  `Membership` (OWNER), `Billing` (FREE, 10 meetings), and `UserPreference` in a
  transaction. Session exposes `user.id` + `onboardingCompleted`.
- **Continue:** add more providers if needed; team invites; account deletion.

### 3.3 Onboarding ✅
- **Files:** `app/onboarding/page.tsx` + `wizard.tsx`, `app/actions/onboarding.ts`.
- 3 steps: use-case (single), platforms (multi), AI priority (single). Saved to
  `UserPreference`; `priority` feeds the AI prompt. Progress dots, validated
  per-step, optimistic finish.

### 3.4 Dashboard ✅
- **File:** `app/(app)/dashboard/page.tsx` (+ `loading.tsx` skeleton).
- Stat cards (meetings, open tasks, completed, productivity %), pending action
  items (interactive `task-row.tsx`), AI insight blurb, upcoming deadlines,
  recent meetings list. All data via parallel Prisma queries.

### 3.5 Meeting workspace — THE CORE ✅ / 🟡(audio needs key)
- **New meeting:** `components/workspace/new-meeting.tsx`, `app/(app)/workspace/page.tsx`.
  Three input modes via tabs:
  - **Paste** (textarea + sample transcript button)
  - **Upload** (.txt/.vtt/.srt read client-side; audio → `/api/transcribe`)
  - **Record** (mic via `hooks/use-recorder.ts` → `/api/transcribe`)
  - "Generate" calls `processMeeting` server action → redirects to the meeting.
- **Meeting view:** `app/(app)/workspace/[id]/page.tsx` — 3 panels:
  - Left: transcript with speaker parsing (`transcript-panel.tsx`)
  - Center: AI output accordions (`output-panel.tsx`) — Summary, Key Decisions,
    Action Items, Deadlines, Risks, Follow-up Email, **Meeting Minutes**.
  - Right: task cards (`task-row.tsx`) with quote, assignee, due, confidence.
- **Exports** (`lib/export.ts`): copy, Markdown download, **print-to-PDF**,
  mailto for the follow-up email.

### 3.6 Task engine ✅
- **Files:** `app/actions/tasks.ts`, `components/app/task-row.tsx`.
- Tasks carry assignee, due date, urgency, **confidence score**, **source quote**.
- Toggle complete (optimistic), archive, edit (schema in `lib/validations.ts`).
  Ownership enforced server-side on every mutation.
- **Continue:** inline edit UI for assignee/due; bulk actions; calendar export.

### 3.7 Meeting Minutes (MoM) ✅
- Structured: title, participants, date, agenda, discussion, decisions, action
  items, next meeting, notes. Rendered in `output-panel.tsx`; Markdown/PDF/copy.

### 3.8 AI extraction engine ✅ (demo) / 🟡 (real needs key) — see §6
- **Files:** `lib/ai/schema.ts` (Zod + JSON-schema), `prompt.ts`, `extract.ts`,
  `transcribe.ts`, `mock.ts`.
- Enforced JSON output, Zod validation, retry w/ backoff, confidence scoring,
  "never invent tasks/dates", decisions-vs-discussion separation.
- **Demo mode** (`mock.ts`) runs with no key for full end-to-end clickthrough.

### 3.9 Billing 🟡 (needs Stripe)
- **Files:** `app/(app)/billing/page.tsx`, `lib/stripe.ts`,
  `app/api/stripe/checkout/route.ts`, `webhook/route.ts`, `lib/plans.ts`.
- FREE (10 meetings) vs PRO (unlimited). Checkout session, webhook syncs plan +
  limits, usage meter, plan-limit enforcement in `processMeeting`.
- **Continue:** Stripe customer portal route; annual pricing; proration.

### 3.10 Settings ✅
- `app/(app)/settings/page.tsx` — profile (from Google), AI priority + email
  tone (`preferences-form.tsx` → `app/actions/settings.ts`), sign out.

### 3.11 Chrome extension 🟡 — see §7
### 3.12 Android shell 🟡 — see §8

### 3.13 Cross-cutting ✅
- Security headers + CSP (`next.config.ts`), toast system (sonner), skeletons,
  empty states (`components/empty-state.tsx`), 404/error pages, activity logging.

### 3.14 Suggested roadmap 🔭
- Real-time streaming transcription (replace accumulate-then-send in offscreen).
- Inline task editing + drag reorder; Slack/Notion/Linear push of action items.
- Team workspaces + invites + roles (schema already supports `WorkspaceRole`).
- Search (topbar input is a stub); semantic search over transcripts (pgvector).
- Customer portal; usage analytics; email digests.

---

## 4. Data model (Prisma)

`prisma/schema.prisma` defines: `User`, `Account`, `Session`,
`VerificationToken`, `UserPreference`, `Workspace`, `Membership`, `Meeting`,
`Transcript`, `TranscriptChunk`, `AiOutput`, `Task`, `Billing`,
`ExtensionSession`, `ActivityLog`. JSON columns hold decisions/risks/deadlines/MoM.
Enums: `WorkspaceRole`, `MeetingSource`, `MeetingStatus`, `TaskStatus`,
`TaskUrgency`, `Plan`. Indices on the common query paths.

---

## 5. How to RUN it

### 5.1 Web app (local)
```bash
cd ~/meeting-to-tasks
npm install
cp .env.example .env          # fill in values (see below); leave AI key blank for demo mode
npm run db:generate           # prisma client
npm run db:push               # create tables in your Postgres
npm run dev                   # http://localhost:4000
```
- **Demo mode:** if no AI key is set, transcripts are processed by a local
  extractor — everything works except real-quality output and audio transcription.
- Scripts: `npm run build | start | typecheck | db:studio | db:migrate`.

### 5.2 Minimum env to be fully live (`.env`)
```
DATABASE_URL=...          # Supabase pooled URL (?pgbouncer=true)
DIRECT_URL=...            # Supabase direct URL (migrations)
NEXTAUTH_SECRET=...       # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:4000
GOOGLE_CLIENT_ID=...      # Google Cloud → OAuth client (Web)
GOOGLE_CLIENT_SECRET=...
OPENAI_API_KEY=...        # or GEMINI_API_KEY after the swap in §6
STRIPE_SECRET_KEY=...     # optional
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=...
NEXT_PUBLIC_APP_URL=http://localhost:4000
```
- **Google OAuth setup:** Google Cloud Console → APIs & Services → Credentials →
  Create OAuth client ID → *Web application*. Authorized redirect URI:
  `http://localhost:4000/api/auth/callback/google` (and your prod URL). Put the
  client id/secret in `.env`.

### 5.3 Deploy (Vercel)
- Import the repo, add all env vars in **Project → Settings → Environment
  Variables**, set `NEXTAUTH_URL` + `NEXT_PUBLIC_APP_URL` to the prod domain,
  add the prod redirect URI in Google. Stripe webhook endpoint:
  `https://yourdomain/api/stripe/webhook` (copy its signing secret into env).

---

## 6. Using GEMINI instead of OpenAI

The AI layer is isolated, so swapping providers is a small, contained change.

### 6.1 Get a key
- Go to **Google AI Studio → API keys** (`aistudio.google.com/apikey`), create a
  key. (Or use Vertex AI for enterprise/GCP-native auth — different setup.)

### 6.2 Install the SDK
```bash
npm install @google/generative-ai
```

### 6.3 Add a Gemini client (`lib/gemini.ts`)
```ts
import { GoogleGenerativeAI } from "@google/generative-ai";

let client: GoogleGenerativeAI | null = null;
export function gemini() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client;
}
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
export function isAiConfigured() { return Boolean(process.env.GEMINI_API_KEY); }
```

### 6.4 Swap the call in `lib/ai/extract.ts`
Gemini supports structured output via `responseMimeType: "application/json"` +
`responseSchema`. Keep the existing `extractionSchema` Zod validation:
```ts
const model = gemini().getGenerativeModel({
  model: GEMINI_MODEL,
  generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  systemInstruction: SYSTEM_PROMPT,
});
const res = await model.generateContent(buildUserPrompt({ ...input, transcript: clipped }));
const parsed = extractionSchema.parse(JSON.parse(res.response.text()));
```
- Update `isAiConfigured()` imports (currently from `lib/openai.ts`) to the
  Gemini one in `app/actions/meetings.ts` and `app/api/transcribe/route.ts`.
- **Transcription:** Whisper is OpenAI-only. With Gemini, either keep OpenAI just
  for `/api/transcribe`, or send audio to a Gemini multimodal model, or use
  Google Cloud Speech-to-Text. Simplest: keep both keys, OpenAI for audio.
- Add to `.env` / `.env.example`: `GEMINI_API_KEY=` and `GEMINI_MODEL=gemini-2.0-flash`.

---

## 7. Chrome extension — create, load, publish

The extension lives in `extension/` and is already a working MV3 skeleton
(manifest, service worker, offscreen recorder, content-script floating panel,
popup, icons). Full architecture is in `extension/README.md`.

### 7.1 What it does
Detects Zoom/Google Meet tabs → floating panel → **Start AI Notes** captures tab
audio (via offscreen `MediaRecorder`) + shows a live Web-Speech transcript → on
stop, posts audio to **your** `/api/transcribe`, then the transcript to
`/api/extension/process`, which runs the same extraction engine and returns tasks.

### 7.2 Load it in development
1. Run the web app (`npm run dev`) and **sign in** at `http://localhost:4000/login`.
   (The extension reuses the web session cookie — no separate login.)
2. Open `chrome://extensions`, toggle **Developer mode** (top-right).
3. Click **Load unpacked** → select the `extension/` folder.
4. Open a Google Meet or Zoom call → the panel appears bottom-right.

### 7.3 Point it at your deployment (prod)
Edit `APP_ORIGIN` in **three** places to your HTTPS domain, and add the domain to
`host_permissions` in `manifest.json`:
- `extension/config.js`
- `extension/content.js` (inlined — content scripts can't import)
- `extension/popup.js`
> HTTPS is required in prod for mic + cookies. Also update the allowed-origin
> regex in `app/api/extension/process/route.ts` if you add domains.

### 7.4 Publish to the Chrome Web Store
1. Replace `extension/icons/*.png` with real brand icons (16/32/128).
2. Bump `version` in `manifest.json`.
3. Zip the **contents** of `extension/` (not the parent folder):
   `cd extension && zip -r ../meeting-to-tasks-ext.zip . -x "*.DS_Store"`.
4. Create a **Chrome Web Store developer account** (one-time $5) at
   `chrome.google.com/webstore/devconsole`.
5. **New item** → upload the zip → fill listing (description, screenshots,
   privacy policy URL, permissions justification for `tabCapture`/`offscreen`).
6. Submit for review. Updates = upload a higher-version zip.

> Note: `tabCapture` + audio capture get extra review scrutiny. Have a clear
> privacy policy and justification ready.

---

## 8. Android (Capacitor + Gradle)

Thin native WebView wrapper around the web app — see `android/README.md`.
```bash
npm install
export CAP_SERVER_URL="https://your-app.vercel.app"   # prod: wrap the live app over HTTPS
npx cap add android        # first time: generates gradle wrapper + glue (binary, not committed)
npx cap sync android
npx cap open android        # Android Studio, or: cd android && ./gradlew assembleDebug
```
Offline/static demo bundle instead: `BUILD_TARGET=capacitor npm run build` (Next
switches to `output: export` → `/out`), then `npx cap sync`.

---

## 9. 🔐 API KEY SECURITY — store it so no one can access it

This is the part to get right. The cardinal rule:

> **The AI key (Gemini or OpenAI) is a SERVER secret. It must never reach the
> browser, the Chrome extension, or any committed file.**

### 9.1 Where the key lives
- In **`.env`** locally and in **Vercel Environment Variables** in prod. Nothing
  else. `.env` is already in `.gitignore` — never commit it. Only `.env.example`
  (no real values) is committed.
- Name it `GEMINI_API_KEY` — **NOT** `NEXT_PUBLIC_GEMINI_API_KEY`. In Next.js,
  **any var prefixed `NEXT_PUBLIC_` is inlined into the browser bundle** and is
  publicly readable. The AI key must NOT have that prefix. (That's why public,
  non-secret values like the Stripe *price id* and app URL use `NEXT_PUBLIC_`,
  but secret keys never do.)

### 9.2 Why it's safe in this codebase
- The key is only read inside server-only code: `lib/ai/extract.ts` and
  `lib/ai/transcribe.ts` both start with `import "server-only"`, which makes the
  build **fail** if they're ever imported into a client component. Calls happen
  in **server actions** (`app/actions/*`) and **route handlers** (`app/api/*`),
  which run on the server only.
- The Chrome extension **never sees the key**. It calls *your* backend
  (`/api/transcribe`, `/api/extension/process`); your backend holds the key and
  talks to the AI provider. The extension only carries the user's session cookie.
  Never paste the AI key into any `extension/` file.

### 9.3 Lock the key down at the provider
- **Google AI Studio / Cloud Console → Credentials → your API key → Edit:**
  - **API restrictions:** restrict the key to only the *Generative Language API*
    (and Speech-to-Text if you use it). A leaked, restricted key can't be used
    for anything else.
  - **Application restrictions:** since calls come from your server, restrict by
    server IP if you have static egress IPs. (Don't use HTTP-referrer
    restrictions — those are for browser keys, which you are not using.)
  - Set **quotas / budget alerts** so a leak can't run up unbounded cost.

### 9.4 Operational hygiene
- **Rotate** keys periodically and immediately if one is ever exposed (revoke +
  create new in the console, update Vercel env, redeploy).
- Keep **separate keys** for dev vs prod.
- Add a server-side **rate limit** on `/api/transcribe` and
  `/api/extension/process` (e.g. Upstash Redis) so a stolen session can't abuse
  your quota. (Currently enforced only via the FREE plan meeting limit.)
- Never log the key. Never paste it in chat, screenshots, or commits. If it lands
  in git history, rotate it — removing the commit is not enough.
- On Vercel, env vars are **encrypted at rest** and only exposed to the build/
  runtime — that's the correct store. Do not hardcode keys anywhere in source.

### 9.5 Quick self-audit checklist
- [ ] `.env` is gitignored and **not** in `git log`.
- [ ] AI key var has **no** `NEXT_PUBLIC_` prefix.
- [ ] `grep -ri "GEMINI_API_KEY\|OPENAI_API_KEY" extension/` returns **nothing**.
- [ ] AI SDK is only imported under `lib/ai/*` / `app/api/*` / `app/actions/*`.
- [ ] Provider key has API restrictions + budget alerts enabled.
- [ ] Prod and dev use different keys.

---

## 10. Known gotchas
- Next 15.1.3 has a flagged CVE — bump to the latest 15.x patch before prod.
- Android `gradle-wrapper.jar` is binary and generated by `npx cap add android`;
  it's intentionally not in the repo.
- Whisper is OpenAI-only; plan audio transcription accordingly if going
  Gemini-only (§6.4).
- The topbar search and "Extension: not connected" badge are UI stubs — wire up
  when you build search and an extension-connected ping.
```
