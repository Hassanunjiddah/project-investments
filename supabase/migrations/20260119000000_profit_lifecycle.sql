-- RibhShare Phase 3: profit lifecycle
-- 2026-01-19
-- Adds profit_updates + investor_payouts tables, columns for realised profit tracking,
-- auto-transition Acceptance -> Progress, RPCs to post profit updates & finalize projects.

-- ---------------------------------------------------------------------------
-- Columns on projects
-- ---------------------------------------------------------------------------

alter table public.projects
  add column if not exists realised_profit_minor bigint not null default 0
    check (realised_profit_minor >= 0);

alter table public.projects
  add column if not exists progress_started_at timestamptz;

-- ---------------------------------------------------------------------------
-- profit_updates: LM posts a delta amount of realised profit
-- ---------------------------------------------------------------------------

create table if not exists public.profit_updates (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  amount_minor      bigint not null check (amount_minor > 0),
  note              text not null default '',
  posted_by         uuid not null references public.profiles (id),
  created_at        timestamptz not null default now()
);

create index if not exists profit_updates_project_id_idx
  on public.profit_updates (project_id, created_at desc);

alter table public.profit_updates enable row level security;
grant select, insert on public.profit_updates to authenticated;

-- Anyone with access to the project (LM, CEO, confirmed investors) can read updates
drop policy if exists profit_updates_select on public.profit_updates;
create policy profit_updates_select
  on public.profit_updates for select to authenticated
  using (
    public.is_ceo_or_admin()
    or public.is_project_owner(project_id)
    or exists (
      select 1 from public.invites i
      where i.project_id = profit_updates.project_id
        and i.investor_id = auth.uid()
        and i.status = 'CONFIRMED'
    )
  );

-- Only the project owner (LM) can insert; enforced additionally in the RPC.
drop policy if exists profit_updates_insert on public.profit_updates;
create policy profit_updates_insert
  on public.profit_updates for insert to authenticated
  with check (
    posted_by = auth.uid()
    and public.is_project_owner(project_id)
  );

-- ---------------------------------------------------------------------------
-- investor_payouts: final snapshot when project ends
-- ---------------------------------------------------------------------------

create table if not exists public.investor_payouts (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  invite_id         uuid not null references public.invites (id) on delete cascade,
  investor_id       uuid not null references public.profiles (id),
  capital_minor     bigint not null check (capital_minor >= 0),
  profit_minor      bigint not null check (profit_minor >= 0),
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  constraint investor_payouts_invite_unique unique (invite_id)
);

create index if not exists investor_payouts_project_id_idx
  on public.investor_payouts (project_id);
create index if not exists investor_payouts_investor_id_idx
  on public.investor_payouts (investor_id);

alter table public.investor_payouts enable row level security;
grant select, update on public.investor_payouts to authenticated;

drop policy if exists investor_payouts_select on public.investor_payouts;
create policy investor_payouts_select
  on public.investor_payouts for select to authenticated
  using (
    public.is_ceo_or_admin()
    or public.is_project_owner(project_id)
    or investor_id = auth.uid()
  );

-- Only the project manager can mark payouts as paid (paid_at)
drop policy if exists investor_payouts_update on public.investor_payouts;
create policy investor_payouts_update
  on public.investor_payouts for update to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

-- ---------------------------------------------------------------------------
-- Auto-transition: Acceptance -> Progress when target is fully raised
-- ---------------------------------------------------------------------------

