-- ---------------------------------------------------------------------------
-- Remnant / below-min pledges + fix unit-register accounting for pending waivers.
--
-- When remaining units on a project are positive but below the invite/project
-- minimum, the investor may still request a pledge of up to the remnant.
-- That request reserves the units and opens an LM approval task; only after
-- approval does the invite become COMMITTED (payment reference + expiry).
-- 2026-08-04
-- ---------------------------------------------------------------------------

-- 1. Columns -----------------------------------------------------------------

alter table public.invites
  add column if not exists min_waiver_status text;

alter table public.invites
  drop constraint if exists invites_min_waiver_status_check;

alter table public.invites
  add constraint invites_min_waiver_status_check
  check (
    min_waiver_status is null
    or min_waiver_status in ('PENDING', 'APPROVED', 'REJECTED')
  );

comment on column public.invites.min_waiver_status is
  'PENDING = remnant/below-min pledge awaiting LM approval; APPROVED after LM accepts; REJECTED/null otherwise.';

-- 2. Task kind ---------------------------------------------------------------

alter type public.task_kind add value if not exists 'APPROVE_REMNANT_PLEDGE';

-- 3. Shared: units reserved on a project (excludes one invite optionally) ----

create or replace function public.project_units_reserved(
  p_project_id uuid,
  p_exclude_invite_id uuid default null
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(units_pledged), 0)::numeric
  from public.invites
  where project_id = p_project_id
    and (p_exclude_invite_id is null or id <> p_exclude_invite_id)
    and units_pledged is not null
    and units_pledged > 0
    and (
      status in ('COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED')
      or min_waiver_status = 'PENDING'
    )
    and (
      pledge_expires_at is null
      or pledge_expires_at > now()
      or status = 'CONFIRMED'
      or min_waiver_status = 'PENDING'
    );
$$;

grant execute on function public.project_units_reserved(uuid, uuid) to authenticated;

