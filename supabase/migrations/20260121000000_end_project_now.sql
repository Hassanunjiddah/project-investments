-- ---------------------------------------------------------------------------
-- RPC: end_project_now
-- Lets a Line Manager (project.created_by) or a CEO/admin manually finalize
-- a project that is in PROGRESS stage. Mirrors finalize_project_if_due:
--   * creates investor_payouts rows for every CONFIRMED invite
--   * flips stage -> END, timestamps updated_at
-- Idempotent: re-running on an already-ended project is a no-op.
-- ---------------------------------------------------------------------------

create or replace function public.end_project_now(p_project_id uuid)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_investor_profit_bps int;
  v_total_raised bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.created_by <> auth.uid() and not public.is_ceo_or_admin() then
    raise exception 'Only the project manager can end this project';
  end if;

  -- Already ended -> return current row (idempotent).
  if v_project.stage = 'END' then
    return v_project;
  end if;

  if v_project.stage <> 'PROGRESS' then
    raise exception 'Only projects in Progress can be ended (current stage: %)', v_project.stage;
  end if;

  v_investor_profit_bps := v_project.profit_split_investor_bps;
  v_total_raised := greatest(v_project.raised_minor, 1); -- guard divide-by-zero

  -- Create payout rows for every confirmed investor.
  insert into public.investor_payouts (project_id, invite_id, investor_id, capital_minor, profit_minor)
  select
    i.project_id,
    i.id,
    i.investor_id,
    coalesce(i.amount_minor, 0),
    round(
      v_project.realised_profit_minor::numeric
      * v_investor_profit_bps / 10000.0
      * coalesce(i.amount_minor, 0)::numeric
      / v_total_raised::numeric
    )::bigint
  from public.invites i
  where i.project_id = p_project_id
    and i.status = 'CONFIRMED'
  on conflict (invite_id) do nothing;

  update public.projects
  set stage = 'END', updated_at = now()
  where id = p_project_id
  returning * into v_project;

  return v_project;
end;
$$;

grant execute on function public.end_project_now(uuid) to authenticated;
