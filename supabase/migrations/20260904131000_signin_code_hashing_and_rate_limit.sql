-- ---------------------------------------------------------------------------
-- Sign-in code hardening (2026-09-04 audit).
--
-- 1. One-time sign-in codes were stored in PLAINTEXT. Staff (LM/ADMIN/CEO)
--    can select invite rows via RLS, so any staff member could read an
--    unredeemed investor code and redeem it at the public endpoint to obtain
--    a session AS the investor. Codes are now stored as sha256 hex digests;
--    only the issuing edge function ever sees the plaintext.
-- 2. The public redeem-invite-code endpoint had no durable rate limiting
--    (an in-memory Map in one deploy variant resets per isolate). Attempts
--    are now recorded in a table and checked server-side.
-- ---------------------------------------------------------------------------

-- 1. Durable rate limiting ----------------------------------------------------

create table if not exists public.signin_code_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  ip text,
  attempted_at timestamptz not null default now()
);

create index if not exists signin_code_attempts_email_idx
  on public.signin_code_attempts (email, attempted_at desc);
create index if not exists signin_code_attempts_ip_idx
  on public.signin_code_attempts (ip, attempted_at desc);

-- RLS on, no policies: only service_role (edge functions) touches this table.
alter table public.signin_code_attempts enable row level security;

-- Returns true when the attempt is allowed (and records it), false when the
-- caller is over the limit. Limits: 8 attempts per email / 30 per IP within a
-- rolling 10-minute window. Rows older than 1 hour are pruned opportunistically.
create or replace function public.check_signin_rate_limit(p_email text, p_ip text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_count int;
  v_ip_count int := 0;
begin
  delete from public.signin_code_attempts
  where attempted_at < now() - interval '1 hour';

  select count(*) into v_email_count
  from public.signin_code_attempts
  where email = lower(trim(p_email))
    and attempted_at > now() - interval '10 minutes';

  if p_ip is not null and p_ip <> '' then
    select count(*) into v_ip_count
    from public.signin_code_attempts
    where ip = p_ip
      and attempted_at > now() - interval '10 minutes';
  end if;

  if v_email_count >= 8 or v_ip_count >= 30 then
    return false;
  end if;

  insert into public.signin_code_attempts (email, ip)
  values (lower(trim(p_email)), nullif(p_ip, ''));

  return true;
end;
$$;

revoke all on function public.check_signin_rate_limit(text, text) from public, anon, authenticated;
-- service_role only (redeem-invite-code edge function calls this)

-- 2. Hash codes at rest -------------------------------------------------------

-- Generation: store sha256(code); return the plaintext once to the caller.

create or replace function public.generate_invite_signin_code(p_invite_id uuid)
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
    -- 8-char alphanumeric, uppercase-safe, ambiguity-free (no 0/O/1/I)
    v_code := upper(
      translate(
        substr(encode(gen_random_bytes(8), 'base64'), 1, 8),
        '+/=OoIl01',
        'ABCDEFGH2'
      )
    );
    begin
      update public.invites
      set first_signin_code = encode(extensions.digest(v_code, 'sha256'), 'hex'),
          first_signin_code_expires_at = now() + interval '14 days',
          first_signin_code_redeemed_at = null
      where id = p_invite_id;
      exit;
    exception when unique_violation then
      -- try again
    end;
  end loop;
  return v_code;
end;
$$;

revoke all on function public.generate_invite_signin_code(uuid) from public, anon, authenticated;

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
    v_code := upper(
      translate(
        substr(encode(gen_random_bytes(8), 'base64'), 1, 8),
        '+/=OoIl01',
        'ABCDEFGH2'
      )
    );
    begin
      insert into public.staff_signin_codes (user_id, code, expires_at, redeemed_at)
      values (p_user_id, encode(extensions.digest(v_code, 'sha256'), 'hex'), now() + interval '14 days', null)
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

-- Redemption: compare hashes.

create or replace function public.redeem_invite_signin_code(p_email text, p_code text)
returns table (
  invite_id uuid,
  investor_id uuid,
  project_id uuid,
  password_already_set boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invite public.invites;
  v_profile public.profiles;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'Email is required';
  end if;
  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'Code is required';
  end if;

  select * into v_invite
  from public.invites
  where lower(email) = lower(trim(p_email))
    and first_signin_code = encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex')
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Invalid email or code';
  end if;

  if v_invite.first_signin_code_expires_at is null
     or v_invite.first_signin_code_expires_at < now() then
    raise exception 'This code has expired. Please request a new invitation.';
  end if;

  if v_invite.first_signin_code_redeemed_at is not null then
    raise exception 'This code has already been used. Sign in with your password.';
  end if;

  select * into v_profile from public.profiles where id = v_invite.investor_id;

  update public.invites
  set first_signin_code_redeemed_at = now()
  where id = v_invite.id;

  return query select
    v_invite.id,
    v_invite.investor_id,
    v_invite.project_id,
    (v_profile.password_set_at is not null);
end;
$$;

revoke all on function public.redeem_invite_signin_code(text, text) from public, anon, authenticated;

create or replace function public.redeem_staff_signin_code(p_email text, p_code text)
returns table (
  user_id uuid,
  user_role text,
  password_already_set boolean
)
language plpgsql
security definer
set search_path = public, extensions
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
    and s.code = encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex')
  for update;

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

-- 3. Backfill: hash any outstanding plaintext codes so previously-issued,
--    unredeemed codes keep working. Plaintext codes are exactly 8 chars;
--    sha256 hex digests are 64 — the length check makes this idempotent.

update public.invites
set first_signin_code = encode(extensions.digest(first_signin_code, 'sha256'), 'hex')
where first_signin_code is not null
  and length(first_signin_code) = 8;

update public.staff_signin_codes
set code = encode(extensions.digest(code, 'sha256'), 'hex')
where length(code) = 8;
