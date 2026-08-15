-- Wipe all projects and related operational data (invites, first-signin /
-- invite email links, drawdowns, declarations, messages, ledger, tasks…).
-- Keeps auth users + profiles so staff/investors can still sign in.
-- 2026-08-15

-- Projects + dependents (invites with first_signin_code / invite links,
-- updates, declarations, threads, drawdowns, withdrawals, tasks, ledger
-- rows that FK into projects, etc.)
truncate table public.projects restart identity cascade;

-- Standalone notification center rows (in-app alerts tied to wiped projects)
truncate table public.notifications restart identity cascade;

-- Unused staff invite codes (project-owner / LM codes not yet redeemed).
-- Redeemed codes stay harmless; wiping unused ones invalidates stale emails.
delete from public.staff_signin_codes
where redeemed_at is null;
