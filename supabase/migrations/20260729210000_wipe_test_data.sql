-- ---------------------------------------------------------------------------
-- One-time data wipe — clean slate for fresh provisioning testing.
--
-- KEEP accounts (password Test@123):
--   ceo@ribhshare.com          CEO
--   linemanager@ribhshare.com  LINE_MANAGER
--   investor@ribhshare.com     INVESTOR
--
-- DELETE:
--   every other auth user (and cascading profiles / staff codes / etc.)
--   every project (and cascading invites, updates, declarations, messages…)
--
-- Note: storage.objects is intentionally left alone — the migration login
-- role cannot DELETE there. Orphaned files are harmless and can be cleared
-- from the dashboard Storage UI if desired.
--
-- 2026-07-29
-- ---------------------------------------------------------------------------

-- 1. Projects + dependents ---------------------------------------------------
-- TRUNCATE … CASCADE clears projects and every table with an FK into them
-- (invites, project_updates, profit_declarations, message_threads, etc.).
truncate table public.projects restart identity cascade;

-- 2. Notifications -----------------------------------------------------------
truncate table public.notifications restart identity cascade;

-- 3. Auth users except the three keep accounts -------------------------------
-- profiles / staff_signin_codes cascade via profiles.id → auth.users.
delete from auth.users
where lower(email) not in (
  'ceo@ribhshare.com',
  'linemanager@ribhshare.com',
  'investor@ribhshare.com'
);
