# Frontend/Backend Split — Design Spec

**Date:** 2026-06-15
**Status:** Approved (design), pending implementation plan
**Project:** 1 of 3 (this spec). Follow-on: Project 2 (engine fixes), Project 3 (glass-accent redesign).

## Problem & goal

Today the product is a single **Next.js monolith** (`frontend/web/`): it serves the
marketing site, the authenticated app UI, **and** the entire backend
(`app/api/*` route handlers, `app/actions/*` server actions, Prisma data layer,
NextAuth). The `backend/` folder is only the database definition (Prisma schema +
Supabase migrations) — there is no standalone server.

The user wants a **production-standard split**: a separate frontend on Vercel and a
separate backend on Render, with Supabase as the database. This re-architecture is
**Project 1** and is sequenced **before** the engine fixes and redesign.

Goal: migrate to a split architecture **without breaking the working product at any
point**, using a strangler (incremental) migration.

## Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Sequencing | Split first, then engine fixes on new backend | User choice |
| Migration strategy | **Strangler / incremental** | Lowest risk; app stays working; production-standard |
| Backend framework | **NestJS** on Render | Production-standard structured Node backend (DI, modules, guards, validation, Swagger) |
| Frontend host | **Next.js on Vercel** (frontend-only) | Framework-native |
| Database | **Supabase Postgres** via Prisma (unchanged) | Already in use |
| Auth | **Supabase Auth (Google → JWT)**, `Authorization: Bearer <JWT>` | Production-standard for a split API; cleanly solves cross-origin + extension auth (no `SameSite` cookie hacks). Supersedes the earlier "fix cookie-sharing" idea once the API is a separate origin. |
| Brand direction | Keep ink-on-paper; glass accents are a later project | User choice |

## Target architecture

```
  Next.js (Vercel)            NestJS (Render)              Supabase
  ───────────────             ───────────────              ────────
  marketing site      ──┐
  app UI (RSC+client) ──┼──►  REST API (modules)   ──►  Postgres (Prisma)
  extension connect   ──┘     guards · validation        Auth (Google→JWT)
        ▲                     Prisma · AI services
        │                          ▲
  Authorization: Bearer <Supabase JWT> on every call
  Extension / Android  ─────────────┘ (same bearer JWT)
```

Three deployables + Supabase. The Next.js app becomes **frontend-only**; all
business logic in `app/api/*` and `app/actions/*` moves into NestJS.

## Auth design

- **Supabase Auth** with the Google provider issues a JWT (access token). NextAuth is removed.
- Every client (web, mobile WebView, extension) sends `Authorization: Bearer <JWT>`.
- NestJS **`JwtAuthGuard`** verifies the token against Supabase JWKS, then upserts/loads
  the app `User` row (keyed by email / Google `sub`) via Prisma. A `@CurrentUser()`
  decorator exposes the resolved user to controllers.
- **User-identity migration:** the existing NextAuth `User/Account/Session` models are
  reconciled. App users are keyed by **email** so current accounts map cleanly on first
  Supabase sign-in. NextAuth tables/usage are removed from the frontend after cutover.
  This is the single highest-risk step and gets its own verification.

## NestJS backend structure

Modules (each = controller + service + DTOs + tests):

- `AuthModule` — `JwtAuthGuard`, Supabase JWKS verification, `@CurrentUser()`.
- `UsersModule` — profile, preferences/settings, onboarding.
- `MeetingsModule` — CRUD, list/history, detail.
- `TasksModule` — CRUD, status, urgency.
- `TranscriptionModule` — audio → transcript; wraps Groq/Gemini/OpenAI (current
  `lib/ai/transcribe.ts` logic). Engine fixes (Project 2) land here.
- `ExtractionModule` — transcript → tasks/decisions/minutes (`lib/ai/extract.ts`,
  `prompt.ts`, `schema.ts`, `mock.ts` become Nest providers).
- `ExtensionModule` — `/extension/process`, `/extension/session`.
- `BillingModule` — Stripe checkout + webhook.
- `GoogleModule` — Google Docs/Drive export.
- `PrismaModule` — shared Prisma client provider.
- `HealthModule` — `/health` for Render.

