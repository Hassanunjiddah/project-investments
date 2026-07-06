-- RibhShare core schema: enums, tables, indexes
-- Run before 20250612100001_functions_and_triggers.sql

-- ---------------------------------------------------------------------------
-- Enums (match TypeScript unions exactly)
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.user_role as enum (
    'CEO',
    'ADMIN',
    'LINE_MANAGER',
    'INVESTOR'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.project_stage as enum (
    'INITIATION',
    'ACCEPTANCE',
    'PROGRESS',
    'END'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.approval_status as enum (
    'PENDING',
    'APPROVED',
    'REJECTED'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.invite_status as enum (
    'INVITED',
    'ACCEPTED',
    'COMMITTED',
    'PROOF_SUBMITTED',
    'CONFIRMED',
    'DECLINED'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  role        public.user_role not null default 'INVESTOR',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (email);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id                         uuid primary key default gen_random_uuid(),
  name                       text not null,
  sector                     text not null,
  stage                      public.project_stage not null default 'INITIATION',
  approval_status            public.approval_status not null default 'PENDING',
  target_kobo                bigint not null check (target_kobo > 0),
  raised_kobo                bigint not null default 0 check (raised_kobo >= 0),
  profit_split_investor_bps  int not null default 7000
    check (profit_split_investor_bps between 0 and 10000),
  exit_notice_days           int not null default 90 check (exit_notice_days > 0),
  early_exit_penalty_bps     int not null default 500
    check (early_exit_penalty_bps between 0 and 10000),
  created_by                 uuid not null references public.profiles (id),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists projects_created_by_idx on public.projects (created_by);
create index if not exists projects_approval_status_idx on public.projects (approval_status);
create index if not exists projects_stage_idx on public.projects (stage);

-- ---------------------------------------------------------------------------
-- invites
-- ---------------------------------------------------------------------------

create table if not exists public.invites (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references public.projects (id) on delete cascade,
  investor_id             uuid not null references public.profiles (id),
  status                  public.invite_status not null default 'INVITED',
  amount_kobo             bigint not null check (amount_kobo > 0),
  projected_profit_kobo   bigint not null default 0 check (projected_profit_kobo >= 0),
  proof_name              text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (project_id, investor_id)
);

create index if not exists invites_investor_id_idx on public.invites (investor_id);
create index if not exists invites_project_id_idx on public.invites (project_id);
create index if not exists invites_status_idx on public.invites (status);
