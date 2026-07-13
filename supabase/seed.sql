-- RibhShare local dev seed
-- Creates demo auth users + profiles, then sample projects.
-- All demo accounts use password: password123

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Demo users (auth.users + identities → handle_new_user creates profiles)
-- ---------------------------------------------------------------------------

do $$
declare
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';
  v_password text := crypt('password123', gen_salt('bf'));
  u record;
begin
  for u in
    select *
    from (
      values
        ('00000000-0000-4000-8000-000000000001'::uuid, 'ceo@ribhshare.local', 'Aisha (CEO)', 'CEO'),
        ('00000000-0000-4000-8000-000000000002'::uuid, 'admin@ribhshare.local', 'Bilal (Admin)', 'ADMIN'),
        ('00000000-0000-4000-8000-000000000003'::uuid, 'khadija@ribhshare.local', 'Khadija (Line Manager)', 'LINE_MANAGER'),
        ('00000000-0000-4000-8000-000000000004'::uuid, 'yusuf@ribhshare.local', 'Yusuf (Line Manager)', 'LINE_MANAGER'),
        ('00000000-0000-4000-8000-000000000005'::uuid, 'ibrahim@ribhshare.local', 'Ibrahim (Investor)', 'INVESTOR'),
        ('00000000-0000-4000-8000-000000000006'::uuid, 'fatima@ribhshare.local', 'Fatima (Investor)', 'INVESTOR')
    ) as t(id, email, full_name, role)
  loop
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    values (
      v_instance_id,
      u.id,
      'authenticated',
      'authenticated',
      u.email,
      v_password,
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', u.full_name, 'role', u.role),
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    on conflict (id) do update set
      email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now();

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      u.id,
      u.id,
      jsonb_build_object('sub', u.id::text, 'email', u.email),
      'email',
      u.id::text,
      now(),
      now(),
      now()
    )
    on conflict (provider_id, provider) do update set
      identity_data = excluded.identity_data,
      updated_at = now();

    insert into public.profiles (id, full_name, email, role)
    values (u.id, u.full_name, u.email, u.role::public.user_role)
    on conflict (id) do update set
      full_name = excluded.full_name,
      email = excluded.email,
      role = excluded.role;
  end loop;
end $$;

-- Keep project code sequence ahead of seeded codes
select setval('public.project_code_seq', 118, true);

-- ---------------------------------------------------------------------------
-- Sample projects (amounts in minor units / kobo)
-- ---------------------------------------------------------------------------

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
    '00000000-0000-4000-8000-000000000001',
    now(),
    '00000000-0000-4000-8000-000000000003'
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
    '00000000-0000-4000-8000-000000000004'
  )
on conflict (id) do nothing;

-- CEO review task for pending project
insert into public.tasks (kind, title, project_id, assignee_role)
select 'REVIEW_PROJECT', 'Review project: Lagos Last-Mile Logistics', id, 'CEO'
from public.projects
where id = '10000000-0000-4000-8000-000000000118'
  and not exists (
    select 1 from public.tasks t
    where t.project_id = projects.id
      and t.kind = 'REVIEW_PROJECT'
      and t.status = 'OPEN'
  );
