# Deployment — backend on Render, frontend on Vercel

Two routes. The scripted one does everything except the Google OAuth client;
the manual one is below it, and is also the fallback when a step fails.

Either way **one thing cannot be automated**: creating the Google OAuth client
and consent screen. Google gates that behind its console, and NextAuth is
Google-only, so nobody can sign in until it exists.

---

## Scripted

```bash
cp scripts/deploy-vars.example.sh scripts/deploy-vars.sh
$EDITOR scripts/deploy-vars.sh          # fill in 7 values
set -a; source scripts/deploy-vars.sh; set +a
./scripts/deploy.sh
```

`scripts/deploy-vars.sh` is gitignored. The script reads credentials from the
environment and writes none of them to disk — `.deploy-state.json` holds only
project ids and URLs.

It is re-runnable: existing resources are reused rather than duplicated. What it
does, in order:

1. Creates the Supabase project (or reuses `SUPABASE_PROJECT_REF`) and waits
   for it to come up.
2. Derives the pooler connection strings and **verifies them with a real
   connection** before using them — the hostname prefix varies between
   projects, so it tries the candidates rather than assuming.
3. Runs `prisma db push` to create the schema.
4. Creates the Render service with all its environment variables.
5. Builds the web app locally and ships the result to Vercel.
6. Backfills `CORS_ORIGINS` and `WEB_APP_URL` on Render with the real Vercel
   origin, then redeploys.
7. Polls `/health` and reports `db` and `ai` status.
8. Prints the redirect URI to add in Google Cloud Console.

### Why the frontend builds locally

A `vercel deploy` from `frontend/web` uploads only files under that directory,
but `frontend/web/package.json` points Prisma at
`../../backend/prisma/schema.prisma`, outside it — the remote build would not
find the schema. The script runs `vercel build` locally, where the whole repo is
present, and deploys the output with `--prebuilt`.

The trade-off: deploys are triggered from your machine, not by pushing to
GitHub. To get push-to-deploy, connect the repo in the Vercel and Render
dashboards afterwards — that needs their GitHub App authorised in a browser.

### If it stops partway

Every step is idempotent, so fix the cause and re-run. The two most common
failures:

- **Cannot connect to the database.** The region differs from
  `SUPABASE_REGION`, or the password is wrong. Copy the exact strings from the
  Supabase dashboard and re-run with `DATABASE_URL` and `DIRECT_URL` exported.
- **Render rejects the repo.** The repo must be public, or Render's GitHub App
  must be authorised for it.

Pin `API_JWT_SECRET` and `NEXTAUTH_SECRET` in `deploy-vars.sh` after the first
run. Regenerating them invalidates every issued token and signs everyone out.

---

## Manual

The same steps by hand. Also the reference for what the script is doing.

## 0. Before you start

Create these three accounts/resources. Everything else is optional.

| What | Where | Needed for |
|---|---|---|
| Supabase project | supabase.com | Postgres. Both halves talk to it. |
| Google OAuth client | console.cloud.google.com | Sign-in. NextAuth is Google-only, so without it nobody gets past `/login`. |
| Groq API key | console.groq.com/keys | Transcription (Whisper) + summarisation. Free. |

Generate the shared JWT secret once and keep it somewhere — both halves need the
identical string:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

From Supabase → Project Settings → Database, copy two connection strings:

- `DATABASE_URL` — **Connection pooling** (Transaction, port 6543), append `?pgbouncer=true`
- `DIRECT_URL` — **Direct connection** (Session, port 5432)

Push the schema before either service starts:

```bash
cd frontend/web && npm install && npx prisma db push
```

## 1. Backend → Render

Render Dashboard → **New** → **Blueprint** → pick this repo. It reads
[`render.yaml`](../render.yaml) and creates one service, `aftermeet-api`.

Fill in the `sync: false` variables it prompts for:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase pooled URI |
| `DIRECT_URL` | Supabase direct URI |
| `API_JWT_SECRET` | the secret from step 0 |
| `GROQ_API_KEY` | your Groq key |
| `CORS_ORIGINS` | `http://localhost:4000` for now — corrected in step 3 |
| `WEB_APP_URL` | `http://localhost:4000` for now — corrected in step 3 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | only if you want Docs export |
| `STRIPE_*` | only if you want billing |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | optional transcription fallbacks |

Leave the pre-filled model names (`GROQ_STT_MODEL=whisper-large-v3-turbo` etc.)
alone unless you have a reason.

Note the assigned URL, e.g. `https://aftermeet-api.onrender.com`. Confirm it:

```bash
curl https://aftermeet-api.onrender.com/health
# {"status":"ok","db":"up","ai":"up"}
```

`db: "down"` means the Supabase URLs are wrong. `ai: "down"` means no provider
key landed — the app will fall back to the demo extractor.

> The free plan spins down when idle. The first request after that takes ~50s,
> which is long enough that a transcription upload can look hung. Upgrade to
> Starter before showing this to anyone.

## 2. Frontend → Vercel

Vercel → **Add New** → **Project** → import this repo.

- **Root Directory**: `frontend/web`
- Leave *"Include source files outside of the Root Directory"* **enabled**. The
  Prisma schema lives at `backend/prisma/schema.prisma`, outside the root; the
  build fails without it.
- Framework preset and build command come from
  [`vercel.json`](../frontend/web/vercel.json).

Environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | same Supabase pooled URI |
| `DIRECT_URL` | same Supabase direct URI |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | your Vercel URL, e.g. `https://aftermeet.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | the same Vercel URL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from step 0 |
| `API_JWT_SECRET` | **byte-identical** to the one on Render |
| `NEXT_PUBLIC_API_BASE_URL` | the Render URL from step 1 |
| `NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY` | only if you want billing |

In the Google Cloud console, add the callback to your OAuth client's authorised
redirect URIs:

```
https://<your-vercel-url>/api/auth/callback/google
```

## 3. Close the loop

Back in Render, set both to the real Vercel origin and redeploy:

- `CORS_ORIGINS` → `https://<your-vercel-url>`
- `WEB_APP_URL` → `https://<your-vercel-url>`

Browser calls to the backend fail with a CORS error until this is done. Sign-in
will appear to work, because that never touches the backend.

## 4. Optional extras

**Stripe.** Add `STRIPE_SECRET_KEY` and `STRIPE_PRICE_PRO_MONTHLY` on Render,
point a webhook at `https://<render-url>/billing/webhook`, and put its signing
secret in `STRIPE_WEBHOOK_SECRET`. The frontend also needs
`NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY` or the upgrade button stays disabled.

**Chrome extension.** Open the extension popup and set `appOrigin` to the Vercel
URL and `apiBase` to the Render URL, then add both to `host_permissions` in
`manifest.json`. Get a token from `<vercel-url>/extension/connect`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| CORS error on any backend call | `CORS_ORIGINS` on Render is not the exact Vercel origin (scheme included, no trailing slash) |
| `401` from every backend call | `API_JWT_SECRET` differs between the two dashboards |
| Vercel build: `Could not find Prisma Schema` | "Include source files outside of the Root Directory" is off |
| Transcription returns `[unintelligible segment]` | every provider failed; check `GROQ_API_KEY` and `/health` |
| Workspace shows "Demo mode" | `/health` reports `ai: "down"` — no provider key on **Render** |
| First request of the day times out | free-plan cold start; retry or upgrade |
