-- Wipe all projects and related operational data from the interface.
-- Keeps auth users + profiles so staff/investors can still sign in.
-- 2026-08-06

-- Projects + dependents (invites, updates, declarations, threads, drawdowns,
-- withdrawals, tasks, ledger rows that FK into projects, etc.)
truncate table public.projects restart identity cascade;

-- Standalone notification center rows
truncate table public.notifications restart identity cascade;
