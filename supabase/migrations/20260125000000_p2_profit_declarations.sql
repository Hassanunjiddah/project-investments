-- ---------------------------------------------------------------------------
-- P2: Maker-checker profit declarations + waterfall
--
-- Model:
--   * profit_declarations — every profit event is a PENDING row until a CEO
--     (checker) approves. On approve, waterfall math is settled and stored
--     immutably; project.realised_profit_minor is incremented so all existing
--     dashboards keep working. Rejections leave a permanent audit trail.
--   * Same pipeline handles the End-Project distribution (is_final = true) so
--     there's exactly one code path for money movement.
--   * Waterfall: net = gross - costs → prism_fee = net * platform_fee_bps →
--     distributable = net - prism_fee → investor_pool = distributable *
--     profit_split_investor_bps → manager_share = distributable - investor_pool
--     → per_unit = investor_pool / total_units.
-- ---------------------------------------------------------------------------

create table if not exists public.profit_declarations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  reference text unique,                             -- PRSM-<code>-DECL<seq>
  label text,                                        -- e.g. "H2 2027"
  is_final boolean not null default false,           -- true = end-project
  gross_amount_minor bigint not null check (gross_amount_minor >= 0),
  costs_minor bigint not null default 0 check (costs_minor >= 0),
  net_amount_minor bigint not null,
  platform_fee_bps int not null,
  platform_fee_minor bigint not null,
  distributable_minor bigint not null,
  profit_split_investor_bps int not null,
  investor_pool_minor bigint not null,
  manager_share_minor bigint not null,
  total_units_at_declaration int not null,
  per_unit_minor bigint not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  declared_by uuid not null references public.profiles(id),
  declared_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  rejected_by uuid references public.profiles(id),
  rejected_at timestamptz,
  rejection_note text
);

create index if not exists profit_declarations_project_idx
  on public.profit_declarations (project_id, declared_at desc);

create index if not exists profit_declarations_status_idx
  on public.profit_declarations (status);

alter table public.profit_declarations enable row level security;

drop policy if exists profit_declarations_read on public.profit_declarations;
create policy profit_declarations_read on public.profit_declarations
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.created_by = auth.uid() or public.is_ceo_or_admin())
    )
    or exists (
      select 1 from public.invites i
      where i.project_id = profit_declarations.project_id
        and i.investor_id = auth.uid()
        and i.status = 'CONFIRMED'
    )
  );

-- Writes only through RPCs (security definer), no direct insert/update policy.

-- ---------------------------------------------------------------------------
-- RPC: declare_profit
-- LM (or CEO/admin) creates a PENDING declaration with waterfall pre-computed.
-- Validates project stage (PROGRESS, unless is_final), permissions, positivity.
-- ---------------------------------------------------------------------------

