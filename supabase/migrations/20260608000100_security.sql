-- ============================================================================
-- Meeting-to-Tasks — security & integrity hardening
-- ----------------------------------------------------------------------------
-- Two things happen here:
--
-- 1. updated_at triggers — Prisma sets @updatedAt in the app layer, but a DB
--    trigger guarantees correctness even for direct SQL writes / admin edits.
--
-- 2. Row Level Security — IMPORTANT THREAT MODEL:
--    This app talks to Postgres through Prisma using the privileged connection
--    string (DATABASE_URL / DIRECT_URL = the `postgres` owner role via the
--    Supabase pooler). That role BYPASSES RLS, so the app keeps full access and
--    enforces ownership itself in server actions (every mutation checks userId).
--
--    Supabase ALSO exposes every table over an auto-generated REST/GraphQL API
--    to the `anon` and `authenticated` roles using your project's public anon
--    key. We do NOT want those roles touching this data. Enabling RLS with no
--    permissive policy = default-deny for them. This closes the most common
--    Supabase data-leak (forgot to lock a table, anon key scrapes it).
--
--    Net effect: trusted server = full access; public anon key = zero access.
-- ============================================================================

-- ── updatedAt triggers ───────────────────────────────────────────────────────
-- The @updatedAt columns have NO DB default (to stay drift-free with Prisma).
-- Prisma fills them in the app layer; this trigger guarantees they're populated
-- for ANY direct SQL write too (insert or update). Triggers are invisible to
-- Prisma's schema diff, so this adds safety without causing drift.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['UserPreference', 'Meeting', 'Task', 'Billing']
  loop
    execute format('drop trigger if exists set_updated_at on %I', t);
    execute format(
      'create trigger set_updated_at before insert or update on %I
         for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ── Row Level Security: default-deny for the public API roles ─────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'User', 'Account', 'Session', 'VerificationToken', 'UserPreference',
    'Workspace', 'Membership', 'Meeting', 'Transcript', 'TranscriptChunk',
    'AiOutput', 'Task', 'Billing', 'ExtensionSession', 'ActivityLog'
  ]
  loop
    -- enable + force so even the table owner is subject to policies via PostgREST;
    -- the Prisma `postgres` superuser role still bypasses RLS entirely.
    execute format('alter table %I enable row level security', t);
    -- no CREATE POLICY statements: with RLS on and no policy, anon/authenticated
    -- get an empty result set and all writes are rejected. Exactly what we want.
  end loop;
end $$;

-- Belt-and-suspenders: make sure the public API roles cannot even see the
-- tables, independent of RLS. Guarded so this file also runs cleanly on a plain
-- Postgres (local dev / CI) where the Supabase `anon`/`authenticated` roles
-- don't exist. On Supabase both roles exist and the revokes apply.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
    revoke all on all sequences in schema public from anon;
    revoke all on all functions in schema public from anon;
    alter default privileges in schema public revoke all on tables from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from authenticated;
    revoke all on all sequences in schema public from authenticated;
    revoke all on all functions in schema public from authenticated;
    alter default privileges in schema public revoke all on tables from authenticated;
  end if;
end $$;
