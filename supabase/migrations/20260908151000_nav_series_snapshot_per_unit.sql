-- NAV/unit history must be immutable once written. The old implementation
-- divided the running investor pool by the CURRENT total_units, so an
-- approved additional raise retroactively rewrote every historical point
-- (₦51.8K/unit of declared profit silently became ₦43.2K/unit after 50 new
-- units were minted). Each declaration already snapshots the amount actually
-- paid per then-existing unit (per_unit_minor) — accumulate that instead.

create or replace function public.get_project_nav_series(
  p_project_id uuid,
  p_limit int default 32
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_project      record;
  v_unit_price   bigint;
  v_series       jsonb := '[]'::jsonb;
  v_running      bigint := 0;
  v_row          record;
begin
  if p_project_id is null then
    return '[]'::jsonb;
  end if;

  select id, created_at, total_units, target_minor
  into v_project
  from public.projects
  where id = p_project_id;

  if not found or coalesce(v_project.total_units, 0) <= 0 then
    return '[]'::jsonb;
  end if;

  v_unit_price := floor(v_project.target_minor::numeric / v_project.total_units);

  -- Synthetic inception point — anchors the sparkline at the entry price.
  v_series := v_series || jsonb_build_array(
    jsonb_build_object(
      'at',                 v_project.created_at,
      'nav_per_unit_minor', v_unit_price,
      'label',              'Inception'
    )
  );

  -- One point per APPROVED declaration, accumulating the per-unit amount
  -- snapshotted at approval time. Falls back to pool / current units only
  -- for legacy declarations that predate the per_unit_minor column.
  for v_row in
    select
      id,
      reference,
      coalesce(approved_at, declared_at) as at,
      coalesce(
        per_unit_minor,
        floor(coalesce(investor_pool_minor, 0)::numeric / v_project.total_units)::bigint
      ) as per_unit_paid
    from public.profit_declarations
    where project_id = p_project_id
      and status = 'APPROVED'
    order by coalesce(approved_at, declared_at) asc
    limit greatest(p_limit - 1, 1)
  loop
    v_running := v_running + coalesce(v_row.per_unit_paid, 0);
    v_series := v_series || jsonb_build_array(
      jsonb_build_object(
        'at',                 v_row.at,
        'nav_per_unit_minor', v_unit_price + v_running,
        'label',              coalesce(v_row.reference, 'Declaration')
      )
    );
  end loop;

  return v_series;
end;
$$;

revoke all on function public.get_project_nav_series(uuid, int) from public;
grant execute on function public.get_project_nav_series(uuid, int) to authenticated;

comment on function public.get_project_nav_series(uuid, int) is
  'Returns per-project NAV/unit history: [{at, nav_per_unit_minor, label}] with an inception anchor followed by one point per APPROVED declaration, accumulating the per_unit_minor snapshotted at each approval. History is immutable — later raises do not rewrite past points. SECURITY INVOKER — respects existing RLS.';
