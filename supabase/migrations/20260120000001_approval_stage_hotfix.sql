-- RibhShare hotfix: guarantee INITIATION -> ACCEPTANCE on project approval
-- 2026-01-20
-- The original baseline trigger (`projects_on_approved`) should do this, but if
-- the trigger is missing or disabled in the deployed DB, the stage stays at
-- INITIATION. This patch (a) re-installs the trigger idempotently, (b) also
-- sets the stage explicitly inside `decide_project_approval` as a belt-and-
-- suspenders guarantee, and (c) backfills any already-APPROVED projects whose
-- stage is still INITIATION.

-- ---------------------------------------------------------------------------
-- (a) Re-install the trigger (idempotent)
-- ---------------------------------------------------------------------------

create or replace function public.projects_on_approved()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and new.approval_status = 'APPROVED'
    and old.approval_status is distinct from 'APPROVED'
    and new.stage = 'INITIATION'
  then
    new.stage := 'ACCEPTANCE';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_on_approved on public.projects;
create trigger projects_on_approved
  before update of approval_status on public.projects
  for each row execute function public.projects_on_approved();

-- ---------------------------------------------------------------------------
-- (b) Patch decide_project_approval to also set stage in the same UPDATE
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

  if v_project.submitted_at is null then
    raise exception 'Project has not been submitted for review';
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

-- ---------------------------------------------------------------------------
-- (c) One-time backfill for projects already APPROVED but still in INITIATION
-- ---------------------------------------------------------------------------

update public.projects
set stage = 'ACCEPTANCE'
where approval_status = 'APPROVED'
  and stage = 'INITIATION';
