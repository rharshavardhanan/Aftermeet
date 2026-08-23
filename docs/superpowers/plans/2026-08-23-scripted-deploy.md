# Scripted deploy — Supabase + Render + Vercel

Date: 2026-08-23
Status: complete — script written and checked; not yet run against live accounts

## Context

Follow-on from `2026-08-23-audit-cleanup-and-deploy.md`, which produced a manual
runbook. The ask now is to automate it. All four accounts (Supabase, Render,
Vercel, Groq) already exist.

The operator holds the credentials: the script reads tokens from its environment
and no secret passes through the assistant. That is the whole point of this
shape — it is not a convenience, it is the security boundary.

### What cannot be automated, and why

| Step | Why it stays manual |
|---|---|
| Google OAuth client + consent screen | No practical API. Google gates OAuth brand configuration behind the console. Without it NextAuth cannot sign anyone in. |
| Adding the Vercel callback URL to that client | Same console, and the URL is not known until Vercel assigns it. |
| Final end-to-end proof (sign in, upload audio) | Requires a browser session as the account owner. |
| Git-triggered auto-deploy | Connecting a Git repo to Vercel/Render needs their GitHub App authorised in a browser. The script deploys directly instead. |

### Verified API facts

Checked against live docs rather than recalled:

- **Render**: `POST https://api.render.com/v1/services`, bearer auth, body
  `{type, name, ownerId, repo, branch, rootDir, serviceDetails:{runtime,
  envSpecificDetails:{buildCommand,startCommand}, plan, region,
  healthCheckPath}, envVars:[{key,value}]}`. Owner from `GET /v1/owners`.
- **Supabase**: Management API has `GET /v1/organizations`, `POST /v1/projects`,
  `GET /v1/projects/{ref}`. The CLI wraps these and runs non-interactively off
  `SUPABASE_ACCESS_TOKEN`.
- **Vercel**: `vercel env add NAME production --force` takes the value on
  stdin. `vercel deploy` prints the deployment URL on stdout and nothing else.
  `--yes` skips project-setup prompts.

### The one non-obvious constraint

`vercel deploy --cwd frontend/web` uploads only files beneath that directory.
`frontend/web/package.json` points Prisma at `../../backend/prisma/schema.prisma`,
which is outside it, so the remote build would fail to find the schema.

Avoided by building locally, where the whole repo is present, and shipping the
result: `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`.
This also sidesteps the "include files outside the root directory" dashboard
setting the manual runbook depends on.

Consequence worth stating plainly: deploys are triggered from the operator's
machine, not by pushing to GitHub. Wiring up push-to-deploy is a browser step.

### Connection-string derivation is the fragile part

Supabase pooler hostnames are not returned by any endpoint this script can rely
on, and the prefix varies (`aws-0-`, `aws-1-`). The script therefore *derives*
candidates and *verifies* each with a real `psql` connection, rather than
assuming one is right. If none connect it stops and tells the operator to copy
the exact string from the dashboard, instead of proceeding with a broken URL.

## Tasks

### Task 1 — Credential template the operator fills in

- **Goal**: One file to populate, sourced before running the script, never committed.
- **Why**: Keeps every secret on the operator's machine. Also documents which
  variables are required vs optional in one place.
- **Files**: `scripts/deploy-vars.example.sh`, `.gitignore`.
- **Steps**: template with required/optional sections and where to get each
  value; gitignore `scripts/deploy-vars.sh`.
- **Done when**: `git check-ignore scripts/deploy-vars.sh` exits 0.

### Task 2 — The deploy script

- **Goal**: One idempotent command takes empty accounts to two running services.
- **Why**: The manual runbook is ~25 dashboard steps with two values that must
  match byte-for-byte across providers; that is what gets fumbled.
- **Files**: `scripts/deploy.sh`.
- **Steps**:
  1. Preflight: required vars present, `jq`/`psql`/`node` available, fail with
     a list of what is missing rather than one at a time.
  2. Supabase: reuse `SUPABASE_PROJECT_REF` if set, else create and poll to
     healthy.
  3. Derive and *verify* `DATABASE_URL` / `DIRECT_URL` by connecting.
  4. `prisma db push` to create the schema.
  5. Render: find-or-create the service, set env vars, wait for live, read URL.
  6. Vercel: link, set env vars, pull, build locally, deploy prebuilt, read URL.
  7. Backfill `CORS_ORIGINS` + `WEB_APP_URL` on Render with the Vercel origin,
     redeploy.
  8. Verify `GET /health` reports `db: up`, `ai: up`.
  9. Print the remaining manual step (Google redirect URI) with the exact URL.
- **Done when**: `bash -n scripts/deploy.sh` passes and a run with no
  credentials set exits non-zero listing every missing variable.

### Task 3 — Runbook points at the script

- **Goal**: `docs/DEPLOYMENT.md` leads with the scripted path and keeps the
  manual steps as the fallback.
- **Files**: `docs/DEPLOYMENT.md`.
- **Done when**: the scripted path appears before the manual one and names the
  Google OAuth step as unavoidable.

## Out of scope

- Creating the Google OAuth client.
- Push-to-deploy wiring.
- Custom domains, Stripe webhook registration (the script passes Stripe vars
  through if present but does not create the webhook).

## Outcomes

| Task | Result |
|---|---|
| 1 — credential template | Done. `git check-ignore scripts/deploy-vars.sh` and `.deploy-state.json` both exit 0. |
| 2 — deploy script | Done. `bash -n` passes; preflight with no credentials exits 1 listing all 7; with 4 set it lists exactly the 3 missing. |
| 3 — runbook | Done. Scripted path leads, manual path retained as fallback. |

Checked in isolation rather than assumed:

- env-var payload builder keeps 13 of 18 entries and drops all 5 empty
  optionals, with zero empty values reaching Render
- Render service body is valid JSON, and its `rootDir`, `buildCommand` and
  `startCommand` match `backend/api/package.json`
- password encoder correctly escapes `/ + = & # @`, space and non-ASCII — the
  characters that would otherwise break a Postgres URI
- empty-array preflight works under `set -u` on both bash 5.3 (Homebrew) and
  bash 3.2 (system), since the shebang resolves to whichever is first on PATH
- `set_vercel_env` sets when given a value, skips when optional-and-empty, and
  refuses when required-and-empty

### Not verified

The script has never been run against live Supabase, Render, or Vercel
accounts — no credentials were available. API shapes were confirmed against
current vendor docs, not against real responses. First run should be treated as
the real test; every step is idempotent, so a failure part-way can be fixed and
re-run.

The likeliest failure is Supabase connection-string derivation, which is why
that step verifies with `psql` before proceeding rather than assuming.