create or replace function public.check_project_progress_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raised_minor >= new.target_minor
     and new.stage = 'ACCEPTANCE'
     and new.approval_status = 'APPROVED' then
    new.stage := 'PROGRESS';
    new.progress_started_at := coalesce(new.progress_started_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists projects_progress_transition on public.projects;
create trigger projects_progress_transition
  before update of raised_minor on public.projects
  for each row
  when (new.raised_minor is distinct from old.raised_minor)
  execute function public.check_project_progress_transition();

-- ---------------------------------------------------------------------------
-- RPC: post_profit_update
-- ---------------------------------------------------------------------------

create or replace function public.post_profit_update(
  p_project_id uuid,
  p_amount_minor bigint,
  p_note text default ''
)
returns public.profit_updates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_update public.profit_updates;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.created_by <> auth.uid() and not public.is_ceo_or_admin() then
    raise exception 'Only the project manager can post profit updates';
  end if;

  if v_project.stage <> 'PROGRESS' then
    raise exception 'Profit updates can only be posted while the project is in Progress';
  end if;

  insert into public.profit_updates (project_id, amount_minor, note, posted_by)
  values (p_project_id, p_amount_minor, coalesce(p_note, ''), auth.uid())
  returning * into v_update;

  update public.projects
  set realised_profit_minor = realised_profit_minor + p_amount_minor,
      updated_at = now()
  where id = p_project_id;

  return v_update;
end;
$$;

grant execute on function public.post_profit_update(uuid, bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: finalize_project_if_due
-- Called by clients on project load. Moves stage -> END if timeline has elapsed
-- and creates investor_payouts. Idempotent.
-- ---------------------------------------------------------------------------

create or replace function public.finalize_project_if_due(p_project_id uuid)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_end_at timestamptz;
  v_investor_profit_bps int;
  v_total_raised bigint;
begin
  select * into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.stage <> 'PROGRESS' or v_project.progress_started_at is null then
    return v_project;
  end if;

  v_end_at := case v_project.duration_unit
    when 'DAYS'   then v_project.progress_started_at + make_interval(days  => v_project.duration_value)
    when 'WEEKS'  then v_project.progress_started_at + make_interval(weeks => v_project.duration_value)
    when 'MONTHS' then v_project.progress_started_at + make_interval(months=> v_project.duration_value)
  end;

  if now() < v_end_at then
    return v_project;
  end if;

  v_investor_profit_bps := v_project.profit_split_investor_bps;
  v_total_raised := greatest(v_project.raised_minor, 1); -- guard divide-by-zero

  -- Create payout rows for every confirmed investor
  insert into public.investor_payouts (project_id, invite_id, investor_id, capital_minor, profit_minor)
  select
    i.project_id,
    i.id,
    i.investor_id,
    coalesce(i.amount_minor, 0),
    round(
      v_project.realised_profit_minor::numeric
      * v_investor_profit_bps / 10000.0
      * coalesce(i.amount_minor, 0)::numeric
      / v_total_raised::numeric
    )::bigint
  from public.invites i
  where i.project_id = p_project_id
    and i.status = 'CONFIRMED'
  on conflict (invite_id) do nothing;

  update public.projects
  set stage = 'END', updated_at = now()
  where id = p_project_id
  returning * into v_project;

  return v_project;
end;
$$;

grant execute on function public.finalize_project_if_due(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: get_investor_profit_summary — realised profit across all confirmed invites
-- Returns per-project rows so the client can aggregate.
-- ---------------------------------------------------------------------------

create or replace function public.get_investor_profit_summary(p_investor_id uuid default null)
returns table (
  project_id uuid,
  invite_id uuid,
  capital_minor bigint,
  realised_profit_minor bigint,
  investor_share_minor bigint,
  project_stage public.project_stage,
  project_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select coalesce(p_investor_id, auth.uid()) as uid
  )
  select
    p.id as project_id,
    i.id as invite_id,
    coalesce(i.amount_minor, 0) as capital_minor,
    p.realised_profit_minor,
    case
      when p.raised_minor > 0 then
        round(
          p.realised_profit_minor::numeric
          * p.profit_split_investor_bps / 10000.0
          * coalesce(i.amount_minor, 0)::numeric
          / p.raised_minor::numeric
        )::bigint
      else 0
    end as investor_share_minor,
    p.stage as project_stage,
    p.name as project_name
  from public.invites i
  join public.projects p on p.id = i.project_id
  cross join target
  where i.investor_id = target.uid
    and i.status = 'CONFIRMED';
$$;

grant execute on function public.get_investor_profit_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: get_manager_profit_summary — total manager share across all projects
-- ---------------------------------------------------------------------------

create or replace function public.get_manager_profit_summary(p_manager_id uuid default null)
returns table (
  total_realised_profit_minor bigint,
  manager_share_minor bigint,
  project_count int
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select coalesce(p_manager_id, auth.uid()) as uid
  )
  select
    coalesce(sum(p.realised_profit_minor), 0)::bigint as total_realised_profit_minor,
    coalesce(
      sum(
        round(
          p.realised_profit_minor::numeric
          * (10000 - p.profit_split_investor_bps) / 10000.0
        )::bigint
      ),
      0
    )::bigint as manager_share_minor,
    count(*)::int as project_count
  from public.projects p
  cross join target
  where p.created_by = target.uid
    and p.realised_profit_minor > 0;
$$;

grant execute on function public.get_manager_profit_summary(uuid) to authenticated;
