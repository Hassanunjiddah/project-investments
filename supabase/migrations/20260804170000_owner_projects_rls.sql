-- Harden project visibility for PROJECT_OWNER:
-- they may only SELECT rows where they are the assigned project_owner_id.
-- (Investor public / invited policies already role-gate INVESTOR.)
-- 2026-08-04

drop policy if exists projects_select_project_owner on public.projects;
create policy projects_select_project_owner
  on public.projects for select to authenticated
  using (
    public.current_user_role() = 'PROJECT_OWNER'
    and project_owner_id = auth.uid()
  );
