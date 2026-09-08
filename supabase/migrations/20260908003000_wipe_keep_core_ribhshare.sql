-- Wipe every project, file, and related email/account.
-- KEEP:
--   ceo@ribhshare.com
--   linemanager@ribhshare.com
--   investor@ribhshare.com
-- 2026-09-08

-- 1. Projects + dependents (invites, cost lines, funding rounds, docs,
--    drawdowns, declarations, messages, ledger, tasks, audit rows…)
truncate table public.projects restart identity cascade;

-- 2. In-app notifications (emails/alerts tied to wiped projects)
truncate table public.notifications restart identity cascade;

-- 3. Staff invite codes (invalidates unused invite emails)
truncate table public.staff_signin_codes restart identity cascade;

-- 4. Sign-in attempt log
truncate table public.signin_code_attempts restart identity cascade;

-- 5. Audit leftover (project_id is nullable; cascade may leave orphans)
truncate table public.audit_events restart identity cascade;

-- 6. Auth users / emails except the three keep accounts
-- profiles cascade via profiles.id → auth.users
delete from auth.users
where lower(email) not in (
  'ceo@ribhshare.com',
  'linemanager@ribhshare.com',
  'investor@ribhshare.com'
);

-- Storage objects cannot be deleted from SQL (Storage API only).
-- Cleared separately via `supabase storage rm` after this migration.
