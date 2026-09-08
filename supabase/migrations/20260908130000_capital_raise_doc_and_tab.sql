-- Capital raising gets its own project tab. Two changes here:
--   1. A raise request can carry a supporting document (quote / invoice /
--      budget) stored in project-documents under <project_id>/rounds/….
--   2. Decision notifications deep-link to the new ?tab=capital.

alter table public.funding_rounds
  add column if not exists doc_storage_path text,
  add column if not exists doc_file_name text,
  add column if not exists doc_mime_type text;

-- Existing investors invited into a raise get an in-app notification
-- (no sign-in code email) — needs a dedicated notification type.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'ACTIVITY_POST',
    'DECLARATION_SUBMITTED',
    'DECLARATION_APPROVED',
    'DECLARATION_REJECTED',
    'PROJECT_SUBMITTED',
    'PROJECT_APPROVED',
    'PROJECT_REJECTED',
    'NEW_MESSAGE',
    'PROOF_SUBMITTED',
    'TARGET_REACHED',
    'DRAWDOWN_REQUESTED',
    'DRAWDOWN_DECIDED',
    'WITHDRAWAL_REQUESTED',
    'WITHDRAWAL_DECIDED',
    'PROFIT_PROPOSED',
    'DOC_REQUESTED',
    'DOC_FULFILLED',
    'INVITE_RECEIVED'
  ));

-- Recreate rather than overload: an overload with extra defaulted params
-- would make 4-arg calls ambiguous.
drop function if exists public.request_funding_round(uuid, int, text, uuid[]);

create or replace function public.request_funding_round(
  p_project_id uuid,
  p_additional_units int,
  p_reason text,
  p_cost_line_ids uuid[] default '{}',
  p_doc_storage_path text default null,
  p_doc_file_name text default null,
  p_doc_mime_type text default null
)
returns public.funding_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_price bigint;
  v_row public.funding_rounds;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_additional_units is null or p_additional_units <= 0 then
    raise exception 'additional_units must be a positive integer';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 5 then
    raise exception 'A reason of at least 5 characters is required';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;
  if v_project.approval_status <> 'APPROVED' then
    raise exception 'Project must be approved before requesting additional capital';
  end if;
  if v_project.created_by <> auth.uid()
     and v_project.project_owner_id <> auth.uid()
     and not public.is_ceo_or_admin() then
    raise exception 'Only the project manager or owner can request additional capital';
  end if;
  if coalesce(v_project.total_units, 0) <= 0 or v_project.target_minor <= 0 then
    raise exception 'Project unit economics are not set';
  end if;
  if v_project.target_minor % v_project.total_units <> 0 then
    raise exception 'Project target does not divide evenly by total units';
  end if;

  v_price := v_project.target_minor / v_project.total_units;

  insert into public.funding_rounds (
    project_id, additional_units, additional_minor, unit_price_minor,
    reason, cost_line_ids, status, requested_by,
    doc_storage_path, doc_file_name, doc_mime_type
  ) values (
    p_project_id,
    p_additional_units,
    p_additional_units::bigint * v_price,
    v_price,
    trim(p_reason),
    coalesce(p_cost_line_ids, '{}'),
    'PENDING',
    auth.uid(),
    p_doc_storage_path,
    p_doc_file_name,
    p_doc_mime_type
  ) returning * into v_row;

  insert into public.tasks (
    kind, title, project_id, assignee_role, status
  ) values (
    'DECIDE_FUNDING_ROUND',
    'Additional capital: ' || v_project.code,
    p_project_id,
    'CEO',
    'OPEN'
  );

  perform public.create_notifications(
    public.ceo_admin_ids(),
    'PROJECT_SUBMITTED',
    'Additional capital requested',
    v_project.code || ' · ' || trim(to_char(p_additional_units, 'FM999999990'))
      || ' units (' || trim(to_char(v_row.additional_minor / 100.0, 'FM999,999,999,990')) || ' NGN)',
    p_project_id,
    null,
    '/(tabs)/approvals'
  );

  return v_row;
end;
$$;

-- Same body as before except the requester notification now links to the
-- dedicated Capital raise tab instead of Cost lines.
create or replace function public.decide_funding_round(
  p_round_id uuid,
  p_status text,
  p_note text default null
)
returns public.funding_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.funding_rounds;
  v_project public.projects;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_ceo_or_admin() then
    raise exception 'Only the CEO can decide a funding round';
  end if;
  if p_status not in ('APPROVED', 'REJECTED') then
    raise exception 'status must be APPROVED or REJECTED';
  end if;

  select * into v_row from public.funding_rounds where id = p_round_id for update;
  if not found then
    raise exception 'Funding round not found';
  end if;
  if v_row.status <> 'PENDING' then
    raise exception 'Funding round is not pending (current: %)', v_row.status;
  end if;

  select * into v_project from public.projects where id = v_row.project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  if p_status = 'APPROVED' then
    update public.projects
    set
      total_units = total_units + v_row.additional_units,
      target_minor = target_minor + v_row.additional_minor,
      updated_at = now()
    where id = v_project.id;
  end if;

  update public.funding_rounds
  set
    status = p_status,
    decided_by = auth.uid(),
    decided_at = now(),
    decision_note = nullif(trim(coalesce(p_note, '')), ''),
    updated_at = now()
  where id = p_round_id
  returning * into v_row;

  update public.tasks
  set status = 'COMPLETED'
  where project_id = v_project.id
    and kind = 'DECIDE_FUNDING_ROUND'
    and status = 'OPEN';

  if v_row.requested_by is not null then
    perform public.create_notifications(
      array[v_row.requested_by],
      case when p_status = 'APPROVED' then 'PROJECT_APPROVED' else 'PROJECT_REJECTED' end,
      case when p_status = 'APPROVED'
        then 'Additional capital approved'
        else 'Additional capital rejected' end,
      v_project.code || ' · ' || coalesce(p_note, p_status),
      v_project.id,
      null,
      '/(tabs)/projects/' || v_project.id || '?tab=capital'
    );
  end if;

  return v_row;
end;
$$;

grant execute on function public.request_funding_round(uuid, int, text, uuid[], text, text, text) to authenticated;
grant execute on function public.decide_funding_round(uuid, text, text) to authenticated;
