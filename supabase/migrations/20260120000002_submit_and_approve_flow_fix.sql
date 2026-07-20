-- RibhShare hotfix: align submit + approve with the actual create-wizard flow
-- 2026-01-20
-- Fixes:
--   1. submit_project_for_review used to require a banner and a FUND_USE doc,
--      but the wizard makes banner optional and only asks for 3 required docs
--      (OVERVIEW, RISK, DECISION). This caused create_project -> submit chain
--      to silently fail, leaving orphaned PENDING projects.
--   2. decide_project_approval refused to approve when submitted_at was null.
--      We now auto-submit at approval time to unblock the CEO on legacy rows.

-- ---------------------------------------------------------------------------
-- Patch submit_project_for_review: relax banner + FUND_USE requirements
-- ---------------------------------------------------------------------------

create or replace function public.submit_project_for_review(p_project_id uuid)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_role public.user_role;
  v_doc_kinds public.doc_kind[];
  v_required public.doc_kind[] := array['OVERVIEW','RISK','DECISION']::public.doc_kind[];
begin
  v_role := public.current_user_role();

  select * into v_project from public.projects where id = p_project_id;
  if not found then
    raise exception 'Project not found';
  end if;

  if v_role not in ('LINE_MANAGER', 'CEO', 'ADMIN') then
    raise exception 'Not authorized to submit projects';
  end if;

  if v_role = 'LINE_MANAGER' and v_project.created_by <> auth.uid() then
    raise exception 'You can only submit your own projects';
  end if;

  if v_project.submitted_at is not null then
    return v_project;
  end if;

  select array_agg(distinct kind) into v_doc_kinds
  from public.project_docs where project_id = p_project_id;

  if v_doc_kinds is null or not v_required <@ v_doc_kinds then
    raise exception 'Project overview, risk assessment and key decision documents are required before submit';
  end if;

  update public.projects
  set submitted_at = now(), approval_status = 'PENDING'
  where id = p_project_id
  returning * into v_project;

  insert into public.tasks (kind, title, project_id, assignee_role)
  values (
    'REVIEW_PROJECT',
    'Review project: ' || v_project.name,
    p_project_id,
    'CEO'
  )
  on conflict do nothing;

  return v_project;
end;
$$;

grant execute on function public.submit_project_for_review(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Patch decide_project_approval: auto-submit legacy rows on first approval
-- Also keeps stage bump (from previous hotfix)
-- ---------------------------------------------------------------------------

create or replace function public.decide_project_approval(
  p_project_id uuid,
  p_approval_status public.approval_status,
  p_rejection_note text default null
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
begin
  if not public.is_ceo_or_admin() then
    raise exception 'Only CEO or admin can approve projects';
  end if;

  if p_approval_status not in ('APPROVED', 'REJECTED') then
    raise exception 'approval_status must be APPROVED or REJECTED';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  -- Auto-submit: LM created but never formally submitted (legacy or wizard glitch)
  if v_project.submitted_at is null then
    update public.projects
    set submitted_at = now()
    where id = p_project_id
    returning * into v_project;
  end if;

  if v_project.approval_status <> 'PENDING' then
    raise exception 'Project is not pending approval';
  end if;

  if p_approval_status = 'APPROVED' then
    update public.projects
    set
      approval_status = 'APPROVED',
      approved_by = auth.uid(),
      approved_at = now(),
      rejected_by = null,
      rejected_at = null,
      rejection_note = null,
      stage = case when stage = 'INITIATION' then 'ACCEPTANCE'::public.project_stage else stage end
    where id = p_project_id
    returning * into v_project;
  else
    update public.projects
    set
      approval_status = 'REJECTED',
      rejected_by = auth.uid(),
      rejected_at = now(),
      rejection_note = p_rejection_note,
      approved_by = null,
      approved_at = null
    where id = p_project_id
    returning * into v_project;
  end if;

  update public.tasks
  set
    status = 'COMPLETED',
    completed_at = now(),
    completed_by = auth.uid()
  where project_id = p_project_id
    and kind = 'REVIEW_PROJECT'
    and status = 'OPEN';

  return v_project;
end;
$$;

grant execute on function public.decide_project_approval(uuid, public.approval_status, text) to authenticated;
