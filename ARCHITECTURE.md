# Architecture — three frontends, one backend

Aftermeet ships **three client surfaces** that all talk to **one backend**.
The backend is the source of truth; every client is a thin frontend over it.

> **Migration status (2026-06).** The backend has been extracted into a
> standalone **NestJS** service at `backend/api/` (Render), with the Next.js app
> as the frontend (Vercel). Auth bridges the existing NextAuth+Google login via a
> short-lived HS256 app JWT (`/api/token` → backend `JwtAuthGuard`), shared
> `API_JWT_SECRET`. Spec: `docs/superpowers/specs/2026-06-15-frontend-backend-split-design.md`.
>
> **Done & on the backend** (all bearer-guarded, 19 e2e tests):
> auth/`/me`, meetings (list/get/delete/**process** = full AI pipeline), tasks,
> **transcription** (`/transcribe` + `/languages`, 45-language two-tier Whisper/Gemini
> with full `large-v3` for non-English), extension (`/extension/process` + `/session`),
> billing (Stripe checkout + raw-body webhook), Google Docs export.
>
> **Frontend write paths repointed** to the backend (create meeting, transcribe,
> task toggle, checkout, export). Reads still render server-side from the shared
> Supabase DB on the monolith — seamless because both hit the same database.
>
> **Remaining cutover (needs live login + the real Vercel/Render deploy):**
> 1. Repoint server-rendered reads (dashboard/history/workspace/settings/billing)
>    to the backend via a server-side token client.
> 2. Repoint the topbar extension-status poll to `<backend>/extension/session`.
> 3. After (1)+(2) verify in a logged-in session, delete the now-superseded
>    monolith routes: `app/api/{transcribe,extension/*,stripe/*,google/export-doc}`
>    and `app/actions/{meetings,tasks}` (keep `app/api/auth/*` and `app/api/token`).
> 4. Point the Stripe webhook at `<backend>/billing/webhook`; set the backend
>    Render env vars (see `backend/api/.env.example`).

> **Repo layout.** Client code lives under `frontend/` (`frontend/web/` is the
> Next.js app that *also* hosts the backend; `frontend/extension/` is the Chrome
> extension). The shared data layer lives under `backend/` (`backend/prisma/`,
> `backend/supabase/`). Paths below are written relative to `frontend/web/` unless
> prefixed (e.g. `backend/prisma/schema.prisma`).

```
                       ┌──────────────────────────────────────────┐
   3 FRONTENDS         │                ONE BACKEND                │
                       │                                           │
  ┌───────────────┐    │   Next.js server (app/api + app/actions)  │
  │  WEBSITE      │────┤        │                                  │
  │  app/page.tsx │    │        ▼                                  │
  │  + marketing  │    │   Prisma  ──────────►  Supabase Postgres  │
  └───────────────┘    │   (lib/prisma.ts)      (supabase/*)       │
                       │        ▲                                  │
  ┌───────────────┐    │        │   NextAuth (Google)              │
  │  APP (mobile) │────┤        │   OpenAI / Gemini (lib/ai)        │
  │  android/ +   │    │        │   Stripe                         │
  │  (app)/ routes│    │        │                                  │
  └───────────────┘    │                                           │
                       │                                           │
  ┌───────────────┐    │                                           │
  │  EXTENSION    │────┤   /api/transcribe                         │
  │  extension/   │    │   /api/extension/process                  │
  │  (Chrome MV3) │    │   /api/extension/session                  │
  └───────────────┘    └──────────────────────────────────────────┘
```

## The one backend

Everything server-side lives in the Next.js app and is shared by all clients:

| Concern        | Where                                   |
|----------------|-----------------------------------------|
| Database       | **Supabase Postgres** via Prisma (`supabase/`, `prisma/schema.prisma`, `lib/prisma.ts`) |
| Auth           | NextAuth + Google, DB sessions (`lib/auth.ts`, `app/api/auth/*`) |
| AI extraction  | `lib/ai/*` (provider-swappable; demo mode with no key) |
| Server actions | `app/actions/*` (meetings, tasks, settings, onboarding) |
| HTTP API       | `app/api/*` (transcribe, extension/process, extension/session, stripe/*) |

The DB is described once in `prisma/schema.prisma` and mirrored exactly in
`supabase/migrations/*` — see `supabase/README.md` to provision it. All three
clients read/write the same rows through this one server, so they stay in sync
automatically (a task created from the extension shows up on the website and the
mobile app, because there is only one database).

## The three frontends

### 1. Website (marketing)
- `app/page.tsx` + `components/marketing/*` + `app/extension/page.tsx`.
- Public, unauthenticated. Sells the product, links into the app.

### 2. App
- **Web app**: auth-gated `app/(app)/*` (dashboard, workspace, history, settings,
  billing) rendered by the same Next.js server.
- **Mobile app**: `android/` — a Capacitor WebView shell that loads the deployed
  web app over HTTPS (`capacitor.config.ts`, `CAP_SERVER_URL`). One codebase,
  native wrapper. Build: `npm run cap:sync`.

### 3. Extension (Chrome MV3)
- `extension/*`. Captures Zoom/Meet audio, transcribes live, and posts to the
  **same backend** (`/api/transcribe`, `/api/extension/process`,
  `/api/extension/session`). Reuses the web session cookie — no separate login.
- Point it at your backend by editing `APP_ORIGIN` in `extension/config.js`,
  `extension/content.js`, `extension/popup.js`. Package: `npm run ext:build`.

## How the clients stay synced to the backend

| Client    | Talks to backend via                  | Auth                       |
|-----------|---------------------------------------|----------------------------|
| Website   | server components / actions (in-proc) | public                     |
| Web app   | server actions + `app/api/*`          | NextAuth session cookie    |
| Mobile    | same web app over HTTPS (WebView)     | NextAuth session cookie    |
| Extension | `fetch` to `app/api/*` (CORS)         | shared NextAuth cookie     |

The extension also reports a live capture session to `/api/extension/session`,
which lights up the **"Extension: connected"** badge in the web app topbar — a
concrete demonstration that all three surfaces share one backend.

## Run it

```bash
# 1. Backend DB: provision Supabase, apply backend/supabase/migrations/* (see backend/supabase/README.md)
# 2. Env: cd frontend/web && cp .env.example .env  and fill DATABASE_URL / DIRECT_URL (+ optional keys)
cd frontend/web        # the Next.js app (frontend + backend) is one npm package here
npm install
npm run db:generate
npm run dev            # website + app + API on http://localhost:4000

npm run ext:build      # → ../extension/dist/*.zip  (load unpacked from frontend/extension/)
npm run cap:sync       # → Android shell of the deployed app
```

See `HANDOFF.md` for the full feature inventory, AI provider swap, and key
security; see `supabase/README.md` for database setup.
