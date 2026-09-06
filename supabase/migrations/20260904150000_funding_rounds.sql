-- Additional capital raises (funding rounds) go through CEO approval, then
-- reuse the existing invite → pledge → proof → confirm pipeline.

create table if not exists public.funding_rounds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  additional_units int not null check (additional_units > 0),
  additional_minor bigint not null check (additional_minor > 0),
  unit_price_minor bigint not null check (unit_price_minor > 0),
  reason text not null check (char_length(trim(reason)) between 5 and 500),
  cost_line_ids uuid[] not null default '{}',
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by uuid not null references public.profiles(id),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists funding_rounds_project_idx
  on public.funding_rounds (project_id, created_at desc);
create index if not exists funding_rounds_pending_idx
  on public.funding_rounds (status) where status = 'PENDING';

alter table public.funding_rounds enable row level security;

create policy funding_rounds_select
  on public.funding_rounds for select to authenticated
  using (public.can_read_project_cost_lines(project_id));

-- Writes go through RPCs (security definer). No direct insert/update.
grant select on public.funding_rounds to authenticated;

alter table public.invites
  add column if not exists round_id uuid references public.funding_rounds(id);

alter table public.invites drop constraint if exists invites_project_email_unique;

-- NULL round_id = original raise. Coalesce so two original-raise invites for
-- the same email still collide.
create unique index if not exists invites_project_email_round_uidx
  on public.invites (
    project_id,
    lower(email),
    coalesce(round_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create or replace function public.request_funding_round(
  p_project_id uuid,
  p_additional_units int,
  p_reason text,
  p_cost_line_ids uuid[] default '{}'
)
returns public.funding_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_price bigint;
  v_row public.funding_rounds;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_additional_units is null or p_additional_units <= 0 then
    raise exception 'additional_units must be a positive integer';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 5 then
    raise exception 'A reason of at least 5 characters is required';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;
  if v_project.approval_status <> 'APPROVED' then
    raise exception 'Project must be approved before requesting additional capital';
  end if;
  if v_project.created_by <> auth.uid()
     and v_project.project_owner_id <> auth.uid()
     and not public.is_ceo_or_admin() then
    raise exception 'Only the project manager or owner can request additional capital';
  end if;
  if coalesce(v_project.total_units, 0) <= 0 or v_project.target_minor <= 0 then
    raise exception 'Project unit economics are not set';
  end if;
  if v_project.target_minor % v_project.total_units <> 0 then
    raise exception 'Project target does not divide evenly by total units';
  end if;

  v_price := v_project.target_minor / v_project.total_units;

  insert into public.funding_rounds (
    project_id, additional_units, additional_minor, unit_price_minor,
    reason, cost_line_ids, status, requested_by
  ) values (
    p_project_id,
    p_additional_units,
    p_additional_units::bigint * v_price,
    v_price,
    trim(p_reason),
    coalesce(p_cost_line_ids, '{}'),
    'PENDING',
    auth.uid()
  ) returning * into v_row;

  insert into public.tasks (
    kind, title, project_id, assignee_role, status
  ) values (
    'DECIDE_FUNDING_ROUND',
    'Additional capital: ' || v_project.code,
    p_project_id,
    'CEO',
    'OPEN'
  );

  perform public.create_notifications(
    public.ceo_admin_ids(),
    'PROJECT_SUBMITTED',
    'Additional capital requested',
    v_project.code || ' · ' || trim(to_char(p_additional_units, 'FM999999990'))
      || ' units (' || trim(to_char(v_row.additional_minor / 100.0, 'FM999,999,999,990')) || ' NGN)',
    p_project_id,
    null,
    '/(tabs)/approvals'
  );

  return v_row;
end;
$$;

create or replace function public.decide_funding_round(
  p_round_id uuid,
  p_status text,
  p_note text default null
)
returns public.funding_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.funding_rounds;
  v_project public.projects;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_ceo_or_admin() then
    raise exception 'Only the CEO can decide a funding round';
  end if;
  if p_status not in ('APPROVED', 'REJECTED') then
    raise exception 'status must be APPROVED or REJECTED';
  end if;

  select * into v_row from public.funding_rounds where id = p_round_id for update;
  if not found then
    raise exception 'Funding round not found';
  end if;
  if v_row.status <> 'PENDING' then
    raise exception 'Funding round is not pending (current: %)', v_row.status;
  end if;

  select * into v_project from public.projects where id = v_row.project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  if p_status = 'APPROVED' then
    update public.projects
    set
      total_units = total_units + v_row.additional_units,
      target_minor = target_minor + v_row.additional_minor,
      updated_at = now()
    where id = v_project.id;
  end if;

  update public.funding_rounds
  set
    status = p_status,
    decided_by = auth.uid(),
    decided_at = now(),
    decision_note = nullif(trim(coalesce(p_note, '')), ''),
    updated_at = now()
  where id = p_round_id
  returning * into v_row;

  update public.tasks
  set status = 'COMPLETED'
  where project_id = v_project.id
    and kind = 'DECIDE_FUNDING_ROUND'
    and status = 'OPEN';

  if v_row.requested_by is not null then
    perform public.create_notifications(
      array[v_row.requested_by],
      case when p_status = 'APPROVED' then 'PROJECT_APPROVED' else 'PROJECT_REJECTED' end,
      case when p_status = 'APPROVED'
        then 'Additional capital approved'
        else 'Additional capital rejected' end,
      v_project.code || ' · ' || coalesce(p_note, p_status),
      v_project.id,
      null,
      '/(tabs)/projects/' || v_project.id || '?tab=costlines'
    );
  end if;

  return v_row;
end;
$$;

create or replace function public.list_pending_funding_rounds()
returns setof public.funding_rounds
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.funding_rounds
  where status = 'PENDING'
    and public.is_ceo_or_admin()
  order by created_at asc;
$$;

grant execute on function public.request_funding_round(uuid, int, text, uuid[]) to authenticated;
grant execute on function public.decide_funding_round(uuid, text, text) to authenticated;
grant execute on function public.list_pending_funding_rounds() to authenticated;
