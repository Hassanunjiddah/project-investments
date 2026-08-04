-- Drawdowns: only the assigned project owner may request (LM / CEO approve).
-- 2026-08-04

create or replace function public.request_fund_drawdown(
  p_project_id uuid,
  p_amount_minor bigint,
  p_purpose text,
  p_category text default 'FUND_USE'
)
returns public.fund_drawdowns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_row public.fund_drawdowns;
  v_seq int;
  v_ref text;
  v_cat text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_purpose is null or char_length(trim(p_purpose)) < 3 then
    raise exception 'Purpose is required';
  end if;

  v_cat := coalesce(nullif(trim(p_category), ''), 'FUND_USE');
  if v_cat not in ('FUND_USE', 'RISK_MITIGATION', 'OTHER') then
    raise exception 'Invalid category';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.stage <> 'PROGRESS' then
    raise exception 'Drawdowns are only allowed while the project is in Progress';
  end if;

  -- Owner-only request path (Prism LM mediates via approve / mark paid)
  if v_project.project_owner_id is distinct from auth.uid() then
    raise exception 'Only the assigned project owner can request a drawdown';
  end if;

  select coalesce(max(
    cast(nullif(regexp_replace(coalesce(reference, ''), '^.*-DD(\d+)$', '\1'), '') as int)
  ), 0) + 1
  into v_seq
  from public.fund_drawdowns
  where project_id = p_project_id;

  v_ref := format('PRSM-%s-DD%s', v_project.code, lpad(v_seq::text, 3, '0'));

  insert into public.fund_drawdowns (
    project_id, requested_by, amount_minor, purpose, category, status, reference
  ) values (
    p_project_id, auth.uid(), p_amount_minor, trim(p_purpose), v_cat, 'PENDING', v_ref
  )
  returning * into v_row;

  if v_project.created_by is not null then
    perform public.create_notifications(
      array[v_project.created_by],
      'DRAWDOWN_REQUESTED',
      'Drawdown request · ' || v_ref,
      coalesce(v_project.name, 'Project') || ' · '
        || trim(to_char(p_amount_minor / 100.0, 'FM999,999,999,990.00'))
        || ' NGN · ' || v_cat,
      p_project_id,
      v_row.id,
      '/(tabs)/projects/' || p_project_id || '?tab=drawdowns'
    );
  end if;

  return v_row;
end;
$$;
