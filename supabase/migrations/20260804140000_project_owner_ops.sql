-- ---------------------------------------------------------------------------
-- Project Owner ops layer (fits existing Prism LM + CEO + Investor model)
--
-- Roles:
--   LINE_MANAGER  = Prism (creates project, invites, confirms pay, approves ops)
--   PROJECT_OWNER = Originator linked to a project (drawdowns, propose profit)
--   CEO/ADMIN     = Prism control (approve listing/declarations, full visibility)
--   INVESTOR      = Capital (withdraw realized profit via request)
--
-- 2026-08-04
-- ---------------------------------------------------------------------------

-- 1. Role --------------------------------------------------------------------

alter type public.user_role add value if not exists 'PROJECT_OWNER';

-- 2. Project owner link (separate from created_by = Prism LM) ----------------

alter table public.projects
  add column if not exists project_owner_id uuid references public.profiles(id);

create index if not exists projects_project_owner_id_idx
  on public.projects (project_owner_id)
  where project_owner_id is not null;

comment on column public.projects.project_owner_id is
  'Originator / project owner party. Distinct from created_by (Prism Line Manager).';

-- Owner may read their projects
drop policy if exists projects_select_project_owner on public.projects;
create policy projects_select_project_owner
  on public.projects for select to authenticated
  using (project_owner_id = auth.uid());

-- 3. Notification types ------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'ACTIVITY_POST',
    'DECLARATION_SUBMITTED',
    'DECLARATION_APPROVED',
    'DECLARATION_REJECTED',
    'PROJECT_SUBMITTED',
    'PROJECT_APPROVED',
    'PROJECT_REJECTED',
    'NEW_MESSAGE',
    'PROOF_SUBMITTED',
    'TARGET_REACHED',
    'DRAWDOWN_REQUESTED',
    'DRAWDOWN_DECIDED',
    'WITHDRAWAL_REQUESTED',
    'WITHDRAWAL_DECIDED'
  ));

-- 4. Fund drawdown requests (owner → Prism before fund use) ------------------

create table if not exists public.fund_drawdowns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  amount_minor bigint not null check (amount_minor > 0),
  purpose text not null check (char_length(trim(purpose)) >= 3),
  category text not null default 'FUND_USE'
    check (category in ('FUND_USE', 'RISK_MITIGATION', 'OTHER')),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
  reference text,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fund_drawdowns_project_idx
  on public.fund_drawdowns (project_id, created_at desc);

alter table public.fund_drawdowns enable row level security;

drop policy if exists fund_drawdowns_select on public.fund_drawdowns;
create policy fund_drawdowns_select
  on public.fund_drawdowns for select to authenticated
  using (
    public.is_ceo_or_admin()
    or requested_by = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.created_by = auth.uid() or p.project_owner_id = auth.uid())
    )
  );

-- 5. Investor withdrawal requests --------------------------------------------

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  invite_id uuid not null references public.invites(id) on delete cascade,
  investor_id uuid not null references public.profiles(id),
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
  reference text,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists withdrawal_requests_investor_idx
  on public.withdrawal_requests (investor_id, created_at desc);

create index if not exists withdrawal_requests_project_idx
  on public.withdrawal_requests (project_id, created_at desc);

alter table public.withdrawal_requests enable row level security;

drop policy if exists withdrawal_requests_select on public.withdrawal_requests;
create policy withdrawal_requests_select
  on public.withdrawal_requests for select to authenticated
  using (
    public.is_ceo_or_admin()
    or investor_id = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.created_by = auth.uid()
    )
  );

-- 6. Assign / clear project owner (Prism LM or CEO) --------------------------

