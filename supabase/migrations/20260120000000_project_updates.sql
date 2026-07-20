-- RibhShare Phase 2: project execution updates feed
-- 2026-01-20
-- Adds project_updates table (risks, fund-usage, engagement, milestones, announcements)
-- plus an RPC to post updates. Read access mirrors project_docs (LM, CEO, confirmed investors).

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.project_update_kind as enum (
    'RISK',
    'FUND_USE',
    'ENGAGEMENT',
    'MILESTONE',
    'ANNOUNCEMENT'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- project_updates
-- ---------------------------------------------------------------------------

create table if not exists public.project_updates (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  kind              public.project_update_kind not null,
  title             text not null,
  body              text not null default '',
  amount_minor      bigint check (amount_minor is null or amount_minor >= 0),
  posted_by         uuid not null references public.profiles (id),
  created_at        timestamptz not null default now()
);

create index if not exists project_updates_project_id_idx
  on public.project_updates (project_id, created_at desc);
create index if not exists project_updates_kind_idx
  on public.project_updates (project_id, kind);

alter table public.project_updates enable row level security;
grant select, insert on public.project_updates to authenticated;

-- Same audience as project docs: manager, CEO/admin, invited (accepted+) investors
drop policy if exists project_updates_select on public.project_updates;
create policy project_updates_select
  on public.project_updates for select to authenticated
  using (public.is_project_doc_reader(project_id));

-- Only the project owner (LM) or CEO/admin can post
drop policy if exists project_updates_insert on public.project_updates;
create policy project_updates_insert
  on public.project_updates for insert to authenticated
  with check (
    posted_by = auth.uid()
    and (
      public.is_project_owner(project_id)
      or public.is_ceo_or_admin()
    )
  );

-- ---------------------------------------------------------------------------
-- RPC: post_project_update
-- ---------------------------------------------------------------------------

create or replace function public.post_project_update(
  p_project_id uuid,
  p_kind public.project_update_kind,
  p_title text,
  p_body text default '',
  p_amount_minor bigint default null
)
returns public.project_updates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_update public.project_updates;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Title is required';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id;

  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.created_by <> auth.uid() and not public.is_ceo_or_admin() then
    raise exception 'Only the project manager can post updates';
  end if;

  if p_kind = 'FUND_USE'
     and (p_amount_minor is null or p_amount_minor <= 0) then
    raise exception 'Fund-use updates require an amount greater than zero';
  end if;

  insert into public.project_updates (project_id, kind, title, body, amount_minor, posted_by)
  values (
    p_project_id,
    p_kind,
    trim(p_title),
    coalesce(p_body, ''),
    p_amount_minor,
    auth.uid()
  )
  returning * into v_update;

  return v_update;
end;
$$;

grant execute on function public.post_project_update(
  uuid, public.project_update_kind, text, text, bigint
) to authenticated;
