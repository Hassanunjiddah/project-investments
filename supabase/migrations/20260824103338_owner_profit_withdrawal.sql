-- Allow project owners to withdraw approved manager-share profit.
-- Extends withdrawal_requests with kind; invite_id nullable for OWNER rows.

alter table public.withdrawal_requests
  alter column invite_id drop not null;

alter table public.withdrawal_requests
  add column if not exists kind text not null default 'INVESTOR';

alter table public.withdrawal_requests
  drop constraint if exists withdrawal_requests_kind_check;

alter table public.withdrawal_requests
  add constraint withdrawal_requests_kind_check
  check (kind in ('INVESTOR', 'OWNER'));

alter table public.withdrawal_requests
  drop constraint if exists withdrawal_requests_kind_invite_ck;

alter table public.withdrawal_requests
  add constraint withdrawal_requests_kind_invite_ck
  check (
    (kind = 'INVESTOR' and invite_id is not null)
    or (kind = 'OWNER' and invite_id is null)
  );

comment on column public.withdrawal_requests.kind is
  'INVESTOR = realised profit vs invite; OWNER = project owner manager share';

create index if not exists withdrawal_requests_owner_project_idx
  on public.withdrawal_requests (project_id, kind, created_at desc)
  where kind = 'OWNER';

-- Available manager share for the assigned project owner.
create or replace function public.owner_withdrawable_minor(p_project_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_project public.projects;
  v_earned bigint;
  v_taken bigint;
begin
  select * into v_project from public.projects where id = p_project_id;
  if not found then
    return 0;
  end if;

  if v_project.project_owner_id is distinct from auth.uid()
     and not public.is_ceo_or_admin()
     and v_project.created_by is distinct from auth.uid() then
    return 0;
  end if;

  select coalesce(sum(d.manager_share_minor), 0)
  into v_earned
  from public.profit_declarations d
  where d.project_id = p_project_id
    and d.status = 'APPROVED';

  select coalesce(sum(w.amount_minor), 0)
  into v_taken
  from public.withdrawal_requests w
  where w.project_id = p_project_id
    and w.kind = 'OWNER'
    and w.status in ('PENDING', 'APPROVED', 'PAID');

  return greatest(v_earned - v_taken, 0);
end;
$$;

grant execute on function public.owner_withdrawable_minor(uuid) to authenticated;

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
    raise exception 'Requested amount exceeds available manager share (% kobo)',
      v_available;
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

-- Investor insert path: always tag INVESTOR (invite required).
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
    raise exception 'Requested amount exceeds available realised profit (% kobo)',
      v_available;
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

-- Keep investor helper in sync (kind filter).
create or replace function public.investor_withdrawable_minor(p_invite_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_invite public.invites;
  v_from_notices bigint;
  v_from_ledger bigint;
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
    and party_id = v_invite.investor_id;

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

  return greatest(v_available - v_pending, 0);
end;
$$;

grant execute on function public.investor_withdrawable_minor(uuid) to authenticated;
