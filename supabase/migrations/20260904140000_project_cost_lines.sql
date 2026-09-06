-- Per-project cost lines (CAPEX / OPEX outflows). Inflows are NOT logged
-- here — they come from confirmed invites / funding rounds.

-- Enum value must commit in a prior migration before functions insert it.
alter type public.task_kind add value if not exists 'DECIDE_FUNDING_ROUND';

create table if not exists public.project_cost_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  occurred_on date not null,
  description text not null check (char_length(trim(description)) between 2 and 200),
  class text not null check (class in ('CAPEX', 'OPEX')),
  nature text not null check (nature in ('ONE_TIME', 'RECURRING')),
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_cost_minor bigint not null check (unit_cost_minor >= 0),
  annual_frequency int not null default 1 check (annual_frequency between 1 and 365),
  constraint project_cost_lines_one_time_freq
    check (nature = 'RECURRING' or annual_frequency = 1),
  total_minor bigint generated always as
    (round(quantity * unit_cost_minor * annual_frequency)::bigint) stored,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_cost_lines_project_occurred_idx
  on public.project_cost_lines (project_id, occurred_on desc);

alter table public.project_cost_lines enable row level security;

create or replace function public.can_manage_project_cost_lines(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (
        public.is_ceo_or_admin()
        or p.created_by = auth.uid()
        or p.project_owner_id = auth.uid()
      )
  );
$$;

create or replace function public.can_read_project_cost_lines(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_manage_project_cost_lines(p_project_id)
    or exists (
      select 1 from public.invites i
      where i.project_id = p_project_id
        and i.investor_id = auth.uid()
        and i.status = 'CONFIRMED'
    );
$$;

create policy project_cost_lines_select
  on public.project_cost_lines for select to authenticated
  using (public.can_read_project_cost_lines(project_id));

create policy project_cost_lines_insert
  on public.project_cost_lines for insert to authenticated
  with check (
    public.can_manage_project_cost_lines(project_id)
    and created_by = auth.uid()
  );

create policy project_cost_lines_update
  on public.project_cost_lines for update to authenticated
  using (public.can_manage_project_cost_lines(project_id))
  with check (public.can_manage_project_cost_lines(project_id));

create policy project_cost_lines_delete
  on public.project_cost_lines for delete to authenticated
  using (public.can_manage_project_cost_lines(project_id));

grant select, insert, update, delete on public.project_cost_lines to authenticated;
