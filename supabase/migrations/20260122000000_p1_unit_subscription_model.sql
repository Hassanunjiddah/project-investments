-- ---------------------------------------------------------------------------
-- P1: Unit-based subscription model (Prism Capital private placement)
--
-- Changes:
--   * projects: total_units, min_units_per_investor, platform_fee_bps
--     (unit_price_minor derived on read for accuracy; not stored to avoid
--     divergence when target_minor is ever amended pre-launch).
--   * invites: units_pledged, units_allotted, payment_reference (unique),
--     pledged_at, pledge_expires_at, verified_at, verified_by,
--     payment_claim_amount_minor, payment_claim_bank, payment_claim_date,
--     payment_claim_narration.
--   * RPC pledge_units(invite, units) — supersedes commit_invite_investment
--     for unit-model projects; generates payment_reference, sets 72h expiry,
--     writes amount_minor = units * unit_price_minor.
--   * RPC expire_stale_pledges(project) — lazy sweep, callable from LM UI.
--
-- All new columns are nullable so existing projects/invites keep working
-- until the backfill script (see /app/supabase/migrations/backfill_units.sql)
-- is run manually.
-- ---------------------------------------------------------------------------

alter table public.projects
  add column if not exists total_units int,
  add column if not exists min_units_per_investor int default 1,
  add column if not exists platform_fee_bps int default 750,
  add column if not exists pledge_expiry_hours int default 72;

alter table public.projects
  add constraint projects_total_units_positive
    check (total_units is null or total_units > 0) not valid;

alter table public.projects
  add constraint projects_platform_fee_bps_range
    check (platform_fee_bps is null or (platform_fee_bps >= 0 and platform_fee_bps <= 10000)) not valid;

alter table public.projects
  add constraint projects_min_units_positive
    check (min_units_per_investor is null or min_units_per_investor > 0) not valid;

alter table public.invites
  add column if not exists units_pledged int,
  add column if not exists units_allotted int,
  add column if not exists payment_reference text,
  add column if not exists pledged_at timestamptz,
  add column if not exists pledge_expires_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles(id),
  add column if not exists payment_claim_amount_minor bigint,
  add column if not exists payment_claim_bank text,
  add column if not exists payment_claim_date date,
  add column if not exists payment_claim_narration text;

create unique index if not exists invites_payment_reference_unique_idx
  on public.invites (payment_reference)
  where payment_reference is not null;

-- Small helper: number of units currently spoken-for on a project.
-- Counts everything except DECLINED / expired pledges.
create or replace function public.project_units_committed(p_project_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(units_pledged), 0)::int
  from public.invites
  where project_id = p_project_id
    and status in ('COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED')
    and (pledge_expires_at is null or pledge_expires_at > now() or status = 'CONFIRMED');
$$;

grant execute on function public.project_units_committed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: pledge_units
-- Investor pledges N units. Validates min-units, availability, generates a
-- unique payment reference (PRSM-<project.code>-INV<seq>), sets 72h expiry.
-- Idempotent: calling again with same units on same invite re-uses reference.
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
  v_reference text;
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

  if p_units < coalesce(v_project.min_units_per_investor, 1) then
    raise exception 'Minimum % unit(s) required per investor',
      coalesce(v_project.min_units_per_investor, 1);
  end if;

  v_unit_price := v_project.target_minor / v_project.total_units;
  v_expiry_hours := coalesce(v_project.pledge_expiry_hours, 72);

  -- Compute available units, ignoring this invite's current pledge so
  -- re-pledging (up-sizing) works.
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

  -- Reuse reference if already generated, else mint a new one.
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
    payment_reference = v_reference,
    pledged_at = coalesce(pledged_at, now()),
    pledge_expires_at = now() + make_interval(hours => v_expiry_hours),
    status = 'COMMITTED'
  where id = p_invite_id
  returning * into v_invite;

  return v_invite;
end;
$$;

grant execute on function public.pledge_units(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: expire_stale_pledges
-- Sweeps invites whose pledge window has lapsed and moves them back to
-- ACCEPTED with the payment_reference retained (for audit) but pledge cleared,
-- so their units return to the available pool. Callable by LM/CEO.
-- ---------------------------------------------------------------------------

create or replace function public.expire_stale_pledges(p_project_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.invites
  set
    status = 'ACCEPTED',
    units_pledged = null,
    amount_minor = null,
    pledge_expires_at = null
  where project_id = p_project_id
    and status = 'COMMITTED'
    and pledge_expires_at is not null
    and pledge_expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.expire_stale_pledges(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Extend confirm_invite_payment (existing edge function calls the RPC of same
-- name if any; here we add a helper that also allots units). We wire this to
-- the existing edge function via a trigger: any invite moving into CONFIRMED
-- automatically gets units_allotted = units_pledged.
-- ---------------------------------------------------------------------------

create or replace function public.set_units_allotted_on_confirm()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'CONFIRMED' and (old.status is distinct from 'CONFIRMED') then
    if new.units_allotted is null and new.units_pledged is not null then
      new.units_allotted := new.units_pledged;
    end if;
    if new.verified_at is null then
      new.verified_at := now();
    end if;
    if new.verified_by is null then
      new.verified_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists invites_allot_units_on_confirm on public.invites;
create trigger invites_allot_units_on_confirm
  before update on public.invites
  for each row
  when (new.status is distinct from old.status)
  execute function public.set_units_allotted_on_confirm();
