-- ---------------------------------------------------------------------------
-- CLEANUP: remove pre-P1 projects (total_units IS NULL) and all their children
--
-- Order matters — delete leaves first so FK constraints don't complain. Wrap
-- in a transaction so any surprise rolls back cleanly.
--
-- SAFETY: this ONLY targets projects that were created before the unit model
-- migration (i.e. total_units IS NULL). Projects created after — like PRJ-114
-- — are untouched.
-- ---------------------------------------------------------------------------

-- Preview what will be deleted first (dry run, nothing changes)
select code, name, created_at, target_minor / 100.0 as target_naira
from public.projects
where total_units is null
order by created_at;

-- =======================
-- ACTUAL DELETE — run only after reviewing the preview above
-- =======================
begin;

with dead_projects as (
  select id from public.projects where total_units is null
)
-- 1. Profit updates
, del_profit_updates as (
  delete from public.profit_updates
  where project_id in (select id from dead_projects)
  returning 1
)
-- 2. Investor payouts
, del_payouts as (
  delete from public.investor_payouts
  where project_id in (select id from dead_projects)
  returning 1
)
-- 3. Tasks tied to those projects
, del_tasks as (
  delete from public.tasks
  where project_id in (select id from dead_projects)
  returning 1
)
-- 4. Project documents (rows in DB; storage objects are separate and can be
--    cleaned via the Supabase Storage UI if needed)
, del_docs as (
  delete from public.project_docs
  where project_id in (select id from dead_projects)
  returning 1
)
-- 5. Invites (payments proof, subscriptions, etc.)
, del_invites as (
  delete from public.invites
  where project_id in (select id from dead_projects)
  returning 1
)
-- 6. Finally, the projects themselves
, del_projects as (
  delete from public.projects
  where id in (select id from dead_projects)
  returning code
)
select
  (select count(*) from del_profit_updates) as profit_updates_deleted,
  (select count(*) from del_payouts)        as payouts_deleted,
  (select count(*) from del_tasks)          as tasks_deleted,
  (select count(*) from del_docs)           as project_docs_deleted,
  (select count(*) from del_invites)        as invites_deleted,
  (select count(*) from del_projects)       as projects_deleted;

-- Uncomment to apply:
-- commit;
-- Or to abort:
-- rollback;
