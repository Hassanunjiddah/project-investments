-- ---------------------------------------------------------------------------
-- Align submit_project_for_review with the one-brief create wizard, and make
-- failed creates able to roll back.
--
-- Root cause of "All required documents must be uploaded before submit" while
-- the wizard still leaves an orphan project:
--   1. The wizard only uploads an OVERVIEW brief, but submit still required
--      OVERVIEW + RISK + DECISION (or the older FUND_USE quartet on remotes
--      where the 20260120 hotfix never actually ran).
--   2. createProjectWithDocuments tries to delete the project on submit
--      failure, but public.projects has no DELETE RLS policy — so the
--      rollback silently fails and the orphan stays in INITIATION/PENDING.
--
-- 2026-07-29
-- ---------------------------------------------------------------------------

-- 1. Submit: only the project brief (OVERVIEW) is required ------------------

create or replace function public.submit_project_for_review(p_project_id uuid)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_role public.user_role;
  v_has_overview boolean;
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

  -- Idempotent: already submitted → return as-is.
  if v_project.submitted_at is not null then
    return v_project;
  end if;

  select exists (
    select 1 from public.project_docs
    where project_id = p_project_id and kind = 'OVERVIEW'
  ) into v_has_overview;

  if not v_has_overview then
    raise exception 'A project brief (overview document) must be uploaded before submit';
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

-- 2. Allow owners / CEO / ADMIN to delete projects (needed for create rollback)

drop policy if exists projects_delete_owner_or_ceo on public.projects;
create policy projects_delete_owner_or_ceo
  on public.projects for delete to authenticated
  using (
    public.is_ceo_or_admin()
    or created_by = auth.uid()
  );

-- 3. Sweep orphan drafts left by earlier failed create→submit chains --------
-- These never got submitted_at set, so they are not real review candidates.

delete from public.projects
where submitted_at is null
  and approval_status = 'PENDING';
