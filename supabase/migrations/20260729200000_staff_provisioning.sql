-- ---------------------------------------------------------------------------
-- Staff provisioning — CEO-invited Line Managers + single-CEO guarantee.
--
-- Product rules:
--   * Only the CEO creates Line Managers (via the create-user edge function,
--     which now emails a one-time 8-char sign-in code instead of a password).
--   * Line Managers invite investors (existing send-invitation flow).
--   * At most ONE profile may hold the CEO role.
--
-- The code machinery mirrors the investor first-signin flow
-- (20260121000001_investor_first_signin.sql) but lives in its own table since
-- staff have no `invites` row. Codes are only readable/writable via the
-- SECURITY DEFINER RPCs below (service_role — edge functions).
--
-- 2026-07-29
-- ---------------------------------------------------------------------------

-- 1. Single CEO -----------------------------------------------------------

-- Data fix: the deployed database accumulated two CEO profiles. Decision
-- (2026-07-29): ceo@ribhshare.com remains the sole CEO; any other CEO is
-- demoted to ADMIN (near-identical access, but cannot create line managers).
update public.profiles
set role = 'ADMIN'
where role = 'CEO'
  and lower(email) <> 'ceo@ribhshare.com';

-- Partial unique index over a constant: at most one row may satisfy the
-- predicate, i.e. at most one CEO profile can ever exist.
create unique index if not exists profiles_single_ceo_uidx
  on public.profiles ((true))
  where role = 'CEO';

-- 2. Staff sign-in codes -----------------------------------------------------

create table if not exists public.staff_signin_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists staff_signin_codes_code_uidx
  on public.staff_signin_codes (code);

-- RLS on, no policies: only service_role (edge functions) touches this table.
alter table public.staff_signin_codes enable row level security;

-- 3. RPC: generate a fresh code for a staff user ------------------------------

create or replace function public.generate_staff_signin_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
  v_attempts int := 0;
begin
  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 10 then
      raise exception 'Could not generate a unique code';
    end if;
    -- Same alphabet as invite codes: 8-char uppercase, ambiguity-free.
    v_code := upper(
      translate(
        substr(encode(gen_random_bytes(8), 'base64'), 1, 8),
        '+/=OoIl01',
        'ABCDEFGH2'
      )
    );
    begin
      insert into public.staff_signin_codes (user_id, code, expires_at, redeemed_at)
      values (p_user_id, v_code, now() + interval '14 days', null)
      on conflict (user_id) do update
        set code = excluded.code,
            expires_at = excluded.expires_at,
            redeemed_at = null;
      exit;
    exception when unique_violation then
      -- code collision — try again
    end;
  end loop;
  return v_code;
end;
$$;

revoke all on function public.generate_staff_signin_code(uuid) from public, anon, authenticated;
-- service_role only (create-user edge function calls this)

-- 4. RPC: redeem a staff code --------------------------------------------------

create or replace function public.redeem_staff_signin_code(p_email text, p_code text)
returns table (
  user_id uuid,
  user_role text,
  password_already_set boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_entry public.staff_signin_codes;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'Email is required';
  end if;
  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'Code is required';
  end if;

  select p.* into v_profile
  from public.profiles p
  where lower(p.email) = lower(trim(p_email));

  if not found then
    raise exception 'Invalid email or code';
  end if;

  select s.* into v_entry
  from public.staff_signin_codes s
  where s.user_id = v_profile.id
    and s.code = upper(trim(p_code));

  if not found then
    raise exception 'Invalid email or code';
  end if;

  if v_entry.expires_at < now() then
    raise exception 'This code has expired. Please ask the CEO to send a new invitation.';
  end if;

  if v_entry.redeemed_at is not null then
    raise exception 'This code has already been used. Sign in with your password.';
  end if;

  update public.staff_signin_codes
  set redeemed_at = now()
  where staff_signin_codes.user_id = v_profile.id;

  return query select
    v_profile.id,
    v_profile.role::text,
    (v_profile.password_set_at is not null);
end;
$$;

revoke all on function public.redeem_staff_signin_code(text, text) from public, anon, authenticated;
-- Called by the redeem-invite-code edge function using service role.
