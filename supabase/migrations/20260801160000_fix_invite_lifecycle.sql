-- Unblock invite status transitions (audit trigger enum bug), harden
-- accept/decline RPCs, and set projected_profit_minor on unit pledges.

-- ---------------------------------------------------------------------------
-- 1. audit_invites_trg: cast enum before lower()
-- Postgres type-checks every CASE branch, so lower(invite_status) broke
-- ALL status updates (Accept, Pledge, Proof, Confirm, Decline).
-- ---------------------------------------------------------------------------

create or replace function public.audit_invites_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.project_id, 'invite', new.id, 'created',
      jsonb_build_object('email', new.email, 'status', new.status)
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.log_audit(
      new.project_id, 'invite', new.id,
      case new.status
        when 'INVITED' then 'invited'
        when 'ACCEPTED' then 'accepted'
        when 'COMMITTED' then 'pledged'
        when 'PROOF_SUBMITTED' then 'payment_claimed'
        when 'CONFIRMED' then 'verified_and_allotted'
        when 'DECLINED' then 'declined'
        else lower(new.status::text)
      end,
      jsonb_build_object(
        'from', old.status, 'to', new.status,
        'units', new.units_pledged, 'amount_minor', new.amount_minor,
        'payment_reference', new.payment_reference
      )
    );
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Transition guard (capture into repo; may already exist remotely)
-- ---------------------------------------------------------------------------

-- Drop any prior signature (live types listed args as p_new, p_old).
drop function if exists public.is_valid_invite_transition(public.invite_status, public.invite_status);

create function public.is_valid_invite_transition(
  p_old public.invite_status,
  p_new public.invite_status
)
returns boolean
language sql
immutable
as $$
  select case
    when p_old is not distinct from p_new then true
    when p_old = 'INVITED' and p_new in ('ACCEPTED', 'DECLINED') then true
    when p_old = 'ACCEPTED' and p_new in ('COMMITTED', 'DECLINED') then true
    when p_old = 'COMMITTED' and p_new in ('PROOF_SUBMITTED', 'ACCEPTED', 'DECLINED') then true
    when p_old = 'PROOF_SUBMITTED' and p_new in ('CONFIRMED', 'ACCEPTED') then true
    else false
  end;
$$;

grant execute on function public.is_valid_invite_transition(public.invite_status, public.invite_status)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. accept_invite / decline_invite RPCs
-- ---------------------------------------------------------------------------

create or replace function public.accept_invite(p_invite_id uuid)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_invite.investor_id <> auth.uid() then
    raise exception 'You cannot act on this invitation';
  end if;

  if not public.is_valid_invite_transition(v_invite.status, 'ACCEPTED') then
    raise exception 'Cannot accept invitation from status %', v_invite.status;
  end if;

  update public.invites
  set status = 'ACCEPTED', updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  return v_invite;
end;
$$;

grant execute on function public.accept_invite(uuid) to authenticated;

create or replace function public.decline_invite(p_invite_id uuid)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites;
  v_is_manager boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  v_is_manager := public.is_invite_project_manager(p_invite_id);

  if v_invite.investor_id <> auth.uid() and not v_is_manager then
    raise exception 'You cannot decline this invitation';
  end if;

  if not public.is_valid_invite_transition(v_invite.status, 'DECLINED') then
    raise exception 'Cannot decline invitation from status %', v_invite.status;
  end if;

  update public.invites
  set status = 'DECLINED', updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  return v_invite;
end;
$$;

grant execute on function public.decline_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. pledge_units: also set projected_profit_minor
-- ---------------------------------------------------------------------------

create or replace function public.pledge_units(
  p_invite_id uuid,
  p_units int
)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites;
  v_project public.projects;
  v_unit_price bigint;
  v_units_committed int;
  v_units_available int;
  v_seq int;
  v_expiry_hours int;
  v_amount_minor bigint;
  v_projected_profit bigint;
  v_reference text;
  v_min_units int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_units is null or p_units <= 0 then
    raise exception 'Units must be a positive integer';
  end if;

  select * into v_invite
  from public.invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_invite.investor_id <> auth.uid() then
    raise exception 'You cannot act on this invitation';
  end if;

  if v_invite.status not in ('ACCEPTED', 'COMMITTED') then
    raise exception 'Invitation must be Accepted before pledging (current: %)', v_invite.status;
  end if;

  select * into v_project
  from public.projects
  where id = v_invite.project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.total_units is null or v_project.total_units <= 0 then
    raise exception 'Project is not configured for unit-based subscription';
  end if;

  v_min_units := greatest(
    coalesce(v_invite.min_units, 0),
    coalesce(v_project.min_units_per_investor, 1)
  );

  if p_units < v_min_units then
    raise exception 'Minimum % unit(s) required', v_min_units;
  end if;

  v_unit_price := v_project.target_minor / v_project.total_units;
  v_expiry_hours := coalesce(v_project.pledge_expiry_hours, 72);

  select coalesce(sum(units_pledged), 0)::int into v_units_committed
  from public.invites
  where project_id = v_project.id
    and id <> p_invite_id
    and status in ('COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED')
    and (pledge_expires_at is null or pledge_expires_at > now() or status = 'CONFIRMED');

  v_units_available := v_project.total_units - v_units_committed;

  if p_units > v_units_available then
    raise exception 'Only % units remaining on this project', v_units_available;
  end if;

  v_amount_minor := p_units::bigint * v_unit_price;
  v_projected_profit := round(
    v_amount_minor::numeric * coalesce(v_project.estimated_roi_bps, 0) / 10000.0
  )::bigint;

  if v_invite.payment_reference is not null then
    v_reference := v_invite.payment_reference;
  else
    select coalesce(max(seq), 0) + 1 into v_seq
    from (
      select
        cast(regexp_replace(payment_reference, '^.*-INV(\d+)$', '\1') as int) as seq
      from public.invites
      where project_id = v_project.id
        and payment_reference ~ '-INV\d+$'
    ) t;
    v_reference := format('PRSM-%s-INV%s', v_project.code, lpad(v_seq::text, 3, '0'));
  end if;

  update public.invites
  set
    units_pledged = p_units,
    amount_minor = v_amount_minor,
    projected_profit_minor = v_projected_profit,
    payment_reference = v_reference,
    pledged_at = coalesce(pledged_at, now()),
    pledge_expires_at = now() + make_interval(hours => v_expiry_hours),
    status = 'COMMITTED',
    updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  return v_invite;
end;
$$;

grant execute on function public.pledge_units(uuid, int) to authenticated;
