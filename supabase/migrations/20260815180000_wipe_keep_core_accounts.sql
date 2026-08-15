-- Clean slate: wipe all projects + related data, keep only core test accounts.
-- KEEP (password Test@123):
--   ceo@ribhshare.com
--   linemanager@ribhshare.com
--   investor@ribhshare.com
-- 2026-08-15

-- 1. Projects + dependents (invites, declarations, drawdowns, messages, ledger…)
truncate table public.projects restart identity cascade;

-- 2. Notifications
truncate table public.notifications restart identity cascade;

-- 3. Staff invite codes
truncate table public.staff_signin_codes restart identity cascade;

-- 4. Auth users except the three keep accounts
-- profiles cascade via profiles.id → auth.users
delete from auth.users
where lower(email) not in (
  'ceo@ribhshare.com',
  'linemanager@ribhshare.com',
  'investor@ribhshare.com'
);
