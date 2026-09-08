-- Split Prism LM earnings into raise fee vs profit (declaration) fee.
-- Totals stay on platform_fee_minor / amount_minor for older callers.

drop function if exists public.get_manager_profit_summary(uuid);
drop function if exists public.list_earning_breakdown(text);

create function public.get_manager_profit_summary(p_manager_id uuid default null)
returns table (
  total_realised_profit_minor bigint,
  manager_share_minor bigint,
  platform_fee_minor bigint,
  project_count int,
  raise_fee_minor bigint,
  profit_fee_minor bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_manager_id is not null
     and p_manager_id <> auth.uid()
     and not public.is_ceo_or_admin() then
    raise exception 'Not authorized to view another manager''s earnings';
  end if;

  return query
  with target as (
    select coalesce(p_manager_id, auth.uid()) as uid
  ),
  scoped as (
    select
      p.id as project_id,
      coalesce(p.raise_fee_minor, 0)::bigint as raise_fee_minor
    from public.projects p
    cross join target
    where p.created_by = target.uid
  ),
  decl as (
    select
      d.project_id,
      coalesce(sum(d.platform_fee_minor), 0)::bigint as profit_fee_minor,
      coalesce(sum(d.gross_amount_minor), 0)::bigint as gross_minor
    from public.profit_declarations d
    join scoped s on s.project_id = d.project_id
    where d.status = 'APPROVED'
    group by d.project_id
  ),
  rows as (
    select
      s.project_id,
      s.raise_fee_minor,
      coalesce(d.profit_fee_minor, 0)::bigint as profit_fee_minor,
      coalesce(d.gross_minor, 0)::bigint as gross_minor
    from scoped s
    left join decl d on d.project_id = s.project_id
    where s.raise_fee_minor > 0 or coalesce(d.profit_fee_minor, 0) > 0
  )
  select
    coalesce(sum(r.gross_minor), 0)::bigint,
    coalesce(sum(r.raise_fee_minor + r.profit_fee_minor), 0)::bigint,
    coalesce(sum(r.raise_fee_minor + r.profit_fee_minor), 0)::bigint,
    count(*)::int,
    coalesce(sum(r.raise_fee_minor), 0)::bigint,
    coalesce(sum(r.profit_fee_minor), 0)::bigint
  from rows r;
end;
$$;

create function public.list_earning_breakdown(p_kind text default 'platform')
returns table (
  project_id uuid,
  project_code text,
  project_name text,
  gross_minor bigint,
  amount_minor bigint,
  declaration_count int,
  raise_fee_minor bigint,
  profit_fee_minor bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_kind = 'manager_share' then
    return query
    select
      p.id,
      p.code,
      p.name,
      coalesce(sum(d.gross_amount_minor), 0)::bigint,
      coalesce(sum(d.manager_share_minor), 0)::bigint,
      count(d.id)::int,
      0::bigint,
      coalesce(sum(d.manager_share_minor), 0)::bigint
    from public.projects p
    join public.profit_declarations d on d.project_id = p.id and d.status = 'APPROVED'
    where p.project_owner_id = auth.uid()
       or public.is_ceo_or_admin()
    group by p.id, p.code, p.name
    having coalesce(sum(d.manager_share_minor), 0) > 0
    order by 5 desc;
  else
    return query
    select
      p.id,
      p.code,
      p.name,
      coalesce(sum(d.gross_amount_minor), 0)::bigint,
      (
        coalesce(sum(d.platform_fee_minor), 0)
        + coalesce(p.raise_fee_minor, 0)
      )::bigint,
      count(d.id)::int,
      coalesce(p.raise_fee_minor, 0)::bigint,
      coalesce(sum(d.platform_fee_minor), 0)::bigint
    from public.projects p
    left join public.profit_declarations d
      on d.project_id = p.id and d.status = 'APPROVED'
    where p.created_by = auth.uid()
       or public.is_ceo_or_admin()
    group by p.id, p.code, p.name, p.raise_fee_minor
    having (
      coalesce(sum(d.platform_fee_minor), 0)
      + coalesce(p.raise_fee_minor, 0)
    ) > 0
    order by 5 desc;
  end if;
end;
$$;

grant execute on function public.get_manager_profit_summary(uuid) to authenticated;
grant execute on function public.list_earning_breakdown(text) to authenticated;
