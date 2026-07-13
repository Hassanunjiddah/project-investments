-- RibhShare demo seed data (project creation schema)
-- Replace placeholder UUIDs with real auth.users IDs from Supabase Dashboard.

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

-- Sample projects (amounts in minor units / kobo)
insert into public.projects (
  id,
  code,
  name,
  sector,
  location,
  summary,
  stage,
  approval_status,
  target_minor,
  raised_minor,
  duration_value,
  duration_unit,
  estimated_roi_bps,
  profit_split_investor_bps,
  exit_notice_days,
  early_exit_penalty_bps,
  submitted_at,
  approved_by,
  approved_at,
  created_by
) values
  (
    '10000000-0000-4000-8000-000000000104',
    'PRJ-104',
    'Kano Solar Cold-Chain',
    'Agri / Energy',
    'Kano State, Nigeria',
    'Solar cold-chain facility reducing post-harvest losses.',
    'PROGRESS',
    'APPROVED',
    15000000000,
    9000000000,
    12,
    'MONTHS',
    1800,
    7000,
    90,
    500,
    now(),
    'c56e6b66-9389-4173-9b04-fabb7e60ccb3',
    now(),
    '264584c6-d1d3-4a53-b7a0-60c63ac7e2ac'
  ),
  (
    '10000000-0000-4000-8000-000000000118',
    'PRJ-118',
    'Lagos Last-Mile Logistics',
    'Logistics',
    'Lagos State, Nigeria',
    'Electric tricycle fleet for last-mile delivery.',
    'INITIATION',
    'PENDING',
    8000000000,
    0,
    12,
    'MONTHS',
    1800,
    7000,
    90,
    500,
    now(),
    null,
    null,
    '264584c6-d1d3-4a53-b7a0-60c63ac7e2ac'
  )
on conflict (id) do nothing;

-- CEO review task for pending project
insert into public.tasks (kind, title, project_id, assignee_role)
select 'REVIEW_PROJECT', 'Review project: Lagos Last-Mile Logistics', id, 'CEO'
from public.projects
where id = 'c56e6b66-9389-4173-9b04-fabb7e60ccb3'
  and not exists (
    select 1 from public.tasks t
    where t.project_id = projects.id and t.kind = 'REVIEW_PROJECT' and t.status = 'OPEN'
  );
