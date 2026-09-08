-- Profit attribution is strictly time-based. A declaration's profit belongs
-- to the invites that were CONFIRMED when it was approved — exactly what the
-- immutable distribution_notices snapshot. An invite confirmed later (e.g.
-- an existing investor pledging into an additional raise) must NOT pick up
-- past declarations; only its share of FUTURE declarations changes.
--
-- Bug being fixed: the units × per_unit fallback in get_investor_profit_summary
-- attributed ALL historical per-unit declarations to any confirmed invite,
-- so pledging 50 more units retroactively doubled displayed realised profit
-- (dashboard said ₦5.2M while the notices correctly said ₦2.6M).

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
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_investor_id is not null
     and p_investor_id <> auth.uid()
     and not public.is_ceo_or_admin() then
    raise exception 'Not authorized to view another investor''s profit summary';
  end if;

  return query
  with target as (
    select coalesce(p_investor_id, auth.uid()) as uid
  ),
  -- Authoritative source: immutable per-declaration snapshots.
  notice_profit as (
    select
      dn.invite_id,
      coalesce(sum(dn.profit_minor), 0)::bigint as share_minor
    from public.distribution_notices dn
    cross join target
    where dn.investor_id = target.uid
    group by dn.invite_id
  ),
  -- Legacy fallback ONLY for declarations that predate the notice system
  -- (no notices minted at all), and never for declarations approved before
  -- this invite's money was confirmed.
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
     and not exists (
       select 1 from public.distribution_notices dn2
       where dn2.declaration_id = d.id
     )
     and coalesce(i.verified_at, i.created_at)
         <= coalesce(d.approved_at, d.declared_at)
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
end;
$$;

grant execute on function public.get_investor_profit_summary(uuid) to authenticated;
