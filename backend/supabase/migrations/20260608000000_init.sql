-- ============================================================================
-- Meeting-to-Tasks — Supabase initial schema
-- ----------------------------------------------------------------------------
-- This migration is a 1:1 mirror of prisma/schema.prisma. Identifiers are
-- quoted PascalCase / camelCase so they match exactly what the Prisma client
-- expects at runtime (Prisma does NOT use @map here, so table = model name and
-- column = field name, case-sensitive).
--
-- Verified drift-free against schema.prisma with:
--   npx prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma --script
-- (empty output = the DB and the Prisma schema agree exactly).
--
-- NOTE ON TYPES: timestamps are `timestamp(3)` (no time zone, ms precision) to
-- match Prisma's default DateTime mapping. updatedAt columns intentionally have
-- NO column default — they're populated by Prisma's @updatedAt and, for direct
-- SQL writes, by the trigger in 20260608000100_security.sql.
--
-- Apply it in ONE of these ways (see supabase/README.md for detail):
--   1. Supabase Dashboard → SQL Editor → paste this file → Run.
--   2. supabase db push          (Supabase CLI, reads supabase/migrations/*)
--   3. Let Prisma own it:        npx prisma db push   (then skip this file)
--
-- Safe to run on a fresh database; IF NOT EXISTS guards make re-runs no-ops.
-- ============================================================================

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type "WorkspaceRole" as enum ('OWNER', 'ADMIN', 'MEMBER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type "MeetingSource" as enum ('PASTE', 'UPLOAD', 'RECORDING', 'EXTENSION');
exception when duplicate_object then null; end $$;

do $$ begin
  create type "MeetingStatus" as enum ('DRAFT', 'PROCESSING', 'COMPLETED', 'FAILED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type "TaskStatus" as enum ('OPEN', 'DONE', 'ARCHIVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type "TaskUrgency" as enum ('LOW', 'MEDIUM', 'HIGH');
exception when duplicate_object then null; end $$;

do $$ begin
  create type "Plan" as enum ('FREE', 'PRO');
exception when duplicate_object then null; end $$;

-- ── Auth (NextAuth Prisma adapter) ──────────────────────────────────────────

create table if not exists "User" (
  "id"                  text primary key,
  "name"                text,
  "email"               text,
  "emailVerified"       timestamp(3),
  "image"               text,
  "createdAt"           timestamp(3) not null default now(),
  "onboardingCompleted" boolean      not null default false
);
create unique index if not exists "User_email_key" on "User" ("email");

create table if not exists "Account" (
  "id"                text primary key,
  "userId"            text not null,
  "type"              text not null,
  "provider"          text not null,
  "providerAccountId" text not null,
  "refresh_token"     text,
  "access_token"      text,
  "expires_at"        integer,
  "token_type"        text,
  "scope"             text,
  "id_token"          text,
  "session_state"     text,
  constraint "Account_userId_fkey" foreign key ("userId")
    references "User" ("id") on delete cascade on update cascade
);
create unique index if not exists "Account_provider_providerAccountId_key"
  on "Account" ("provider", "providerAccountId");

create table if not exists "Session" (
  "id"           text primary key,
  "sessionToken" text not null,
  "userId"       text not null,
  "expires"      timestamp(3) not null,
  constraint "Session_userId_fkey" foreign key ("userId")
    references "User" ("id") on delete cascade on update cascade
);
create unique index if not exists "Session_sessionToken_key" on "Session" ("sessionToken");

create table if not exists "VerificationToken" (
  "identifier" text not null,
  "token"      text not null,
  "expires"    timestamp(3) not null
);
create unique index if not exists "VerificationToken_token_key"
  on "VerificationToken" ("token");
create unique index if not exists "VerificationToken_identifier_token_key"
  on "VerificationToken" ("identifier", "token");

-- ── Preferences ─────────────────────────────────────────────────────────────

create table if not exists "UserPreference" (
  "id"        text primary key,
  "userId"    text not null,
  "useCase"   text,
  "platforms" text[] not null default '{}',
  "priority"  text,
  "theme"     text not null default 'system',
  "emailTone" text not null default 'professional',
  "updatedAt" timestamp(3) not null,
  constraint "UserPreference_userId_fkey" foreign key ("userId")
    references "User" ("id") on delete cascade on update cascade
);
create unique index if not exists "UserPreference_userId_key"
  on "UserPreference" ("userId");

-- ── Workspaces & membership ─────────────────────────────────────────────────

create table if not exists "Workspace" (
  "id"        text primary key,
  "name"      text not null,
  "slug"      text not null,
  "createdAt" timestamp(3) not null default now()
);
create unique index if not exists "Workspace_slug_key" on "Workspace" ("slug");

create table if not exists "Membership" (
  "id"          text primary key,
  "userId"      text not null,
  "workspaceId" text not null,
  "role"        "WorkspaceRole" not null default 'OWNER',
  "createdAt"   timestamp(3) not null default now(),
  constraint "Membership_userId_fkey" foreign key ("userId")
    references "User" ("id") on delete cascade on update cascade,
  constraint "Membership_workspaceId_fkey" foreign key ("workspaceId")
    references "Workspace" ("id") on delete cascade on update cascade
);
create unique index if not exists "Membership_userId_workspaceId_key"
  on "Membership" ("userId", "workspaceId");

-- ── Meetings, transcripts, AI output ────────────────────────────────────────

create table if not exists "Meeting" (
  "id"           text primary key,
  "workspaceId"  text not null,
  "userId"       text not null,
  "title"        text not null default 'Untitled meeting',
  "source"       "MeetingSource" not null default 'PASTE',
  "status"       "MeetingStatus" not null default 'DRAFT',
  "meetingDate"  timestamp(3) not null default now(),
  "durationSec"  integer,
  "participants" text[] not null default '{}',
  "createdAt"    timestamp(3) not null default now(),
  "updatedAt"    timestamp(3) not null,
  constraint "Meeting_workspaceId_fkey" foreign key ("workspaceId")
    references "Workspace" ("id") on delete cascade on update cascade,
  constraint "Meeting_userId_fkey" foreign key ("userId")
    references "User" ("id") on delete cascade on update cascade
);
create index if not exists "Meeting_workspaceId_meetingDate_idx"
  on "Meeting" ("workspaceId", "meetingDate");
create index if not exists "Meeting_userId_status_idx"
  on "Meeting" ("userId", "status");

create table if not exists "Transcript" (
  "id"         text primary key,
  "meetingId"  text not null,
  "rawText"    text not null,
  "language"   text not null default 'en',
  "wordCount"  integer not null default 0,
  "speakerMap" jsonb,
  "createdAt"  timestamp(3) not null default now(),
  constraint "Transcript_meetingId_fkey" foreign key ("meetingId")
    references "Meeting" ("id") on delete cascade on update cascade
);
create unique index if not exists "Transcript_meetingId_key"
  on "Transcript" ("meetingId");

create table if not exists "TranscriptChunk" (
  "id"           text primary key,
  "transcriptId" text not null,
  "index"        integer not null,
  "speaker"      text not null default 'Speaker 1',
  "text"         text not null,
  "startMs"      integer,
  "endMs"        integer,
  constraint "TranscriptChunk_transcriptId_fkey" foreign key ("transcriptId")
    references "Transcript" ("id") on delete cascade on update cascade
);
create index if not exists "TranscriptChunk_transcriptId_index_idx"
  on "TranscriptChunk" ("transcriptId", "index");

create table if not exists "AiOutput" (
  "id"            text primary key,
  "meetingId"     text not null,
  "model"         text not null,
  "summary"       text not null,
  "decisions"     jsonb not null default '[]',
  "risks"         jsonb not null default '[]',
  "deadlines"     jsonb not null default '[]',
  "followupEmail" text  not null default '',
  "mom"           jsonb,
  "tokensUsed"    integer not null default 0,
  "createdAt"     timestamp(3) not null default now(),
  constraint "AiOutput_meetingId_fkey" foreign key ("meetingId")
    references "Meeting" ("id") on delete cascade on update cascade
);
create unique index if not exists "AiOutput_meetingId_key"
  on "AiOutput" ("meetingId");

-- ── Tasks ───────────────────────────────────────────────────────────────────

create table if not exists "Task" (
  "id"          text primary key,
  "meetingId"   text not null,
  "userId"      text not null,
  "title"       text not null,
  "assignee"    text,
  "dueDate"     timestamp(3),
  "urgency"     "TaskUrgency" not null default 'MEDIUM',
  "status"      "TaskStatus"  not null default 'OPEN',
  "confidence"  double precision not null default 0.5,
  "sourceQuote" text,
  "createdAt"   timestamp(3) not null default now(),
  "updatedAt"   timestamp(3) not null,
  constraint "Task_meetingId_fkey" foreign key ("meetingId")
    references "Meeting" ("id") on delete cascade on update cascade,
  constraint "Task_userId_fkey" foreign key ("userId")
    references "User" ("id") on delete cascade on update cascade
);
create index if not exists "Task_userId_status_idx" on "Task" ("userId", "status");
create index if not exists "Task_meetingId_idx" on "Task" ("meetingId");

-- ── Billing ─────────────────────────────────────────────────────────────────

create table if not exists "Billing" (
  "id"                   text primary key,
  "workspaceId"          text not null,
  "plan"                 "Plan" not null default 'FREE',
  "stripeCustomerId"     text,
  "stripeSubscriptionId" text,
  "stripePriceId"        text,
  "currentPeriodEnd"     timestamp(3),
  "meetingsUsed"         integer not null default 0,
  "meetingsLimit"        integer not null default 10,
  "updatedAt"            timestamp(3) not null,
  constraint "Billing_workspaceId_fkey" foreign key ("workspaceId")
    references "Workspace" ("id") on delete cascade on update cascade
);
create unique index if not exists "Billing_workspaceId_key"
  on "Billing" ("workspaceId");
create unique index if not exists "Billing_stripeCustomerId_key"
  on "Billing" ("stripeCustomerId");
create unique index if not exists "Billing_stripeSubscriptionId_key"
  on "Billing" ("stripeSubscriptionId");

-- ── Extension sessions & activity log ───────────────────────────────────────

create table if not exists "ExtensionSession" (
  "id"        text primary key,
  "userId"    text not null,
  "platform"  text not null default 'meet',
  "tabUrl"    text,
  "status"    text not null default 'active',
  "startedAt" timestamp(3) not null default now(),
  "endedAt"   timestamp(3),
  "meetingId" text,
  constraint "ExtensionSession_userId_fkey" foreign key ("userId")
    references "User" ("id") on delete cascade on update cascade
);
create index if not exists "ExtensionSession_userId_status_idx"
  on "ExtensionSession" ("userId", "status");

create table if not exists "ActivityLog" (
  "id"        text primary key,
  "userId"    text not null,
  "action"    text not null,
  "meta"      jsonb,
  "createdAt" timestamp(3) not null default now(),
  constraint "ActivityLog_userId_fkey" foreign key ("userId")
    references "User" ("id") on delete cascade on update cascade
);
create index if not exists "ActivityLog_userId_createdAt_idx"
  on "ActivityLog" ("userId", "createdAt");
