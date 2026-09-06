-- ---------------------------------------------------------------------------
-- BACKFILL script — Prism Capital unit-model conversion for existing projects
--
-- This script is INTENTIONALLY not part of the numbered migrations. Run it
-- MANUALLY in Supabase → SQL Editor, ONE SECTION AT A TIME, after reviewing
-- the dry-run output. Do NOT run the whole file blindly.
--
-- The strategy:
--   1. Assume every existing project trades in ₦1,000,000 units (a round
--      figure that maps naturally to the mockup). Adjust per-project after
--      dry-run if any project's target_minor is not a clean multiple of
--      100000000 kobo.
--   2. Any existing invite with amount_minor set must have units_allotted
--      set to amount_minor / unit_price_minor. If that isn't an integer,
--      the dry-run flags it — you decide per-invite whether to round or
--      contact the investor to top up / refund a fractional unit.
-- ---------------------------------------------------------------------------

-- =======================
-- SECTION 1 — DRY-RUN REPORT
-- =======================
-- Shows what the backfill would set. Nothing is written. Copy-paste into SQL
-- Editor and review the output BEFORE running Section 2.

-- 1a. Project-level preview
with candidate as (
  select
    id,
    code,
    name,
    target_minor,
    total_units,
    100000000::bigint as proposed_unit_price_kobo, -- ₦1,000,000 per unit
    (target_minor / 100000000)::int as proposed_total_units,
    (target_minor % 100000000) as remainder_kobo
  from public.projects
)
select
  code,
  name,
  target_minor / 100.0 as target_naira,
  total_units as current_total_units,
  proposed_total_units,
  case
    when total_units is not null then 'SKIP (already set)'
    when remainder_kobo = 0        then 'OK · exact fit'
    else format('WARN · target not multiple of ₦1M (remainder ₦%s)', remainder_kobo / 100.0)
  end as status
from candidate
order by code;

-- 1b. Invite-level preview (per-invite unit conversion). Rows flagged WARN
--     have amount_minor that isn't a whole multiple of the proposed unit
--     price — you need to decide per-invite whether to round down, top-up,
--     or refund the fractional unit.
select
  i.id,
  i.project_id,
  p.code as project_code,
  i.status,
  i.amount_minor / 100.0 as amount_naira,
  i.units_pledged,
  i.units_allotted,
  case
    when i.amount_minor is null              then 'SKIP · no amount'
    when i.units_pledged is not null         then 'SKIP · already set'
    when (i.amount_minor % 100000000) = 0    then format('OK · %s units', i.amount_minor / 100000000)
    else format('WARN · %s.%s units (fractional)',
      i.amount_minor / 100000000,
      lpad(((i.amount_minor % 100000000) / 1000000)::text, 2, '0'))
  end as status
from public.invites i
join public.projects p on p.id = i.project_id
where i.status in ('COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED')
order by p.code, i.status;


-- =======================
-- SECTION 2 — APPLY BACKFILL
-- =======================
-- ONLY run after you've reviewed Section 1 and are happy. Wrap in a
-- transaction so you can roll back if something looks off.

begin;

-- 2a. Project defaults (₦1M unit price). If any project reports a "WARN"
--     in section 1a, patch it individually FIRST (see Section 3 below) then
--     re-run this filter with those projects excluded.
update public.projects
set
  total_units = (target_minor / 100000000)::int,
  min_units_per_investor = coalesce(min_units_per_investor, 1),
  platform_fee_bps = coalesce(platform_fee_bps, 750),
  pledge_expiry_hours = coalesce(pledge_expiry_hours, 72)
where total_units is null
  and (target_minor % 100000000) = 0;

-- 2b. Invite unit backfill (clean-fit rows only). WARN rows must be
--     handled individually via Section 3.
update public.invites i
set
  units_pledged = (i.amount_minor / 100000000)::int,
  units_allotted = case when i.status = 'CONFIRMED' then (i.amount_minor / 100000000)::int else null end
from public.projects p
where p.id = i.project_id
  and i.status in ('COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED')
  and i.units_pledged is null
  and i.amount_minor is not null
  and p.total_units is not null
  and (i.amount_minor % 100000000) = 0;

-- Verify before commit:
select
  (select count(*) from public.projects where total_units is null)     as projects_still_missing_units,
  (select count(*) from public.invites
     where status in ('COMMITTED','PROOF_SUBMITTED','CONFIRMED')
       and amount_minor is not null
       and units_pledged is null)                                       as invites_still_missing_units;

-- If both counts are 0 (or expected non-zero for WARN cases you'll fix
-- individually), commit. Otherwise rollback.
-- commit;   -- uncomment to apply
-- rollback; -- uncomment to abort


-- =======================
-- SECTION 3 — PATCH PROJECTS WITH IRREGULAR TARGETS
-- =======================
-- Example: a project targeting ₦45,000,000 → 45 units × ₦1M works.
-- A project targeting ₦47,500,000 → 47.5 units doesn't. Options:
--   (a) 47 units at ₦1M unit price with ₦500k rounded down (target amended)
--   (b) 95 units at ₦500k each (finer granularity)
-- Pick per-project. Example manual patch:
--
-- update public.projects
-- set total_units = 95, target_minor = 4750000000
-- where code = 'PRJ-XYZ';
