-- RibhShare Phase 1: investor first-time sign-in via 8-char code
-- 2026-01-21
-- Adds columns + helpers so the send-invitation flow can issue a one-time code
-- that the investor uses to sign in for the first time and set a password.

-- ---------------------------------------------------------------------------
-- Columns on invites
-- ---------------------------------------------------------------------------

alter table public.invites
  add column if not exists first_signin_code text,
  add column if not exists first_signin_code_expires_at timestamptz,
  add column if not exists first_signin_code_redeemed_at timestamptz,
  add column if not exists is_new_investor boolean not null default false;

create unique index if not exists invites_first_signin_code_uidx
  on public.invites (first_signin_code)
  where first_signin_code is not null;

-- Password set-flag on profiles (so we can force set-password on first login)
alter table public.profiles
  add column if not exists password_set_at timestamptz;

-- ---------------------------------------------------------------------------
-- Helper: generate a fresh 8-char alphanumeric code for an invite
-- ---------------------------------------------------------------------------

create or replace function public.generate_invite_signin_code(p_invite_id uuid)
returns text
language plpgsql
security definer
set search_path = public
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
      set first_signin_code = v_code,
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
-- service_role only (edge functions call this)

-- ---------------------------------------------------------------------------
-- Helper: verify code + email, return invite + user_id if valid.
-- Also marks the code as redeemed on success.
-- ---------------------------------------------------------------------------

create or replace function public.redeem_invite_signin_code(p_email text, p_code text)
returns table (
  invite_id uuid,
  investor_id uuid,
  project_id uuid,
  password_already_set boolean
)
language plpgsql
security definer
set search_path = public
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
    and first_signin_code = upper(trim(p_code))
  order by created_at desc
  limit 1;

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
-- Called by the redeem-invite-code edge function using service role.

-- ---------------------------------------------------------------------------
-- Mark password_set_at
-- ---------------------------------------------------------------------------

create or replace function public.mark_password_set(p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set password_set_at = coalesce(password_set_at, now())
  where id = coalesce(p_user_id, auth.uid());
end;
$$;

grant execute on function public.mark_password_set(uuid) to authenticated;
