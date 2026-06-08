# Architecture — three frontends, one backend

Aftermeet ships **three client surfaces** that all talk to **one backend**.
The backend is the source of truth; every client is a thin frontend over it.

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
# 1. Backend DB: provision Supabase, apply supabase/migrations/* (see supabase/README.md)
# 2. Env: cp .env.example .env  and fill DATABASE_URL / DIRECT_URL (+ optional keys)
npm install
npm run db:generate
npm run dev            # website + app + API on http://localhost:4000

npm run ext:build      # → extension/dist/*.zip  (load unpacked from extension/)
npm run cap:sync       # → Android shell of the deployed app
```

See `HANDOFF.md` for the full feature inventory, AI provider swap, and key
security; see `supabase/README.md` for database setup.
