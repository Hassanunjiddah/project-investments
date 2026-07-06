-- RibhShare demo seed data
-- Replace placeholder UUIDs with real auth.users IDs from Supabase Dashboard
-- before running. See supabase/README.md for setup steps.

-- Demo user UUID placeholders (substitute after creating auth users):
--   CEO          : 00000000-0000-4000-8000-000000000001  (Aisha)
--   Admin        : 00000000-0000-4000-8000-000000000002  (Bilal)
--   Line Manager : 00000000-0000-4000-8000-000000000003  (Khadija)
--   Line Manager : 00000000-0000-4000-8000-000000000004  (Yusuf)
--   Investor     : 00000000-0000-4000-8000-000000000005  (Ibrahim)
--   Investor     : 00000000-0000-4000-8000-000000000006  (Fatima)

-- ---------------------------------------------------------------------------
-- Profiles (skip if handle_new_user trigger already created them on auth insert)
-- Update roles after trigger creates default INVESTOR rows:
-- ---------------------------------------------------------------------------

update public.profiles set role = 'CEO', full_name = 'Aisha (CEO)'
  where id = '00000000-0000-4000-8000-000000000001';

update public.profiles set role = 'ADMIN', full_name = 'Bilal (Admin)'
  where id = '00000000-0000-4000-8000-000000000002';

update public.profiles set role = 'LINE_MANAGER', full_name = 'Khadija (Line Manager)'
  where id = '00000000-0000-4000-8000-000000000003';

update public.profiles set role = 'LINE_MANAGER', full_name = 'Yusuf (Line Manager)'
  where id = '00000000-0000-4000-8000-000000000004';

update public.profiles set role = 'INVESTOR', full_name = 'Ibrahim (Investor)'
  where id = '00000000-0000-4000-8000-000000000005';

update public.profiles set role = 'INVESTOR', full_name = 'Fatima (Investor)'
  where id = '00000000-0000-4000-8000-000000000006';

-- ---------------------------------------------------------------------------
-- Projects (amounts in kobo — 1 NGN = 100 kobo)
-- Mirrors web prototype seed: PRJ-104, PRJ-118, PRJ-121
-- ---------------------------------------------------------------------------

insert into public.projects (
  id,
  name,
  sector,
  stage,
  approval_status,
  target_kobo,
  raised_kobo,
  profit_split_investor_bps,
  exit_notice_days,
  early_exit_penalty_bps,
  created_by
) values
  (
    '10000000-0000-4000-8000-000000000104',
    'Kano Solar Cold-Chain',
    'Agri / Energy',
    'PROGRESS',
    'APPROVED',
    15000000000,  -- ₦150,000,000
    9000000000,   -- ₦90,000,000 raised
    7000,
    90,
    500,
    '00000000-0000-4000-8000-000000000003'
  ),
  (
    '10000000-0000-4000-8000-000000000118',
    'Lagos Last-Mile Logistics',
    'Logistics',
    'INITIATION',
    'PENDING',
    8000000000,   -- ₦80,000,000
    0,
    7000,
    90,
    500,
    '00000000-0000-4000-8000-000000000004'
  ),
  (
    '10000000-0000-4000-8000-000000000121',
    'Abuja Modular Housing',
    'Real Estate',
    'ACCEPTANCE',
    'APPROVED',
    20000000000,  -- ₦200,000,000
    0,
    7000,
    90,
    500,
    '00000000-0000-4000-8000-000000000003'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------

insert into public.invites (
  id,
  project_id,
  investor_id,
  status,
  amount_kobo,
  projected_profit_kobo
) values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000104',
    '00000000-0000-4000-8000-000000000005',
    'CONFIRMED',
    5000000000,   -- ₦50,000,000 committed
    700000000     -- ₦7,000,000 projected profit
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000104',
    '00000000-0000-4000-8000-000000000006',
    'INVITED',
    3000000000,   -- ₦30,000,000 proposed
    420000000     -- ₦4,200,000 projected profit
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000121',
    '00000000-0000-4000-8000-000000000005',
    'ACCEPTED',
    4000000000,
    560000000
  )
on conflict (id) do nothing;
