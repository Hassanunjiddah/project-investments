-- Fix investor withdrawable uuid=text bug; allow LM to start Progress early.
-- 2026-08-17

-- 1. party_id is uuid — comparing to text throws "operator does not exist: uuid = text"

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
    and party_id = v_invite.investor_id;

  select coalesce(sum(amount_minor), 0) into v_pending
  from public.withdrawal_requests
  where invite_id = p_invite_id
    and status in ('PENDING', 'APPROVED', 'PAID');

  return greatest(v_available - v_pending, 0);
end;
$$;

grant execute on function public.investor_withdrawable_minor(uuid) to authenticated;

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
    and party_id = auth.uid();

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

grant execute on function public.request_profit_withdrawal(uuid, bigint) to authenticated;

-- 2. Manual ACCEPTANCE → PROGRESS (LM / CEO) even if target not fully raised

create or replace function public.start_project_progress(p_project_id uuid)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_fee bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.created_by <> auth.uid() and not public.is_ceo_or_admin() then
    raise exception 'Only the Line Manager or CEO can start Progress';
  end if;

  if v_project.approval_status <> 'APPROVED' then
    raise exception 'Project must be approved before starting Progress';
  end if;

  if v_project.stage = 'PROGRESS' then
    return v_project;
  end if;

  if v_project.stage <> 'ACCEPTANCE' then
    raise exception 'Progress can only be started from Acceptance (current stage: %)',
      v_project.stage;
  end if;

  v_fee := coalesce(v_project.raise_fee_minor, 0);
  if v_fee = 0 and coalesce(v_project.raise_fee_bps, 0) > 0
     and coalesce(v_project.raised_minor, 0) > 0 then
    v_fee := floor(
      v_project.raised_minor::numeric * v_project.raise_fee_bps / 10000.0
    )::bigint;
  end if;

  update public.projects
  set
    stage = 'PROGRESS',
    progress_started_at = coalesce(progress_started_at, now()),
    raise_fee_minor = v_fee,
    updated_at = now()
  where id = p_project_id
  returning * into v_project;

  if v_project.created_by is not null then
    perform public.create_notifications(
      array[v_project.created_by],
      'TARGET_REACHED',
      'Project moved to Progress',
      coalesce(v_project.code || ' · ', '') || coalesce(v_project.name, 'Project')
        || ' is now in Progress'
        || case
             when coalesce(v_project.raised_minor, 0) < coalesce(v_project.target_minor, 0)
             then ' (started before full target).'
             else '.'
           end,
      v_project.id,
      v_project.id,
      '/(tabs)/projects/' || v_project.id || '?tab=overview'
    );
  end if;

  if v_project.project_owner_id is not null then
    perform public.create_notifications(
      array[v_project.project_owner_id],
      'TARGET_REACHED',
      'Project is now in Progress',
      coalesce(v_project.name, 'Your project')
        || ' has moved to Progress. Message your Prism Line Manager for drawdowns and ops.',
      v_project.id,
      v_project.id,
      '/(tabs)/projects/' || v_project.id
    );
  end if;

  perform public.log_audit(
    p_project_id,
    'project',
    p_project_id,
    'progress_started',
    jsonb_build_object(
      'raised_minor', v_project.raised_minor,
      'target_minor', v_project.target_minor,
      'raise_fee_minor', v_project.raise_fee_minor,
      'manual', true
    ),
    auth.uid()
  );

  return v_project;
end;
$$;

grant execute on function public.start_project_progress(uuid) to authenticated;
