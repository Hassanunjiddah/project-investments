-- RibhShare baseline: project creation schema (fresh DB)
-- profiles, projects, project_docs, tasks, storage, RLS, RPCs

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.user_role as enum (
    'CEO', 'ADMIN', 'LINE_MANAGER', 'INVESTOR'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.project_stage as enum (
    'INITIATION', 'ACCEPTANCE', 'PROGRESS', 'END'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.approval_status as enum (
    'PENDING', 'APPROVED', 'REJECTED'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.duration_unit as enum (
    'DAYS', 'WEEKS', 'MONTHS'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.doc_kind as enum (
    'OVERVIEW', 'FUND_USE', 'RISK', 'DECISION'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.task_kind as enum (
    'REVIEW_PROJECT'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.task_status as enum (
    'OPEN', 'COMPLETED', 'CANCELLED'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  role        public.user_role not null default 'INVESTOR',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (email);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

create sequence if not exists public.project_code_seq start 100;

create table if not exists public.projects (
  id                          uuid primary key default gen_random_uuid(),
  code                        text not null default '',
  name                        text not null,
  sector                      text not null,
  location                    text not null,

  banner_storage_path         text,
  banner_mime_type            text,

  summary                     text not null default '',
  full_details                text not null default '',
  risks                       text not null default '',
  timeline                    text not null default '',

  currency_code               char(3) not null default 'NGN',
  target_minor                bigint not null check (target_minor > 0),
  raised_minor                bigint not null default 0 check (raised_minor >= 0),
  estimated_roi_bps           int not null default 0
    check (estimated_roi_bps between 0 and 10000),
  profit_split_investor_bps   int not null default 7000
    check (profit_split_investor_bps between 0 and 10000),
  exit_notice_days            int not null default 90 check (exit_notice_days > 0),
  early_exit_penalty_bps      int not null default 500
    check (early_exit_penalty_bps between 0 and 10000),

  duration_value              int not null check (duration_value > 0),
  duration_unit               public.duration_unit not null default 'MONTHS',

  pay_account                 jsonb,

  stage                       public.project_stage not null default 'INITIATION',
  approval_status             public.approval_status not null default 'PENDING',
  is_public                   boolean not null default false,
  submitted_at                timestamptz,

  created_by                  uuid not null references public.profiles (id),
  approved_by                 uuid references public.profiles (id),
  approved_at                 timestamptz,
  rejected_by                 uuid references public.profiles (id),
  rejected_at                 timestamptz,
  rejection_note              text,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists projects_code_idx on public.projects (code);

create unique index if not exists projects_code_unique_idx
  on public.projects (code) where code <> '';
create index if not exists projects_created_by_idx on public.projects (created_by);
create index if not exists projects_approval_status_idx on public.projects (approval_status);
create index if not exists projects_stage_idx on public.projects (stage);
create index if not exists projects_submitted_at_idx on public.projects (submitted_at);
create index if not exists projects_is_public_idx on public.projects (is_public);

-- ---------------------------------------------------------------------------
-- project_docs
-- ---------------------------------------------------------------------------

create table if not exists public.project_docs (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  kind              public.doc_kind not null,
  title             text not null,
  file_name         text not null,
  storage_path      text not null,
  mime_type         text not null,
  file_size_bytes   bigint,
  amount_minor      bigint check (amount_minor is null or amount_minor > 0),
  note              text,
  uploaded_by       uuid not null references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint fund_use_amount check (
    kind <> 'FUND_USE' or amount_minor is not null
  )
);

create index if not exists project_docs_project_id_idx on public.project_docs (project_id);
create index if not exists project_docs_kind_idx on public.project_docs (kind);

-- ---------------------------------------------------------------------------
-- tasks (CEO review queue)
-- ---------------------------------------------------------------------------

create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  kind            public.task_kind not null,
  status          public.task_status not null default 'OPEN',
  title           text not null,
  project_id      uuid not null references public.projects (id) on delete cascade,
  assignee_role   public.user_role not null default 'CEO',
  created_at      timestamptz not null default now(),
  completed_at    timestamptz,
  completed_by    uuid references public.profiles (id)
);

create index if not exists tasks_project_id_idx on public.tasks (project_id);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_kind_status_idx on public.tasks (kind, status);

-- ---------------------------------------------------------------------------
-- Helper functions
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
    select 1 from public.projects
    where id = p_project_id and created_by = auth.uid()
  );
$$;

create or replace function public.is_valid_pay_account(pay jsonb)
returns boolean
language sql
immutable
as $$
  select
    pay is not null
    and pay ? 'bankName'
    and pay ? 'accountName'
    and pay ? 'accountNumber'
    and length(trim(pay->>'bankName')) >= 2
    and length(trim(pay->>'accountName')) >= 2
    and length(trim(pay->>'accountNumber')) >= 10;
$$;

create or replace function public.is_project_doc_reader(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_ceo_or_admin()
    or public.is_project_owner(p_project_id);
$$;

create or replace function public.storage_project_id_from_path(path text)
returns uuid
language sql
immutable
as $$
  select (string_to_array(path, '/'))[1]::uuid;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: updated_at
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
  for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists project_docs_set_updated_at on public.project_docs;
create trigger project_docs_set_updated_at
  before update on public.project_docs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Trigger: project code generation
-- ---------------------------------------------------------------------------

create or replace function public.projects_generate_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'PRJ-' || nextval('public.project_code_seq')::text;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_generate_code on public.projects;
create trigger projects_generate_code
  before insert on public.projects
  for each row execute function public.projects_generate_code();

-- ---------------------------------------------------------------------------
-- Trigger: pay account validation
-- ---------------------------------------------------------------------------

alter table public.projects
  drop constraint if exists projects_pay_account_valid;

alter table public.projects
  add constraint projects_pay_account_valid
  check (pay_account is null or public.is_valid_pay_account(pay_account));

-- ---------------------------------------------------------------------------
-- Trigger: stage advance on approval
-- ---------------------------------------------------------------------------

create or replace function public.projects_on_approved()
returns trigger
language plpgsql
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
  for each row execute function public.projects_on_approved();

-- ---------------------------------------------------------------------------
-- Trigger: protect raised_minor from client updates
-- ---------------------------------------------------------------------------

create or replace function public.projects_protect_raised_minor()
returns trigger
language plpgsql
as $$
begin
  if new.raised_minor is distinct from old.raised_minor then
    if coalesce(current_setting('app.allow_raised_minor_update', true), '') <> 'true' then
      raise exception 'raised_minor cannot be updated directly';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_protect_raised_minor on public.projects;
create trigger projects_protect_raised_minor
  before update of raised_minor on public.projects
  for each row execute function public.projects_protect_raised_minor();

-- ---------------------------------------------------------------------------
-- Trigger: auto-create profile on auth.users insert
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
  exception when others then
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
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPC: submit project for CEO review
-- ---------------------------------------------------------------------------

create or replace function public.submit_project_for_review(p_project_id uuid)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_role public.user_role;
  v_doc_kinds public.doc_kind[];
  v_required public.doc_kind[] := array['OVERVIEW','FUND_USE','RISK','DECISION']::public.doc_kind[];
begin
  v_role := public.current_user_role();

  select * into v_project from public.projects where id = p_project_id;
  if not found then
    raise exception 'Project not found';
  end if;

  if v_role not in ('LINE_MANAGER', 'CEO', 'ADMIN') then
    raise exception 'Not authorized to submit projects';
  end if;

  if v_role = 'LINE_MANAGER' and v_project.created_by <> auth.uid() then
    raise exception 'You can only submit your own projects';
  end if;

  if v_project.submitted_at is not null then
    raise exception 'Project already submitted';
  end if;

  if v_project.banner_storage_path is null then
    raise exception 'Banner image is required before submit';
  end if;

  select array_agg(distinct kind) into v_doc_kinds
  from public.project_docs where project_id = p_project_id;

  if v_doc_kinds is null or not v_required <@ v_doc_kinds then
    raise exception 'All required documents must be uploaded before submit';
  end if;

  update public.projects
  set submitted_at = now(), approval_status = 'PENDING'
  where id = p_project_id
  returning * into v_project;

  insert into public.tasks (kind, title, project_id, assignee_role)
  values (
    'REVIEW_PROJECT',
    'Review project: ' || v_project.name,
    p_project_id,
    'CEO'
  );

  return v_project;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: CEO approve or reject project
-- ---------------------------------------------------------------------------

create or replace function public.decide_project_approval(
  p_project_id uuid,
  p_approval_status public.approval_status,
  p_rejection_note text default null
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
begin
  if not public.is_ceo_or_admin() then
    raise exception 'Only CEO or admin can approve projects';
  end if;

  if p_approval_status not in ('APPROVED', 'REJECTED') then
    raise exception 'approval_status must be APPROVED or REJECTED';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.submitted_at is null then
    raise exception 'Project has not been submitted for review';
  end if;

  if v_project.approval_status <> 'PENDING' then
    raise exception 'Project is not pending approval';
  end if;

  if p_approval_status = 'APPROVED' then
    update public.projects
    set
      approval_status = 'APPROVED',
      approved_by = auth.uid(),
      approved_at = now(),
      rejected_by = null,
      rejected_at = null,
      rejection_note = null
    where id = p_project_id
    returning * into v_project;
  else
    update public.projects
    set
      approval_status = 'REJECTED',
      rejected_by = auth.uid(),
      rejected_at = now(),
      rejection_note = p_rejection_note,
      approved_by = null,
      approved_at = null
    where id = p_project_id
    returning * into v_project;
  end if;

  update public.tasks
  set
    status = 'COMPLETED',
    completed_at = now(),
    completed_by = auth.uid()
  where project_id = p_project_id
    and kind = 'REVIEW_PROJECT'
    and status = 'OPEN';

  return v_project;
end;
$$;

grant execute on function public.submit_project_for_review(uuid) to authenticated;
grant execute on function public.decide_project_approval(uuid, public.approval_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_docs enable row level security;
alter table public.tasks enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, delete on public.project_docs to authenticated;
grant select, update on public.tasks to authenticated;

revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- profiles
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_ceo_or_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- projects SELECT
drop policy if exists projects_select_ceo_admin on public.projects;
create policy projects_select_ceo_admin
  on public.projects for select to authenticated
  using (public.is_ceo_or_admin());

drop policy if exists projects_select_line_manager on public.projects;
create policy projects_select_line_manager
  on public.projects for select to authenticated
  using (
    public.current_user_role() = 'LINE_MANAGER'
    and created_by = auth.uid()
  );

drop policy if exists projects_select_investor_public on public.projects;
create policy projects_select_investor_public
  on public.projects for select to authenticated
  using (
    public.current_user_role() = 'INVESTOR'
    and is_public = true
    and approval_status = 'APPROVED'
  );

-- projects INSERT
drop policy if exists projects_insert_manager_ceo_admin on public.projects;
create policy projects_insert_manager_ceo_admin
  on public.projects for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.current_user_role() in ('LINE_MANAGER', 'CEO', 'ADMIN')
  );

-- projects UPDATE
drop policy if exists projects_update_line_manager on public.projects;
create policy projects_update_line_manager
  on public.projects for update to authenticated
  using (
    public.current_user_role() = 'LINE_MANAGER'
    and created_by = auth.uid()
    and approval_status <> 'APPROVED'
  )
  with check (
    public.current_user_role() = 'LINE_MANAGER'
    and created_by = auth.uid()
    and approval_status <> 'APPROVED'
  );

drop policy if exists projects_update_ceo_admin on public.projects;
create policy projects_update_ceo_admin
  on public.projects for update to authenticated
  using (public.is_ceo_or_admin())
  with check (public.is_ceo_or_admin());

-- project_docs
drop policy if exists project_docs_select on public.project_docs;
create policy project_docs_select
  on public.project_docs for select to authenticated
  using (public.is_project_doc_reader(project_id));

drop policy if exists project_docs_insert on public.project_docs;
create policy project_docs_insert
  on public.project_docs for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      public.is_project_owner(project_id)
      or public.current_user_role() in ('CEO', 'ADMIN')
    )
  );

drop policy if exists project_docs_delete on public.project_docs;
create policy project_docs_delete
  on public.project_docs for delete to authenticated
  using (
    public.current_user_role() = 'ADMIN'
    or (
      public.is_project_owner(project_id)
      and exists (
        select 1 from public.projects p
        where p.id = project_id and p.approval_status <> 'APPROVED'
      )
    )
  );

-- tasks
drop policy if exists tasks_select_ceo_admin on public.tasks;
create policy tasks_select_ceo_admin
  on public.tasks for select to authenticated
  using (public.is_ceo_or_admin());

drop policy if exists tasks_select_owner on public.tasks;
create policy tasks_select_owner
  on public.tasks for select to authenticated
  using (
    public.current_user_role() = 'LINE_MANAGER'
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.created_by = auth.uid()
    )
  );

drop policy if exists tasks_update_ceo_admin on public.tasks;
create policy tasks_update_ceo_admin
  on public.tasks for update to authenticated
  using (public.is_ceo_or_admin())
  with check (public.is_ceo_or_admin());

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents',
  'project-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-banners',
  'project-banners',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- project-documents storage policies
drop policy if exists project_documents_select on storage.objects;
create policy project_documents_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-documents'
    and public.is_project_doc_reader(public.storage_project_id_from_path(name))
  );

drop policy if exists project_documents_insert on storage.objects;
create policy project_documents_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-documents'
    and (
      public.is_project_owner(public.storage_project_id_from_path(name))
      or public.is_ceo_or_admin()
    )
  );

drop policy if exists project_documents_delete on storage.objects;
create policy project_documents_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-documents'
    and (
      public.current_user_role() = 'ADMIN'
      or (
        public.is_project_owner(public.storage_project_id_from_path(name))
        and exists (
          select 1 from public.projects p
          where p.id = public.storage_project_id_from_path(name)
            and p.approval_status <> 'APPROVED'
        )
      )
    )
  );

-- project-banners storage policies
drop policy if exists project_banners_select on storage.objects;
create policy project_banners_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-banners'
    and (
      public.is_project_doc_reader(public.storage_project_id_from_path(name))
      or (
        public.current_user_role() = 'INVESTOR'
        and exists (
          select 1 from public.projects p
          where p.id = public.storage_project_id_from_path(name)
            and p.is_public = true
            and p.approval_status = 'APPROVED'
        )
      )
    )
  );

drop policy if exists project_banners_insert on storage.objects;
create policy project_banners_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-banners'
    and (
      public.is_project_owner(public.storage_project_id_from_path(name))
      or public.is_ceo_or_admin()
    )
  );

drop policy if exists project_banners_update on storage.objects;
create policy project_banners_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'project-banners'
    and (
      public.is_project_owner(public.storage_project_id_from_path(name))
      or public.is_ceo_or_admin()
    )
  );

drop policy if exists project_banners_delete on storage.objects;
create policy project_banners_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-banners'
    and (
      public.current_user_role() = 'ADMIN'
      or (
        public.is_project_owner(public.storage_project_id_from_path(name))
        and exists (
          select 1 from public.projects p
          where p.id = public.storage_project_id_from_path(name)
            and p.approval_status <> 'APPROVED'
        )
      )
    )
  );