create or replace function public.request_remnant_pledge(
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
  v_units numeric;
  v_min_units numeric;
  v_available numeric;
  v_amount_minor bigint;
  v_projected_profit bigint;
  v_label text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_units is null or p_units <= 0 then
    raise exception 'Units must be a positive number';
  end if;

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

  if v_invite.status <> 'ACCEPTED' then
    raise exception 'Invitation must be Accepted before requesting a remnant pledge (current: %)', v_invite.status;
  end if;

  if v_invite.min_waiver_status = 'PENDING' then
    raise exception 'A remnant pledge is already awaiting Line Manager approval';
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

  v_available := round(
    v_project.total_units::numeric - public.project_units_reserved(v_project.id, p_invite_id),
    6
  );

  if v_available <= 0 then
    raise exception 'No units remaining on this project';
  end if;

  -- Remnant path only when the book cannot satisfy the normal minimum.
  if v_available >= v_min_units then
    raise exception 'Enough units remain for a normal pledge (minimum %); use the standard pledge flow', v_min_units;
  end if;

  if v_units > v_available then
    raise exception 'Only % units remaining on this project', v_available;
  end if;

  -- Must be strictly below the normal minimum (otherwise use standard pledge).
  if v_units >= v_min_units then
    raise exception 'Use the standard pledge flow for % or more units', v_min_units;
  end if;

  v_unit_price := v_project.target_minor / v_project.total_units;
  if v_unit_price <= 0 then
    raise exception 'Invalid unit price';
  end if;

  v_amount_minor := round(v_units * v_unit_price)::bigint;
  if v_amount_minor <= 0 then
    raise exception 'Pledge amount must be greater than zero';
  end if;

  v_projected_profit := round(
    v_amount_minor::numeric * coalesce(v_project.estimated_roi_bps, 0) / 10000.0
  )::bigint;

  update public.invites
  set
    units_pledged = v_units,
    amount_minor = v_amount_minor,
    projected_profit_minor = v_projected_profit,
    min_waiver_status = 'PENDING',
    -- Hold reservation without opening payment until LM approves.
    payment_reference = null,
    pledged_at = null,
    pledge_expires_at = null,
    updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  -- Cancel prior open remnant tasks for this invite, then create one.
  update public.tasks
  set status = 'CANCELLED'
  where invite_id = p_invite_id
    and kind = 'APPROVE_REMNANT_PLEDGE'
    and status = 'OPEN';

  v_label := coalesce(v_invite.email, 'Investor');

  insert into public.tasks (kind, title, project_id, invite_id, assignee_role, status)
  values (
    'APPROVE_REMNANT_PLEDGE',
    format(
      'Approve remnant pledge: %s · %s units (min was %s)',
      v_label,
      trim(to_char(v_units, 'FM999999990.999999')),
      trim(to_char(v_min_units, 'FM999999990.999999'))
    ),
    v_project.id,
    p_invite_id,
    'LINE_MANAGER',
    'OPEN'
  );

  -- In-app notify project owner
  if v_project.created_by is not null then
    perform public.create_notifications(
      array[v_project.created_by],
      'PROOF_SUBMITTED', -- reuse allowed type for feed urgency; title clarifies
      'Remnant pledge needs approval',
      v_label || ' requested ' || trim(to_char(v_units, 'FM999999990.999999'))
        || ' units (below min ' || trim(to_char(v_min_units, 'FM999999990.999999'))
        || ') on ' || coalesce(v_project.name, 'project'),
      v_project.id,
      p_invite_id,
      '/(tabs)/projects/' || v_project.id || '?tab=investors&invite=' || p_invite_id::text
    );
  end if;

  return v_invite;
end;
$$;

grant execute on function public.request_remnant_pledge(uuid, numeric) to authenticated;

-- 5. approve_remnant_pledge — LM on own project ------------------------------

create or replace function public.approve_remnant_pledge(
  p_invite_id uuid
)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites;
  v_project public.projects;
  v_seq int;
  v_expiry_hours int;
  v_reference text;
  v_available numeric;
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

  if v_invite.min_waiver_status <> 'PENDING' then
    raise exception 'No remnant pledge awaiting approval';
  end if;

  if v_invite.status <> 'ACCEPTED' then
    raise exception 'Invitation is not in an approvable state (current: %)', v_invite.status;
  end if;

  if v_invite.units_pledged is null or v_invite.units_pledged <= 0 then
    raise exception 'Remnant pledge has no units reserved';
  end if;

  select * into v_project
  from public.projects
  where id = v_invite.project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.created_by <> auth.uid()
     and public.current_user_role() not in ('CEO', 'ADMIN') then
    raise exception 'Only the project Line Manager can approve a remnant pledge';
  end if;

  -- Re-check availability excluding this invite's pending reservation
  v_available := round(
    v_project.total_units::numeric - public.project_units_reserved(v_project.id, p_invite_id),
    6
  );

  if v_invite.units_pledged > v_available then
    raise exception 'Only % units remaining; cannot approve this remnant pledge', v_available;
  end if;

  v_expiry_hours := coalesce(v_project.pledge_expiry_hours, 72);

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
    status = 'COMMITTED',
    min_waiver_status = 'APPROVED',
    payment_reference = v_reference,
    pledged_at = coalesce(pledged_at, now()),
    pledge_expires_at = now() + make_interval(hours => v_expiry_hours),
    updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  update public.tasks
  set status = 'DONE'
  where invite_id = p_invite_id
    and kind = 'APPROVE_REMNANT_PLEDGE'
    and status = 'OPEN';

  -- Notify investor
  if v_invite.investor_id is not null then
    perform public.create_notifications(
      array[v_invite.investor_id],
      'PROJECT_APPROVED',
      'Remnant pledge approved',
      'Your below-minimum pledge of '
        || trim(to_char(v_invite.units_pledged, 'FM999999990.999999'))
        || ' units was approved. Complete payment with reference ' || v_reference || '.',
      v_project.id,
      p_invite_id,
      '/(tabs)/portfolio/projects/' || v_project.id || '?invite=' || p_invite_id::text
    );
  end if;

  return v_invite;
end;
$$;

grant execute on function public.approve_remnant_pledge(uuid) to authenticated;

-- 6. reject_remnant_pledge — LM ----------------------------------------------

create or replace function public.reject_remnant_pledge(
  p_invite_id uuid
)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites;
  v_project public.projects;
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

  if v_invite.min_waiver_status <> 'PENDING' then
    raise exception 'No remnant pledge awaiting approval';
  end if;

  select * into v_project
  from public.projects
  where id = v_invite.project_id;

  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.created_by <> auth.uid()
     and public.current_user_role() not in ('CEO', 'ADMIN') then
    raise exception 'Only the project Line Manager can reject a remnant pledge';
  end if;

  update public.invites
  set
    units_pledged = null,
    amount_minor = null,
    projected_profit_minor = null,
    min_waiver_status = 'REJECTED',
    updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  update public.tasks
  set status = 'CANCELLED'
  where invite_id = p_invite_id
    and kind = 'APPROVE_REMNANT_PLEDGE'
    and status = 'OPEN';

  if v_invite.investor_id is not null then
    perform public.create_notifications(
      array[v_invite.investor_id],
      'PROJECT_REJECTED',
      'Remnant pledge declined',
      'Your below-minimum pledge request on '
        || coalesce(v_project.name, 'the project')
        || ' was not approved.',
      v_project.id,
      p_invite_id,
      '/(tabs)/portfolio/projects/' || v_project.id || '?invite=' || p_invite_id::text
    );
  end if;

  return v_invite;
end;
$$;

grant execute on function public.reject_remnant_pledge(uuid) to authenticated;

-- 7. Patch pledge_units / pledge_by_amount to use shared reserved helper ------

create or replace function public.pledge_units(
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

  if v_invite.min_waiver_status = 'PENDING' then
    raise exception 'A remnant pledge is awaiting Line Manager approval';
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
    raise exception 'Minimum % unit(s) required — if fewer remain, use the remnant pledge request', v_min_units;
  end if;

  v_unit_price := v_project.target_minor / v_project.total_units;
  if v_unit_price <= 0 then
    raise exception 'Invalid unit price';
  end if;
  v_expiry_hours := coalesce(v_project.pledge_expiry_hours, 72);

  v_units_available := round(
    v_project.total_units::numeric - public.project_units_reserved(v_project.id, p_invite_id),
    6
  );

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
    min_waiver_status = null,
    updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  return v_invite;
end;
$$;

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

  if v_invite.min_waiver_status = 'PENDING' then
    raise exception 'A remnant pledge is awaiting Line Manager approval';
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

  v_units := round(p_amount_minor::numeric / v_unit_price::numeric, 6);

  v_min_units := greatest(
    coalesce(v_invite.min_units, 0)::numeric,
    coalesce(v_project.min_units_per_investor, 1)::numeric
  );

  if v_units < v_min_units then
    raise exception 'Amount is below the minimum of % unit(s) — if fewer remain, use the remnant pledge request', v_min_units;
  end if;

  v_units_available := round(
    v_project.total_units::numeric - public.project_units_reserved(v_project.id, p_invite_id),
    6
  );

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
    min_waiver_status = null,
    updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  return v_invite;
end;
$$;
