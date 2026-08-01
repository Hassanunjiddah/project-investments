-- Allow pledging by ₦ (exact kobo) with fractional units derived from unit price.
-- units_pledged / units_allotted become numeric; pledge_units accepts numeric;
-- new pledge_by_amount RPC for the naira entry path.

-- ---------------------------------------------------------------------------
-- 1. Widen unit columns
-- ---------------------------------------------------------------------------

alter table public.invites
  alter column units_pledged type numeric(18, 6)
  using units_pledged::numeric(18, 6);

alter table public.invites
  alter column units_allotted type numeric(18, 6)
  using units_allotted::numeric(18, 6);

-- Distribution notices store units held at approve time
alter table public.distribution_notices
  alter column units_held type numeric(18, 6)
  using units_held::numeric(18, 6);

-- ---------------------------------------------------------------------------
-- 2. pledge_units — accept fractional units
-- ---------------------------------------------------------------------------

drop function if exists public.pledge_units(uuid, int);
drop function if exists public.pledge_units(uuid, numeric);

create function public.pledge_units(
  p_invite_id uuid,
  p_units numeric
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
  v_units_committed numeric;
  v_units_available numeric;
  v_seq int;
  v_expiry_hours int;
  v_amount_minor bigint;
  v_projected_profit bigint;
  v_reference text;
  v_min_units numeric;
  v_units numeric;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_units is null or p_units <= 0 then
    raise exception 'Units must be a positive number';
  end if;

  -- Cap precision to 6 decimal places
  v_units := round(p_units, 6);

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
    coalesce(v_invite.min_units, 0)::numeric,
    coalesce(v_project.min_units_per_investor, 1)::numeric
  );

  if v_units < v_min_units then
    raise exception 'Minimum % unit(s) required', v_min_units;
  end if;

  v_unit_price := v_project.target_minor / v_project.total_units;
  if v_unit_price <= 0 then
    raise exception 'Invalid unit price';
  end if;
  v_expiry_hours := coalesce(v_project.pledge_expiry_hours, 72);

  select coalesce(sum(units_pledged), 0) into v_units_committed
  from public.invites
  where project_id = v_project.id
    and id <> p_invite_id
    and status in ('COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED')
    and (pledge_expires_at is null or pledge_expires_at > now() or status = 'CONFIRMED');

  v_units_available := v_project.total_units::numeric - v_units_committed;

  if v_units > v_units_available then
    raise exception 'Only % units remaining on this project', v_units_available;
  end if;

  v_amount_minor := round(v_units * v_unit_price)::bigint;
  if v_amount_minor <= 0 then
    raise exception 'Pledge amount must be greater than zero';
  end if;

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
    units_pledged = v_units,
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

grant execute on function public.pledge_units(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. pledge_by_amount — investor enters ₦; units derived (may be fractional)
-- ---------------------------------------------------------------------------

create or replace function public.pledge_by_amount(
  p_invite_id uuid,
  p_amount_minor bigint
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
  v_units numeric;
  v_units_committed numeric;
  v_units_available numeric;
  v_seq int;
  v_expiry_hours int;
  v_projected_profit bigint;
  v_reference text;
  v_min_units numeric;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Amount must be greater than zero';
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

  v_unit_price := v_project.target_minor / v_project.total_units;
  if v_unit_price <= 0 then
    raise exception 'Invalid unit price';
  end if;

  -- Exact ₦ commitment; units may be fractional.
  v_units := round(p_amount_minor::numeric / v_unit_price::numeric, 6);

  v_min_units := greatest(
    coalesce(v_invite.min_units, 0)::numeric,
    coalesce(v_project.min_units_per_investor, 1)::numeric
  );

  if v_units < v_min_units then
    raise exception 'Amount is below the minimum of % unit(s)', v_min_units;
  end if;

  select coalesce(sum(units_pledged), 0) into v_units_committed
  from public.invites
  where project_id = v_project.id
    and id <> p_invite_id
    and status in ('COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED')
    and (pledge_expires_at is null or pledge_expires_at > now() or status = 'CONFIRMED');

  v_units_available := v_project.total_units::numeric - v_units_committed;

  if v_units > v_units_available then
    raise exception 'Only % units remaining on this project', v_units_available;
  end if;

  v_expiry_hours := coalesce(v_project.pledge_expiry_hours, 72);
  v_projected_profit := round(
    p_amount_minor::numeric * coalesce(v_project.estimated_roi_bps, 0) / 10000.0
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
    units_pledged = v_units,
    amount_minor = p_amount_minor,
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

grant execute on function public.pledge_by_amount(uuid, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Profit approve: fractional units × per_unit → kobo (keep notices + four-eyes)
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
  v_notice_ref_base text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_ceo_or_admin() then
    raise exception 'Only CEO/Finance Admin can approve profit declarations';
  end if;

  select * into v_row from public.profit_declarations where id = p_declaration_id for update;
  if not found then raise exception 'Declaration not found'; end if;
  if v_row.status <> 'PENDING' then raise exception 'Declaration is already %', v_row.status; end if;
  if v_row.declared_by = auth.uid() then
    raise exception 'You cannot approve a declaration you submitted (four-eyes principle)';
  end if;

  select * into v_project from public.projects where id = v_row.project_id for update;

  update public.profit_declarations
  set status = 'APPROVED', approved_by = auth.uid(), approved_at = now()
  where id = p_declaration_id returning * into v_row;

  update public.projects
  set realised_profit_minor = realised_profit_minor + v_row.gross_amount_minor,
      updated_at = now()
  where id = v_row.project_id;

  v_notice_ref_base := format('PRSM-%s-NOT', v_project.code);
  insert into public.distribution_notices (
    declaration_id, project_id, invite_id, investor_id,
    units_held, per_unit_minor, profit_minor,
    capital_returned_minor, reference, is_final
  )
  select
    v_row.id, v_row.project_id, i.id, i.investor_id,
    coalesce(i.units_allotted, i.units_pledged, 0),
    v_row.per_unit_minor,
    round(coalesce(i.units_allotted, i.units_pledged, 0) * v_row.per_unit_minor)::bigint,
    case when v_row.is_final then coalesce(i.amount_minor, 0) else 0 end,
    v_notice_ref_base || lpad((row_number() over (order by i.id))::text, 3, '0'),
    v_row.is_final
  from public.invites i
  where i.project_id = v_row.project_id
    and i.status = 'CONFIRMED';

  if v_row.is_final then
    insert into public.investor_payouts (project_id, invite_id, investor_id, capital_minor, profit_minor)
    select i.project_id, i.id, i.investor_id, coalesce(i.amount_minor, 0),
           round(coalesce(i.units_allotted, i.units_pledged, 0) * v_row.per_unit_minor)::bigint
    from public.invites i
    where i.project_id = v_row.project_id and i.status = 'CONFIRMED'
    on conflict (invite_id) do nothing;

    update public.projects set stage = 'END', updated_at = now() where id = v_row.project_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.approve_profit_declaration(uuid) to authenticated;
