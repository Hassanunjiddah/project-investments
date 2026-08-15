-- Fix investor portfolio profit: use minted distribution notices (investor pool
-- share), not project.realised_profit_minor × capital/raised.
--
-- The old formula broke when:
--   * realised_profit stores declaration GROSS (not investor pool)
--   * raised_minor shrinks after drawdowns, so capital/raised > 100%
-- Example: 20M gross × 70% × (50M/30M) = 23.3M instead of the true 9.7M pool.
-- 2026-08-15

create or replace function public.get_investor_profit_summary(p_investor_id uuid default null)
returns table (
  project_id uuid,
  invite_id uuid,
  capital_minor bigint,
  realised_profit_minor bigint,
  investor_share_minor bigint,
  project_stage public.project_stage,
  project_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select coalesce(p_investor_id, auth.uid()) as uid
  ),
  notice_profit as (
    select
      dn.invite_id,
      coalesce(sum(dn.profit_minor), 0)::bigint as share_minor
    from public.distribution_notices dn
    cross join target
    where dn.investor_id = target.uid
    group by dn.invite_id
  ),
  -- Fallback when notices are missing: units × sum(per_unit) from APPROVED decls
  unit_profit as (
    select
      i.id as invite_id,
      coalesce(
        round(
          coalesce(i.units_allotted, i.units_pledged, 0)::numeric
          * coalesce(sum(d.per_unit_minor), 0)::numeric
        ),
        0
      )::bigint as share_minor
    from public.invites i
    join public.profit_declarations d
      on d.project_id = i.project_id
     and d.status = 'APPROVED'
    cross join target
    where i.investor_id = target.uid
      and i.status = 'CONFIRMED'
    group by i.id, i.units_allotted, i.units_pledged
  ),
  project_pool as (
    select
      d.project_id,
      coalesce(sum(d.investor_pool_minor), 0)::bigint as pool_minor
    from public.profit_declarations d
    where d.status = 'APPROVED'
    group by d.project_id
  )
  select
    p.id as project_id,
    i.id as invite_id,
    coalesce(i.amount_minor, 0) as capital_minor,
    -- Project-level investor pool total (not gross)
    coalesce(pp.pool_minor, 0) as realised_profit_minor,
    coalesce(nullif(np.share_minor, 0), up.share_minor, 0) as investor_share_minor,
    p.stage as project_stage,
    p.name as project_name
  from public.invites i
  join public.projects p on p.id = i.project_id
  cross join target
  left join notice_profit np on np.invite_id = i.id
  left join unit_profit up on up.invite_id = i.id
  left join project_pool pp on pp.project_id = p.id
  where i.investor_id = target.uid
    and i.status = 'CONFIRMED';
$$;

grant execute on function public.get_investor_profit_summary(uuid) to authenticated;
