# Architecture — three frontends, one backend

Aftermeet ships **three client surfaces** over **one NestJS backend**. The
backend is the source of truth: it owns the database, every write, and all AI.
The clients render and authenticate.

```
   3 FRONTENDS                          ONE BACKEND (NestJS, :4001)

  ┌────────────────┐                   ┌──────────────────────────────┐
  │ WEB            │  bearer JWT       │  /transcribe   ffmpeg + ASR  │
  │ Next.js        │──────────────────►│  /meetings     extraction    │
  │ (Vercel)       │                   │  /tasks  /dashboard  /me     │
  └────────────────┘                   │  /extension/{process,session}│
                                       │  /billing/{checkout,webhook} │
  ┌────────────────┐                   │  /google/export-doc          │
  │ ANDROID        │  WebView of the   │  /health                     │
  │ Capacitor      │  deployed web app │             │                │
  └────────────────┘                   │             ▼                │
                                       │  Prisma ──► Supabase Postgres│
  ┌────────────────┐  bearer JWT       │             ▲                │
  │ EXTENSION      │──────────────────►│             │                │
  │ Chrome MV3     │                   └─────────────┼────────────────┘
  └────────────────┘                                 │
                                                     │
        Next.js also reads this DB directly for server-rendered pages
```

## The split

The backend was extracted from what began as a Next.js monolith. The frontend
keeps exactly two API routes:

| Route | Why it stays |
|---|---|
| `app/api/auth/[...nextauth]` | NextAuth needs a same-origin callback |
| `app/api/token` | Mints the short-lived HS256 bearer the backend verifies |

Everything else — transcription, extraction, tasks, billing, Docs export,
extension endpoints — lives in `backend/api/`.

### Auth across the boundary

Cookies do not cross origins, so the extension and the deployed frontend cannot
share a NextAuth session cookie with the backend. Instead:

1. The user signs in with Google; NextAuth writes a DB session as usual.
2. `/api/token` signs a 5-minute HS256 JWT with `API_JWT_SECRET`.
3. The client sends it as `Authorization: Bearer …`.
4. The backend's `JwtAuthGuard` verifies it with the same shared secret and
   attaches the principal via `@CurrentUser()`.

`lib/api-client.ts` does this for browser code; `lib/server-api.ts` signs
directly from the session for React Server Components, skipping the round trip.

The extension gets a token by hand: the user opens `/extension/connect`, copies
it, and pastes it into the popup.

## What still reads Prisma directly

The server-rendered pages (dashboard, history, workspace, settings, billing) and
NextAuth still query Supabase through `lib/prisma.ts` rather than calling the
backend. This is safe — one database, and reads are ownership-scoped — but it
means the frontend needs `DATABASE_URL` and the Prisma schema at build time.

Moving those reads onto `serverApi()` is the last piece of the split. It is not
required for correctness, and it is deliberately not done yet.

## Data

The model is described in `backend/prisma/schema.prisma` and mirrored in
`backend/supabase/migrations/*` — see `backend/supabase/README.md` to provision.

`backend/api/prisma/schema.prisma` is a byte-identical copy. Prisma resolves its
generated client relative to the schema's own directory, so pointing the backend
at the shared file would emit the client into the repo root instead of the
backend package. **A model change goes in both files.**

## The three frontends

### Web — `frontend/web/`
Marketing (`app/page.tsx`) is public. The product lives behind auth in
`app/(app)/*`. Server components read Prisma; client components write through
`lib/api-client.ts` to the backend.

### Android — `frontend/web/android/`
A Capacitor WebView shell that loads the deployed web app over HTTPS
(`capacitor.config.ts`, `CAP_SERVER_URL`). No second codebase. `npm run cap:sync`.

### Extension — `frontend/extension/`
Chrome MV3. `background.js` gets a `tabCapture` stream id, an offscreen document
runs `MediaRecorder` (MV3 service workers cannot), and `content.js` renders the
in-call panel. The Web Speech API drives a live preview; on stop the recorded
blob goes to `POST {apiBase}/transcribe` for the real transcript, then to
`POST {apiBase}/extension/process` for extraction. `npm run ext:build`.

While capturing it posts heartbeats to `/extension/session`, which lights the
**"Extension: connected"** badge in the web topbar — the visible proof that all
three surfaces share one backend.

## Client → backend summary

| Client | Talks to backend via | Auth |
|---|---|---|
| Marketing | nothing — static | public |
| Web app (server) | `serverApi()`, plus direct Prisma reads | session-signed JWT |
| Web app (browser) | `lib/api-client.ts` | JWT from `/api/token` |
| Android | the web app, in a WebView | NextAuth cookie |
| Extension | `fetch` to `apiBase` (CORS) | pasted bearer token |

## Run it

```bash
cd backend/api  && npm install && npm run start:dev   # :4001
cd frontend/web && npm install && npm run dev         # :4000
```

Deployment (Render + Vercel): **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.
Feature inventory and provider notes: `HANDOFF.md`.
