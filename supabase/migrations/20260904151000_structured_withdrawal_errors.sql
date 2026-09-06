-- Structured withdrawal errors: stable message + DETAIL = available kobo.
-- Frontend maps WITHDRAWAL_EXCEEDS_AVAILABLE without regex-parsing copy.

create or replace function public.request_owner_profit_withdrawal(
  p_project_id uuid,
  p_amount_minor bigint
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_available bigint;
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

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.project_owner_id is distinct from auth.uid() then
    raise exception 'Only the assigned project owner can request a profit withdrawal';
  end if;

  v_available := public.owner_withdrawable_minor(p_project_id);

  if p_amount_minor > v_available then
    raise exception 'WITHDRAWAL_EXCEEDS_AVAILABLE'
      using errcode = 'P0001',
            detail = v_available::text;
  end if;

  if v_available <= 0 then
    raise exception 'No manager share available to withdraw';
  end if;

  select coalesce(max(
    cast(nullif(regexp_replace(coalesce(reference, ''), '^.*-WD(\d+)$', '\1'), '') as int)
  ), 0) + 1
  into v_seq
  from public.withdrawal_requests
  where project_id = p_project_id;

  v_ref := format('PRSM-%s-WD%s', v_project.code, lpad(v_seq::text, 3, '0'));

  insert into public.withdrawal_requests (
    project_id, invite_id, investor_id, amount_minor, status, reference, kind
  ) values (
    p_project_id, null, auth.uid(), p_amount_minor, 'PENDING', v_ref, 'OWNER'
  )
  returning * into v_row;

  if v_project.created_by is not null then
    perform public.create_notifications(
      array[v_project.created_by],
      'WITHDRAWAL_REQUESTED',
      'Owner withdrawal · ' || v_ref,
      coalesce(v_project.name, 'Project') || ' · project owner requested manager-share payout',
      p_project_id,
      v_row.id,
      '/(tabs)/projects/' || p_project_id || '?tab=withdrawals'
    );
  end if;

  begin
    perform public.notify_investors_via_edge('WITHDRAWAL_REQUESTED', v_row.id);
  exception when others then
    null;
  end;

  return v_row;
end;
$$;

grant execute on function public.request_owner_profit_withdrawal(uuid, bigint) to authenticated;

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
  v_from_notices bigint;
  v_from_ledger bigint;
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

  select coalesce(sum(dn.profit_minor), 0)
  into v_from_notices
  from public.distribution_notices dn
  where dn.invite_id = p_invite_id;

  select coalesce(sum(
    case when direction = 'CR' then amount_minor else -amount_minor end
  ), 0)
  into v_from_ledger
  from public.ledger_entries
  where project_id = v_invite.project_id
    and account_code = 'investor_payable'
    and party_id = auth.uid();

  if v_from_notices > 0 then
    v_available := v_from_notices;
  else
    v_available := greatest(v_from_ledger, 0);
  end if;

  select coalesce(sum(amount_minor), 0) into v_pending
  from public.withdrawal_requests
  where invite_id = p_invite_id
    and kind = 'INVESTOR'
    and status in ('PENDING', 'APPROVED', 'PAID');

  v_available := greatest(v_available - v_pending, 0);

  if p_amount_minor > v_available then
    raise exception 'WITHDRAWAL_EXCEEDS_AVAILABLE'
      using errcode = 'P0001',
            detail = v_available::text;
  end if;

  if v_available <= 0 then
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
    project_id, invite_id, investor_id, amount_minor, status, reference, kind
  ) values (
    v_invite.project_id, p_invite_id, auth.uid(), p_amount_minor, 'PENDING', v_ref, 'INVESTOR'
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

  begin
    perform public.notify_investors_via_edge('WITHDRAWAL_REQUESTED', v_row.id);
  exception when others then
    null;
  end;

  return v_row;
end;
$$;

grant execute on function public.request_profit_withdrawal(uuid, bigint) to authenticated;
