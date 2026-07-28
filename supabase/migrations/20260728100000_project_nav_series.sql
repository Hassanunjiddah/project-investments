-- ---------------------------------------------------------------------------
-- Per-project NAV-per-unit history series
--
-- Installs a permanent, read-only RPC that returns the running NAV per unit
-- for a project across every APPROVED profit declaration, plus a synthetic
-- "inception" point at project creation (NAV = entry price).
--
-- Consumed by the investor Home sparkline on `PositionCard`.
--
-- Return shape:
--   [
--     { "at": "2026-07-01T00:00:00Z", "nav_per_unit_minor": 100000, "label": "Inception" },
--     { "at": "2026-07-14T18:22:11Z", "nav_per_unit_minor": 113300, "label": "DECL-001" },
--     ...
--   ]
--
-- Anyone who can view the project can call this — same RLS the Investor
-- Portfolio uses (SECURITY INVOKER so callers only see rows they can read).
-- ---------------------------------------------------------------------------

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

  -- One point per APPROVED declaration in chronological order.
  for v_row in
    select id, reference, coalesce(approved_at, declared_at) as at, investor_pool_minor
    from public.profit_declarations
    where project_id = p_project_id
      and status = 'APPROVED'
    order by coalesce(approved_at, declared_at) asc
    limit greatest(p_limit - 1, 1)
  loop
    v_running := v_running + coalesce(v_row.investor_pool_minor, 0);
    v_series := v_series || jsonb_build_array(
      jsonb_build_object(
        'at',                 v_row.at,
        'nav_per_unit_minor', v_unit_price + floor(v_running::numeric / v_project.total_units),
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
  'Returns per-project NAV/unit history: [{at, nav_per_unit_minor, label}] with an inception anchor at project creation followed by one point per APPROVED declaration. SECURITY INVOKER — respects existing RLS on projects & profit_declarations.';
