-- RibhShare: Row Level Security policies
-- Requires 20250612100001_functions_and_triggers.sql

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.invites enable row level security;

-- Grant enum usage to authenticated role
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.projects to authenticated;
grant select, insert, update on public.invites to authenticated;

-- ---------------------------------------------------------------------------
-- profiles policies
-- ---------------------------------------------------------------------------

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_ceo_or_admin()
  );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Restrict profile updates to safe columns (full_name, avatar_url only)
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- Inserts handled by handle_new_user trigger (security definer), not client

-- ---------------------------------------------------------------------------
-- projects policies
-- ---------------------------------------------------------------------------

drop policy if exists projects_select_ceo_admin on public.projects;
create policy projects_select_ceo_admin
  on public.projects
  for select
  to authenticated
  using (public.is_ceo_or_admin());

drop policy if exists projects_select_line_manager on public.projects;
create policy projects_select_line_manager
  on public.projects
  for select
  to authenticated
  using (
    public.current_user_role() = 'LINE_MANAGER'
    and created_by = auth.uid()
  );

drop policy if exists projects_select_investor_via_invite on public.projects;
create policy projects_select_investor_via_invite
  on public.projects
  for select
  to authenticated
  using (
    public.current_user_role() = 'INVESTOR'
    and public.investor_has_invite_on_project(id)
  );

drop policy if exists projects_insert_manager_admin on public.projects;
create policy projects_insert_manager_admin
  on public.projects
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.current_user_role() in ('LINE_MANAGER', 'ADMIN')
  );

drop policy if exists projects_update_line_manager on public.projects;
create policy projects_update_line_manager
  on public.projects
  for update
  to authenticated
  using (
    public.current_user_role() = 'LINE_MANAGER'
    and created_by = auth.uid()
  )
  with check (
    public.current_user_role() = 'LINE_MANAGER'
    and created_by = auth.uid()
    and approval_status <> 'APPROVED'
  );

drop policy if exists projects_update_ceo_admin on public.projects;
create policy projects_update_ceo_admin
  on public.projects
  for update
  to authenticated
  using (public.is_ceo_or_admin())
  with check (public.is_ceo_or_admin());

-- ---------------------------------------------------------------------------
-- invites policies
-- ---------------------------------------------------------------------------

drop policy if exists invites_select_investor on public.invites;
create policy invites_select_investor
  on public.invites
  for select
  to authenticated
  using (
    public.current_user_role() = 'INVESTOR'
    and investor_id = auth.uid()
  );

drop policy if exists invites_select_line_manager on public.invites;
create policy invites_select_line_manager
  on public.invites
  for select
  to authenticated
  using (
    public.current_user_role() = 'LINE_MANAGER'
    and public.is_project_owner(project_id)
  );

drop policy if exists invites_select_ceo_admin on public.invites;
create policy invites_select_ceo_admin
  on public.invites
  for select
  to authenticated
  using (public.is_ceo_or_admin());

drop policy if exists invites_insert_manager_admin on public.invites;
create policy invites_insert_manager_admin
  on public.invites
  for insert
  to authenticated
  with check (
    (
      public.current_user_role() = 'LINE_MANAGER'
      and public.is_project_owner(project_id)
    )
    or public.current_user_role() = 'ADMIN'
  );

drop policy if exists invites_update_investor on public.invites;
create policy invites_update_investor
  on public.invites
  for update
  to authenticated
  using (
    public.current_user_role() = 'INVESTOR'
    and investor_id = auth.uid()
  )
  with check (
    public.current_user_role() = 'INVESTOR'
    and investor_id = auth.uid()
    and status <> 'CONFIRMED'
  );

drop policy if exists invites_update_line_manager on public.invites;
create policy invites_update_line_manager
  on public.invites
  for update
  to authenticated
  using (
    public.current_user_role() = 'LINE_MANAGER'
    and public.is_project_owner(project_id)
  )
  with check (
    public.current_user_role() = 'LINE_MANAGER'
    and public.is_project_owner(project_id)
  );

drop policy if exists invites_update_ceo_admin on public.invites;
create policy invites_update_ceo_admin
  on public.invites
  for update
  to authenticated
  using (public.is_ceo_or_admin())
  with check (public.is_ceo_or_admin());
