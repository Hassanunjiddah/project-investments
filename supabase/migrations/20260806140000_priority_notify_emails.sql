-- Priority event emails: drawdowns, withdrawals, profit proposals, payment proofs.
-- Also ensures notify-investors is invoked for request-class events that already
-- create in-app notifications. 2026-08-06

-- ── Proof submitted → email LM ───────────────────────────────────────────────
create or replace function public.trg_inapp_proof_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_project_name text;
  v_investor_label text;
begin
  if NEW.status is not distinct from OLD.status then
    return NEW;
  end if;
  if NEW.status <> 'PROOF_SUBMITTED' then
    return NEW;
  end if;

  select p.created_by, p.name
    into v_owner, v_project_name
  from public.projects p
  where p.id = NEW.project_id;

  if v_owner is null then
    return NEW;
  end if;

  v_investor_label := coalesce(NEW.email, 'Investor');

  perform public.create_notifications(
    array[v_owner],
    'PROOF_SUBMITTED',
    'Payment proof submitted',
    v_investor_label || ' · ' || coalesce(v_project_name, 'Project') || ' awaits confirmation.',
    NEW.project_id,
    NEW.id,
    '/(tabs)/projects/' || NEW.project_id || '?tab=investors&invite=' || NEW.id::text
  );

  perform public.notify_investors_via_edge('PROOF_SUBMITTED', NEW.id);

  return NEW;
end;
$$;

-- ── Owner proposes profit → email LM ───────────────────────────────────────
create or replace function public.propose_profit_to_lm(
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

  select * into v_project from public.projects where id = p_project_id for share;
  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.project_owner_id is distinct from auth.uid() then
    raise exception 'Only the project owner can propose profit to Prism';
  end if;

  if not coalesce(p_is_final, false) and v_project.stage <> 'PROGRESS' then
    raise exception 'Profit can only be proposed while the project is in Progress';
  end if;
  if v_project.total_units is null or v_project.total_units <= 0 then
    raise exception 'Project is not configured for unit-based profit distribution';
  end if;
  if p_gross_minor is null or p_gross_minor < 0 then
    raise exception 'Gross amount must be zero or positive';
  end if;
  if p_costs_minor is null or p_costs_minor < 0 then
    raise exception 'Costs must be zero or positive';
  end if;
  if p_costs_minor > p_gross_minor then
    raise exception 'Costs cannot exceed gross';
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
    'PROPOSED', auth.uid()
  )
  returning * into v_row;

  if v_project.created_by is not null then
    perform public.create_notifications(
      array[v_project.created_by],
      'PROFIT_PROPOSED',
      'Owner proposed profit · ' || v_reference,
      coalesce(v_project.name, 'Project')
        || ' — review and declare to investors (via CEO approval).',
      p_project_id,
      v_row.id,
      '/(tabs)/projects/' || p_project_id || '?tab=profits'
    );
  end if;

  perform public.notify_investors_via_edge('PROFIT_PROPOSED', v_row.id);

  return v_row;
end;
$$;

-- ── Drawdown request → email LM ────────────────────────────────────────────
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

  if v_project.project_owner_id is distinct from auth.uid() then
    raise exception 'Only the assigned project owner can request a drawdown';
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

  perform public.notify_investors_via_edge('DRAWDOWN_REQUESTED', v_row.id);

  return v_row;
end;
$$;

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

  perform public.notify_investors_via_edge('DRAWDOWN_DECIDED', v_row.id);

  return v_row;
end;
$$;

-- ── Withdrawal request → email LM ──────────────────────────────────────────
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

  perform public.notify_investors_via_edge('WITHDRAWAL_REQUESTED', v_row.id);

  return v_row;
end;
$$;

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

  perform public.notify_investors_via_edge('WITHDRAWAL_DECIDED', v_row.id);

  return v_row;
end;
$$;