Cross-cutting: global exception filter (consistent JSON error shape),
`class-validator`/`class-transformer` DTO validation, `@nestjs/swagger` OpenAPI,
CORS config, config via `@nestjs/config`.

## Frontend changes

- New typed **`lib/api-client.ts`** that targets `NEXT_PUBLIC_API_BASE_URL` and attaches
  the Supabase access token. Server components use `@supabase/ssr` to obtain the token
  server-side; client components use the browser Supabase client.
- Server components fetch data from the backend API instead of calling Prisma/server
  actions directly. Server actions that performed writes become thin wrappers that call
  the backend (or are replaced by client calls).
- Marketing pages remain static/public.
- Remove `app/api/*` business routes and `app/actions/*` logic after each domain is
  migrated.

## Strangler migration sequence

Each phase ends with a working, verifiable product.

0. **Scaffold.** New NestJS app; `PrismaModule` reusing the existing schema; Supabase
   Auth project config (Google provider); deploy skeleton to Render; `/health` green.
   Frontend gains `NEXT_PUBLIC_API_BASE_URL`, Supabase client, and the API client behind
   a feature flag. No behavior change yet.
1. **Auth cutover.** Supabase Auth on the frontend; `JwtAuthGuard` + user upsert on the
   backend; email-keyed identity migration. Login works end-to-end via bearer JWT.
2. **Read paths.** Meetings list/history/detail and tasks read → backend.
3. **Write paths.** `processMeeting`/extraction, task mutations, settings, onboarding → backend.
4. **Transcription.** `/transcribe` endpoint on the backend, with CORS (this also fixes
   the current missing-CORS bug on the transcribe route).
5. **Extension.** `/extension/process` + `/extension/session` on the backend; repoint the
   extension (configurable `APP_ORIGIN`) and switch it to bearer-token auth via a connect
   flow that stores the Supabase JWT in `chrome.storage`.
6. **Billing + Google export.** Stripe checkout/webhook and Google Docs/Drive export → backend.
7. **Decommission.** Remove monolith API/actions; finalize Vercel (frontend) + Render
   (backend) deploys; update `ARCHITECTURE.md`, `render.yaml`, env docs.

## Data flow

`Client → (Supabase JWT) → JwtAuthGuard verifies → controller → service → Prisma →
Supabase Postgres`. AI services (Transcription/Extraction) call Groq/Gemini/OpenAI and
preserve the current provider-preference + quota-fallback behavior.

## Error handling & CORS

- Global Nest exception filter → consistent `{ error, statusCode }` JSON.
- DTO validation rejects malformed input with 400 + field detail.
- CORS allow-list: the Vercel frontend origin, `https://meet.google.com`,
  `https://*.zoom.us`, and localhost dev origins. Credentials not required (bearer
  tokens), simplifying CORS.
- Preserve quota/rate-limit (`429`) and payload-size (`413`) handling from the current
  transcribe route.

## Testing

- **Backend:** Jest unit tests per service; supertest e2e per controller; AI providers
  mocked. `JwtAuthGuard` tested with valid/invalid/expired tokens.
- **Frontend:** API-client unit tests; a smoke check of the primary flow after each
  strangler phase.
- **Gate:** verify each phase (run the app, exercise the migrated flow) before advancing.

## Explicitly out of scope (follow-on specs)

- **Project 2 — engine fixes:** 30–50 language support via a two-tier transcriber
  (Whisper for its ~14 well-supported Indian languages + Gemini multimodal for the long
  tail), Gemini reliability hardening (retry/backoff/timeout/model fallback), extension
  language hint and full functionality. Built on the new backend.
- **Project 3 — glass-accent redesign:** iOS-style frosted/floating accents layered over
  the existing ink-on-paper brand (not a full reskin).

## Risks

- **Auth migration (Phase 1)** is the highest-risk step; existing users must map cleanly.
  Mitigation: key by email, test with a real existing account before decommissioning NextAuth.
- **Server-component data fetching** changes from in-process Prisma to network calls;
  watch latency and token propagation in RSC.
- **Two new deploy targets** (Render backend, Vercel frontend) + CORS + env management
  add operational surface. Mitigation: `/health`, staged env flags, phase-by-phase cutover.