create or replace function public.assign_project_owner(
  p_project_id uuid,
  p_owner_id uuid
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_owner public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.created_by <> auth.uid() and not public.is_ceo_or_admin() then
    raise exception 'Only Prism (project Line Manager) or CEO can assign a project owner';
  end if;

  select * into v_owner from public.profiles where id = p_owner_id;
  if not found then
    raise exception 'Owner profile not found';
  end if;

  if v_owner.role <> 'PROJECT_OWNER' then
    raise exception 'User must have PROJECT_OWNER role';
  end if;

  update public.projects
  set project_owner_id = p_owner_id, updated_at = now()
  where id = p_project_id
  returning * into v_project;

  perform public.create_notifications(
    array[p_owner_id],
    'PROJECT_APPROVED',
    'You were assigned as project owner',
    coalesce(v_project.code || ' · ', '') || v_project.name,
    v_project.id,
    v_project.id,
    '/(tabs)/projects/' || v_project.id
  );

  return v_project;
end;
$$;

grant execute on function public.assign_project_owner(uuid, uuid) to authenticated;

-- 7. Drawdown RPCs -----------------------------------------------------------

create or replace function public.request_fund_drawdown(
  p_project_id uuid,
  p_amount_minor bigint,
  p_purpose text,
  p_category text default 'FUND_USE'
)
returns public.fund_drawdowns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_row public.fund_drawdowns;
  v_seq int;
  v_ref text;
  v_cat text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_purpose is null or char_length(trim(p_purpose)) < 3 then
    raise exception 'Purpose is required';
  end if;

  v_cat := coalesce(nullif(trim(p_category), ''), 'FUND_USE');
  if v_cat not in ('FUND_USE', 'RISK_MITIGATION', 'OTHER') then
    raise exception 'Invalid category';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.stage <> 'PROGRESS' then
    raise exception 'Drawdowns are only allowed while the project is in Progress';
  end if;

  if v_project.project_owner_id is distinct from auth.uid()
     and v_project.created_by is distinct from auth.uid()
     and not public.is_ceo_or_admin() then
    raise exception 'Only the project owner (or Prism) can request a drawdown';
  end if;

  select coalesce(max(
    cast(nullif(regexp_replace(coalesce(reference, ''), '^.*-DD(\d+)$', '\1'), '') as int)
  ), 0) + 1
  into v_seq
  from public.fund_drawdowns
  where project_id = p_project_id;

  v_ref := format('PRSM-%s-DD%s', v_project.code, lpad(v_seq::text, 3, '0'));

  insert into public.fund_drawdowns (
    project_id, requested_by, amount_minor, purpose, category, status, reference
  ) values (
    p_project_id, auth.uid(), p_amount_minor, trim(p_purpose), v_cat, 'PENDING', v_ref
  )
  returning * into v_row;

  if v_project.created_by is not null then
    perform public.create_notifications(
      array[v_project.created_by],
      'DRAWDOWN_REQUESTED',
      'Drawdown request · ' || v_ref,
      coalesce(v_project.name, 'Project') || ' · '
        || trim(to_char(p_amount_minor / 100.0, 'FM999,999,999,990.00'))
        || ' NGN · ' || v_cat,
      p_project_id,
      v_row.id,
      '/(tabs)/projects/' || p_project_id || '?tab=drawdowns'
    );
  end if;

  return v_row;
end;
$$;

grant execute on function public.request_fund_drawdown(uuid, bigint, text, text) to authenticated;

create or replace function public.decide_fund_drawdown(
  p_drawdown_id uuid,
  p_approve boolean,
  p_note text default null
)
returns public.fund_drawdowns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.fund_drawdowns;
  v_project public.projects;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from public.fund_drawdowns where id = p_drawdown_id for update;
  if not found then
    raise exception 'Drawdown not found';
  end if;

  if v_row.status <> 'PENDING' then
    raise exception 'Drawdown is not pending';
  end if;

  select * into v_project from public.projects where id = v_row.project_id;
  if v_project.created_by <> auth.uid() and not public.is_ceo_or_admin() then
    raise exception 'Only Prism (Line Manager) or CEO can decide a drawdown';
  end if;

  update public.fund_drawdowns
  set
    status = case when p_approve then 'APPROVED' else 'REJECTED' end,
    decided_by = auth.uid(),
    decided_at = now(),
    decision_note = nullif(trim(coalesce(p_note, '')), ''),
    updated_at = now()
  where id = p_drawdown_id
  returning * into v_row;

  if v_row.requested_by is not null then
    perform public.create_notifications(
      array[v_row.requested_by],
      'DRAWDOWN_DECIDED',
      case when p_approve then 'Drawdown approved · ' else 'Drawdown rejected · ' end
        || coalesce(v_row.reference, ''),
      coalesce(v_project.name, 'Project')
        || coalesce(' — ' || v_row.decision_note, ''),
      v_row.project_id,
      v_row.id,
      '/(tabs)/projects/' || v_row.project_id || '?tab=drawdowns'
    );
  end if;

  return v_row;
end;
$$;

grant execute on function public.decide_fund_drawdown(uuid, boolean, text) to authenticated;

create or replace function public.mark_fund_drawdown_paid(p_drawdown_id uuid)
returns public.fund_drawdowns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.fund_drawdowns;
  v_project public.projects;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from public.fund_drawdowns where id = p_drawdown_id for update;
  if not found then
    raise exception 'Drawdown not found';
  end if;
  if v_row.status <> 'APPROVED' then
    raise exception 'Only approved drawdowns can be marked paid';
  end if;

  select * into v_project from public.projects where id = v_row.project_id;
  if v_project.created_by <> auth.uid() and not public.is_ceo_or_admin() then
    raise exception 'Only Prism or CEO can mark a drawdown paid';
  end if;

  update public.fund_drawdowns
  set status = 'PAID', updated_at = now()
  where id = p_drawdown_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.mark_fund_drawdown_paid(uuid) to authenticated;

-- 8. Withdrawal RPCs ---------------------------------------------------------

create or replace function public.request_profit_withdrawal(
  p_invite_id uuid,
  p_amount_minor bigint
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites;
  v_project public.projects;
  v_available bigint;
  v_pending bigint;
  v_row public.withdrawal_requests;
  v_seq int;
  v_ref text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_invite from public.invites where id = p_invite_id for update;
  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_invite.investor_id <> auth.uid() then
    raise exception 'You can only withdraw from your own position';
  end if;

  if v_invite.status <> 'CONFIRMED' then
    raise exception 'Units must be confirmed before requesting a withdrawal';
  end if;

  select * into v_project from public.projects where id = v_invite.project_id;

  -- Realised profit available = sum of investor_payable CR for this party
  -- (from ledger) minus already requested PENDING/APPROVED/PAID withdrawals.
  select coalesce(sum(
    case when direction = 'CR' then amount_minor else -amount_minor end
  ), 0)
  into v_available
  from public.ledger_entries
  where project_id = v_invite.project_id
    and account_code = 'investor_payable'
    and party_id = auth.uid()::text;

  select coalesce(sum(amount_minor), 0) into v_pending
  from public.withdrawal_requests
  where invite_id = p_invite_id
    and status in ('PENDING', 'APPROVED', 'PAID');

  if p_amount_minor > greatest(v_available - v_pending, 0) then
    raise exception 'Requested amount exceeds available realised profit (% kobo)',
      greatest(v_available - v_pending, 0);
  end if;

  if greatest(v_available - v_pending, 0) <= 0 then
    raise exception 'No realised profit available to withdraw';
  end if;

  select coalesce(max(
    cast(nullif(regexp_replace(coalesce(reference, ''), '^.*-WD(\d+)$', '\1'), '') as int)
  ), 0) + 1
  into v_seq
  from public.withdrawal_requests
  where project_id = v_invite.project_id;

  v_ref := format('PRSM-%s-WD%s', v_project.code, lpad(v_seq::text, 3, '0'));

  insert into public.withdrawal_requests (
    project_id, invite_id, investor_id, amount_minor, status, reference
  ) values (
    v_invite.project_id, p_invite_id, auth.uid(), p_amount_minor, 'PENDING', v_ref
  )
  returning * into v_row;

  if v_project.created_by is not null then
    perform public.create_notifications(
      array[v_project.created_by],
      'WITHDRAWAL_REQUESTED',
      'Withdrawal request · ' || v_ref,
      coalesce(v_project.name, 'Project') || ' · investor requested payout',
      v_invite.project_id,
      v_row.id,
      '/(tabs)/projects/' || v_invite.project_id || '?tab=withdrawals'
    );
  end if;

  return v_row;
end;
$$;

grant execute on function public.request_profit_withdrawal(uuid, bigint) to authenticated;

create or replace function public.decide_profit_withdrawal(
  p_withdrawal_id uuid,
  p_approve boolean,
  p_note text default null
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.withdrawal_requests;
  v_project public.projects;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from public.withdrawal_requests where id = p_withdrawal_id for update;
  if not found then
    raise exception 'Withdrawal not found';
  end if;
  if v_row.status <> 'PENDING' then
    raise exception 'Withdrawal is not pending';
  end if;

  select * into v_project from public.projects where id = v_row.project_id;
  if v_project.created_by <> auth.uid() and not public.is_ceo_or_admin() then
    raise exception 'Only Prism or CEO can decide a withdrawal';
  end if;

  update public.withdrawal_requests
  set
    status = case when p_approve then 'APPROVED' else 'REJECTED' end,
    decided_by = auth.uid(),
    decided_at = now(),
    decision_note = nullif(trim(coalesce(p_note, '')), ''),
    updated_at = now()
  where id = p_withdrawal_id
  returning * into v_row;

  perform public.create_notifications(
    array[v_row.investor_id],
    'WITHDRAWAL_DECIDED',
    case when p_approve then 'Withdrawal approved · ' else 'Withdrawal declined · ' end
      || coalesce(v_row.reference, ''),
    coalesce(v_project.name, 'Project')
      || coalesce(' — ' || v_row.decision_note, ''),
    v_row.project_id,
    v_row.id,
    '/(tabs)/statements'
  );

  return v_row;
end;
$$;

grant execute on function public.decide_profit_withdrawal(uuid, boolean, text) to authenticated;

create or replace function public.mark_profit_withdrawal_paid(p_withdrawal_id uuid)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.withdrawal_requests;
  v_project public.projects;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from public.withdrawal_requests where id = p_withdrawal_id for update;
  if not found then
    raise exception 'Withdrawal not found';
  end if;
  if v_row.status <> 'APPROVED' then
    raise exception 'Only approved withdrawals can be marked paid';
  end if;

  select * into v_project from public.projects where id = v_row.project_id;
  if v_project.created_by <> auth.uid() and not public.is_ceo_or_admin() then
    raise exception 'Only Prism or CEO can mark a withdrawal paid';
  end if;

  update public.withdrawal_requests
  set status = 'PAID', updated_at = now()
  where id = p_withdrawal_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.mark_profit_withdrawal_paid(uuid) to authenticated;

-- Available realised profit helper for investors
create or replace function public.investor_withdrawable_minor(p_invite_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_invite public.invites;
  v_available bigint;
  v_pending bigint;
begin
  select * into v_invite from public.invites where id = p_invite_id;
  if not found then
    return 0;
  end if;
  if v_invite.investor_id <> auth.uid() and not public.is_ceo_or_admin() then
    return 0;
  end if;

  select coalesce(sum(
    case when direction = 'CR' then amount_minor else -amount_minor end
  ), 0)
  into v_available
  from public.ledger_entries
  where project_id = v_invite.project_id
    and account_code = 'investor_payable'
    and party_id = v_invite.investor_id::text;

  select coalesce(sum(amount_minor), 0) into v_pending
  from public.withdrawal_requests
  where invite_id = p_invite_id
    and status in ('PENDING', 'APPROVED', 'PAID');

  return greatest(v_available - v_pending, 0);
end;
$$;

grant execute on function public.investor_withdrawable_minor(uuid) to authenticated;

-- 9. Allow project owner to declare profit (Prism LM still can) --------------

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

  -- Project owner (originator) OR Prism LM (created_by) OR CEO/admin
  if v_project.created_by <> auth.uid()
     and v_project.project_owner_id is distinct from auth.uid()
     and not public.is_ceo_or_admin() then
    raise exception 'Only the project owner, Prism LM, or CEO can declare profit';
  end if;

  if not p_is_final and v_project.stage <> 'PROGRESS' then
    raise exception 'Profit can only be declared while the project is in Progress';
  end if;
  if v_project.total_units is null or v_project.total_units <= 0 then
    raise exception 'Project is not configured for unit-based profit distribution';
  end if;

  v_net := p_gross_minor - p_costs_minor;
  v_prism := floor(v_net::numeric * coalesce(v_project.platform_fee_bps, 750) / 10000.0)::bigint;
  v_distributable := v_net - v_prism;
  v_pool := floor(v_distributable::numeric * v_project.profit_split_investor_bps / 10000.0)::bigint;
  v_manager := v_distributable - v_pool;
  v_per_unit := floor(v_pool::numeric / v_project.total_units)::bigint;

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

-- 10. Notify project owner when target reached (Acceptance → Progress) -------

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

    -- Notify Prism LM + project owner that target was achieved
    perform public.create_notifications(
      array_remove(array[new.created_by, new.project_owner_id], null),
      'TARGET_REACHED',
      'Target reached · ' || coalesce(new.code, 'project'),
      coalesce(new.name, 'Project') || ' has reached its fundraising target and moved to Progress.',
      new.id,
      new.id,
      '/(tabs)/projects/' || new.id
    );
  end if;
  return new;
end;
$$;

-- 11. Export snapshot RPC (CEO + Prism LM) -----------------------------------

create or replace function public.export_project_pack(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_project public.projects;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_project from public.projects where id = p_project_id;
  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.created_by <> auth.uid()
     and v_project.project_owner_id is distinct from auth.uid()
     and not public.is_ceo_or_admin() then
    raise exception 'Not allowed to export this project';
  end if;

  select jsonb_build_object(
    'exportedAt', now(),
    'project', jsonb_build_object(
      'id', v_project.id,
      'code', v_project.code,
      'name', v_project.name,
      'stage', v_project.stage,
      'approvalStatus', v_project.approval_status,
      'targetMinor', v_project.target_minor,
      'raisedMinor', v_project.raised_minor,
      'totalUnits', v_project.total_units,
      'platformFeeBps', v_project.platform_fee_bps,
      'createdBy', v_project.created_by,
      'projectOwnerId', v_project.project_owner_id
    ),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'email', i.email,
        'status', i.status,
        'unitsPledged', i.units_pledged,
        'unitsAllotted', i.units_allotted,
        'amountMinor', i.amount_minor,
        'paymentReference', i.payment_reference,
        'minUnits', i.min_units,
        'minWaiverStatus', i.min_waiver_status
      ) order by i.created_at)
      from public.invites i where i.project_id = p_project_id
    ), '[]'::jsonb),
    'declarations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'reference', d.reference,
        'status', d.status,
        'label', d.label,
        'isFinal', d.is_final,
        'grossMinor', d.gross_minor,
        'netMinor', d.net_minor,
        'investorPoolMinor', d.investor_pool_minor,
        'platformFeeMinor', d.platform_fee_minor,
        'managerShareMinor', d.manager_share_minor
      ) order by d.created_at)
      from public.profit_declarations d where d.project_id = p_project_id
    ), '[]'::jsonb),
    'drawdowns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'reference', f.reference,
        'status', f.status,
        'amountMinor', f.amount_minor,
        'purpose', f.purpose,
        'category', f.category
      ) order by f.created_at)
      from public.fund_drawdowns f where f.project_id = p_project_id
    ), '[]'::jsonb),
    'withdrawals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id,
        'reference', w.reference,
        'status', w.status,
        'amountMinor', w.amount_minor,
        'investorId', w.investor_id
      ) order by w.created_at)
      from public.withdrawal_requests w where w.project_id = p_project_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.export_project_pack(uuid) to authenticated;
