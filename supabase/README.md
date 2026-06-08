# Supabase backend — setup & migration guide

This is the backend for Aftermeet. The app (Next.js + Prisma) talks to a
**Supabase Postgres** database. Auth, AI, and Stripe logic live in the Next.js
server; Supabase here is purely the **database** (plus connection pooling). You
run the Next.js server yourself; Supabase hosts the data.

```
supabase/
  config.toml                         CLI config (local dev)
  migrations/
    20260608000000_init.sql           full schema (mirrors prisma/schema.prisma)
    20260608000100_security.sql       updated_at triggers + RLS lockdown
  README.md                           ← you are here
```

---

## 1. Create the project (2 min)

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Pick a region close to where your server runs, set a strong **database
   password** (save it — you need it for the connection strings).
3. Wait for it to provision.

---

## 2. Get your connection strings

Dashboard → **Project Settings → Database → Connection string**.

You need **two** URLs (the app uses one for queries, one for migrations):

| Env var        | Which Supabase string                              | Port |
|----------------|----------------------------------------------------|------|
| `DATABASE_URL` | **Connection pooling** (Transaction mode)          | 6543 |
| `DIRECT_URL`   | **Direct connection** (Session)                    | 5432 |

Append `?pgbouncer=true` to the pooled one. Example:

```bash
DATABASE_URL="postgresql://postgres.<ref>:<PWD>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<ref>:<PWD>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

Put both in your `.env` (copy from `.env.example`). `DATABASE_URL` is the pooled
URL the running app uses; `DIRECT_URL` is the unpooled URL migrations use.

---

## 3. Apply the schema — pick ONE path

### Path A — Dashboard SQL Editor (simplest, zero tooling)

1. Dashboard → **SQL Editor → New query**.
2. Paste the entire contents of `migrations/20260608000000_init.sql`, **Run**.
3. New query → paste `migrations/20260608000100_security.sql`, **Run**.
4. Done. Then generate the Prisma client so the app can talk to it:
   ```bash
   npm run db:generate
   ```

### Path B — Supabase CLI (versioned migrations)

```bash
npm i -g supabase                 # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push                  # applies everything in supabase/migrations/*
npm run db:generate
```

### Path C — Let Prisma create everything (skip the SQL files)

The SQL files are a faithful copy of `prisma/schema.prisma`, so you can instead
let Prisma build the tables directly:

```bash
npm run db:generate
npm run db:push                   # prisma db push  → creates tables from schema
```

Then run `migrations/20260608000100_security.sql` once in the SQL Editor to add
the RLS lockdown and triggers (Prisma doesn't manage those).

> Use **A or B** if you want SQL to be the source of truth, **C** if you want
> Prisma to be. Don't mix A/B and C against the same fresh DB or you'll get
> "relation already exists" — the `init.sql` is guarded with `IF NOT EXISTS`,
> but pick one workflow and stick to it.

---

## 4. Verify

```bash
# tables exist (15 of them):
#   Dashboard → Table Editor  → you should see User, Meeting, Task, …
npm run db:studio        # opens Prisma Studio against the same DB
```

Or in the SQL Editor:

```sql
select tablename from pg_tables where schemaname = 'public' order by 1;
-- AiOutput, Account, ActivityLog, Billing, ExtensionSession, Meeting,
-- Membership, Session, Task, Transcript, TranscriptChunk, User,
-- UserPreference, VerificationToken, Workspace
```

---

## 5. Run the server

```bash
npm install
npm run dev          # http://localhost:4000
```

- With **no AI key**, the app runs in **demo mode** (local deterministic
  extractor) — every screen works end-to-end against your Supabase DB.
- Add `OPENAI_API_KEY` (or swap to Gemini per `HANDOFF.md` §6) for real output.
- Add `GOOGLE_CLIENT_ID/SECRET` for real Google sign-in; without it you can't
  log in (NextAuth needs a provider).

---

## 6. Security model (read this)

The migration `20260608000100_security.sql` enables **Row Level Security with no
permissive policies** on every table, and revokes all grants from the `anon` and
`authenticated` roles. Why:

- The **app** connects as the privileged `postgres` role (your `DATABASE_URL`).
  That role **bypasses RLS**, so the app has full access and enforces ownership
  itself in server actions (every read/write is scoped to `session.user.id`).
- Supabase **auto-exposes a public REST/GraphQL API** to anyone holding your
  project's anon key. RLS-on + no-policy makes that API return **nothing** and
  reject **all** writes. This shuts the single most common Supabase data leak.

So: trusted server = full access; public anon key = zero access. If you later
want to query Supabase directly from a browser with the anon key, you'd add
explicit `create policy` statements scoped to `auth.uid()` — not needed today.

**Keep the database password and connection strings server-side only.** They are
never `NEXT_PUBLIC_*`, never in the browser bundle, never in the extension. See
`HANDOFF.md` §9 for full key-handling rules.

---

## 7. Backups & ops

- Supabase takes daily backups on paid tiers; enable **Point-in-Time Recovery**
  for production.
- Set a **statement timeout** and connection limits in the Dashboard if you
  expect spikes.
- Migrations are forward-only here. To change the schema, edit
  `prisma/schema.prisma`, run `npx prisma migrate dev --name <change>` against
  `DIRECT_URL`, and commit the generated SQL into `supabase/migrations/` (or the
  `prisma/migrations/` folder) so prod can replay it with `prisma migrate deploy`.
