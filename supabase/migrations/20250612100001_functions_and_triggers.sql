-- RibhShare: helper functions and triggers
-- Requires 20250612100000_enums_and_tables.sql

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER — bypass RLS for role checks)
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_ceo_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('CEO', 'ADMIN') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects
    where id = p_project_id
      and created_by = auth.uid()
  );
$$;

create or replace function public.investor_has_invite_on_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.invites
    where project_id = p_project_id
      and investor_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();

drop trigger if exists invites_set_updated_at on public.invites;
create trigger invites_set_updated_at
  before update on public.invites
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile on auth.users insert
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_role public.user_role;
  v_role_text text;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  );

  v_role_text := new.raw_user_meta_data ->> 'role';

  begin
    v_role := v_role_text::public.user_role;
  exception
    when others then
      v_role := 'INVESTOR';
  end;

  insert into public.profiles (id, full_name, email, role)
  values (new.id, v_full_name, new.email, v_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Admin auto-approve on project insert
-- ---------------------------------------------------------------------------

create or replace function public.set_admin_project_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() = 'ADMIN' then
    new.approval_status := 'APPROVED';
    new.stage := 'ACCEPTANCE';
  end if;

  return new;
end;
$$;

drop trigger if exists projects_admin_auto_approve on public.projects;
create trigger projects_admin_auto_approve
  before insert on public.projects
  for each row
  execute function public.set_admin_project_approved();

-- ---------------------------------------------------------------------------
-- Invite status transition validation
-- ---------------------------------------------------------------------------

create or replace function public.is_valid_invite_transition(
  p_old public.invite_status,
  p_new public.invite_status
)
returns boolean
language plpgsql
immutable
as $$
begin
  if p_old = p_new then
    return true;
  end if;

  if p_old in ('CONFIRMED', 'DECLINED') then
    return false;
  end if;

  return (
    (p_old = 'INVITED' and p_new in ('ACCEPTED', 'DECLINED')) or
    (p_old = 'ACCEPTED' and p_new in ('COMMITTED', 'DECLINED')) or
    (p_old = 'COMMITTED' and p_new in ('PROOF_SUBMITTED', 'DECLINED')) or
    (p_old = 'PROOF_SUBMITTED' and p_new in ('CONFIRMED', 'DECLINED'))
  );
end;
$$;

create or replace function public.validate_invite_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if not public.is_valid_invite_transition(old.status, new.status) then
      raise exception 'Invalid invite status transition: % -> %', old.status, new.status;
    end if;

    v_role := public.current_user_role();

    -- Investors may advance their own invite but never confirm payment
    if v_role = 'INVESTOR' then
      if new.investor_id <> auth.uid() then
        raise exception 'Investors may only update their own invites';
      end if;

      if new.status = 'CONFIRMED' then
        raise exception 'Investors cannot confirm payment';
      end if;
    end if;

    -- Line managers may confirm/decline on their projects only
    if v_role = 'LINE_MANAGER' then
      if not public.is_project_owner(new.project_id) then
        raise exception 'Line managers may only update invites on their own projects';
      end if;

      if new.status = 'CONFIRMED' and old.status <> 'PROOF_SUBMITTED' then
        raise exception 'Can only confirm invites with proof submitted';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists invites_validate_status on public.invites;
create trigger invites_validate_status
  before update on public.invites
  for each row
  execute function public.validate_invite_status_transition();

-- ---------------------------------------------------------------------------
-- Side effects when invite is confirmed (raised_kobo + stage advance)
-- ---------------------------------------------------------------------------

create or replace function public.on_invite_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and new.status = 'CONFIRMED'
    and old.status is distinct from 'CONFIRMED'
  then
    update public.projects
    set
      raised_kobo = raised_kobo + new.amount_kobo,
      stage = case
        when stage = 'ACCEPTANCE' then 'PROGRESS'::public.project_stage
        else stage
      end
    where id = new.project_id;
  end if;

  return new;
end;
$$;

drop trigger if exists invites_on_confirmed on public.invites;
create trigger invites_on_confirmed
  after update of status on public.invites
  for each row
  execute function public.on_invite_confirmed();

-- ---------------------------------------------------------------------------
-- CEO approval: when approved, move stage to ACCEPTANCE
-- ---------------------------------------------------------------------------

create or replace function public.on_project_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and new.approval_status = 'APPROVED'
    and old.approval_status is distinct from 'APPROVED'
    and new.stage = 'INITIATION'
  then
    new.stage := 'ACCEPTANCE';
  end if;

  return new;
end;
$$;

drop trigger if exists projects_on_approved on public.projects;
create trigger projects_on_approved
  before update of approval_status on public.projects
  for each row
  execute function public.on_project_approved();