create or replace function public.declare_profit(
  p_project_id uuid,
  p_gross_minor bigint,
  p_costs_minor bigint default 0,
  p_label text default null,
  p_is_final boolean default false
)
returns public.profit_declarations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_net bigint;
  v_prism bigint;
  v_distributable bigint;
  v_pool bigint;
  v_manager bigint;
  v_per_unit bigint;
  v_seq int;
  v_reference text;
  v_row public.profit_declarations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_gross_minor is null or p_gross_minor < 0 then
    raise exception 'Gross amount must be zero or positive';
  end if;
  if p_costs_minor is null or p_costs_minor < 0 then
    raise exception 'Costs must be zero or positive';
  end if;
  if p_costs_minor > p_gross_minor then
    raise exception 'Costs (%) cannot exceed gross (%)', p_costs_minor, p_gross_minor;
  end if;

  select * into v_project from public.projects where id = p_project_id for share;
  if not found then
    raise exception 'Project not found';
  end if;
  if v_project.created_by <> auth.uid() and not public.is_ceo_or_admin() then
    raise exception 'Only the project manager can declare profit';
  end if;
  if not p_is_final and v_project.stage <> 'PROGRESS' then
    raise exception 'Profit can only be declared while the project is in Progress';
  end if;
  if v_project.total_units is null or v_project.total_units <= 0 then
    raise exception 'Project is not configured for unit-based profit distribution';
  end if;

  -- Waterfall math
  v_net := p_gross_minor - p_costs_minor;
  v_prism := floor(v_net::numeric * coalesce(v_project.platform_fee_bps, 750) / 10000.0)::bigint;
  v_distributable := v_net - v_prism;
  v_pool := floor(v_distributable::numeric * v_project.profit_split_investor_bps / 10000.0)::bigint;
  v_manager := v_distributable - v_pool;
  v_per_unit := floor(v_pool::numeric / v_project.total_units)::bigint;

  -- Sequence for reference
  select coalesce(max(seq), 0) + 1 into v_seq
  from (
    select cast(regexp_replace(reference, '^.*-DECL(\d+)$', '\1') as int) as seq
    from public.profit_declarations
    where project_id = p_project_id
      and reference ~ '-DECL\d+$'
  ) t;
  v_reference := format('PRSM-%s-DECL%s', v_project.code, lpad(v_seq::text, 3, '0'));

  insert into public.profit_declarations (
    project_id, reference, label, is_final,
    gross_amount_minor, costs_minor, net_amount_minor,
    platform_fee_bps, platform_fee_minor,
    distributable_minor,
    profit_split_investor_bps, investor_pool_minor, manager_share_minor,
    total_units_at_declaration, per_unit_minor,
    status, declared_by
  )
  values (
    p_project_id, v_reference, coalesce(p_label, ''), coalesce(p_is_final, false),
    p_gross_minor, p_costs_minor, v_net,
    coalesce(v_project.platform_fee_bps, 750), v_prism,
    v_distributable,
    v_project.profit_split_investor_bps, v_pool, v_manager,
    v_project.total_units, v_per_unit,
    'PENDING', auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.declare_profit(uuid, bigint, bigint, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: approve_profit_declaration
-- Only CEO/admin (checker) can approve. On approve:
--   * declaration -> APPROVED, timestamps stamped
--   * project.realised_profit_minor += gross (keeps existing dashboards working)
--   * if is_final: project.stage -> END, generate investor_payouts rows
-- ---------------------------------------------------------------------------

create or replace function public.approve_profit_declaration(p_declaration_id uuid)
returns public.profit_declarations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profit_declarations;
  v_project public.projects;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_ceo_or_admin() then
    raise exception 'Only CEO/Finance Admin can approve profit declarations';
  end if;

  select * into v_row from public.profit_declarations where id = p_declaration_id for update;
  if not found then
    raise exception 'Declaration not found';
  end if;
  if v_row.status <> 'PENDING' then
    raise exception 'Declaration is already %', v_row.status;
  end if;
  if v_row.declared_by = auth.uid() then
    raise exception 'You cannot approve a declaration you submitted (four-eyes principle)';
  end if;

  select * into v_project from public.projects where id = v_row.project_id for update;

  update public.profit_declarations
  set
    status = 'APPROVED',
    approved_by = auth.uid(),
    approved_at = now()
  where id = p_declaration_id
  returning * into v_row;

  -- Ripple into project + payouts
  update public.projects
  set realised_profit_minor = realised_profit_minor + v_row.gross_amount_minor,
      updated_at = now()
  where id = v_row.project_id;

  if v_row.is_final then
    -- Create payout rows for every confirmed investor.
    -- Pro-rata by allotted units, using the per-unit figure locked at declaration.
    insert into public.investor_payouts (project_id, invite_id, investor_id, capital_minor, profit_minor)
    select
      i.project_id,
      i.id,
      i.investor_id,
      coalesce(i.amount_minor, 0),
      coalesce(i.units_allotted, i.units_pledged, 0)::bigint * v_row.per_unit_minor
    from public.invites i
    where i.project_id = v_row.project_id
      and i.status = 'CONFIRMED'
    on conflict (invite_id) do nothing;

    update public.projects
    set stage = 'END', updated_at = now()
    where id = v_row.project_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.approve_profit_declaration(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: reject_profit_declaration
-- ---------------------------------------------------------------------------

create or replace function public.reject_profit_declaration(
  p_declaration_id uuid,
  p_note text default ''
)
returns public.profit_declarations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profit_declarations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_ceo_or_admin() then
    raise exception 'Only CEO/Finance Admin can reject profit declarations';
  end if;

  select * into v_row from public.profit_declarations where id = p_declaration_id for update;
  if not found then
    raise exception 'Declaration not found';
  end if;
  if v_row.status <> 'PENDING' then
    raise exception 'Declaration is already %', v_row.status;
  end if;

  update public.profit_declarations
  set
    status = 'REJECTED',
    rejected_by = auth.uid(),
    rejected_at = now(),
    rejection_note = coalesce(p_note, '')
  where id = p_declaration_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.reject_profit_declaration(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- List helper: pending declarations across all projects the caller can approve
-- (i.e. CEO/admin sees everything, LM sees nothing here since they can't
-- approve).
-- ---------------------------------------------------------------------------

create or replace function public.list_pending_declarations()
returns setof public.profit_declarations
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.profit_declarations
  where status = 'PENDING'
    and public.is_ceo_or_admin()
  order by declared_at asc;
$$;

grant execute on function public.list_pending_declarations() to authenticated;
