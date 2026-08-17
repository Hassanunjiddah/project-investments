-- Fix FINAL (and any subsequent) declaration approval:
-- distribution_notices.reference was PRSM-{code}-NOT### keyed only by
-- investor row_number, so DECL002 collided with DECL001's NOT001.
-- Include the declaration reference in the notice id.
-- 2026-08-17

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

  -- Unique per declaration + investor ordinal (not just per project).
  v_notice_ref_base := format(
    'PRSM-%s-%s-NOT',
    v_project.code,
    coalesce(nullif(regexp_replace(v_row.reference, '^.*-(DECL\d+)$', '\1'), v_row.reference), 'DECL')
  );

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
    -- Cumulative profit across ALL notices for the invite (interim + this final).
    insert into public.investor_payouts (project_id, invite_id, investor_id, capital_minor, profit_minor)
    select
      i.project_id,
      i.id,
      i.investor_id,
      coalesce(i.amount_minor, 0),
      coalesce((
        select sum(dn.profit_minor)::bigint
        from public.distribution_notices dn
        where dn.invite_id = i.id
      ), 0)
    from public.invites i
    where i.project_id = v_row.project_id and i.status = 'CONFIRMED'
    on conflict (invite_id) do update
      set capital_minor = excluded.capital_minor,
          profit_minor = excluded.profit_minor;

    update public.projects set stage = 'END', updated_at = now() where id = v_row.project_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.approve_profit_declaration(uuid) to authenticated;
