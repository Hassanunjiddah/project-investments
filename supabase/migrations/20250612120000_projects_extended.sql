-- RibhShare: extended projects, project_docs, storage bucket + RLS

-- ---------------------------------------------------------------------------
-- Extended project columns
-- ---------------------------------------------------------------------------

alter table public.projects
  add column if not exists location text not null default '',
  add column if not exists summary text not null default '',
  add column if not exists full_details text not null default '',
  add column if not exists risks text not null default '',
  add column if not exists timeline text not null default '',
  add column if not exists pay_account jsonb;

-- ---------------------------------------------------------------------------
-- doc_kind enum + project_docs table
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.doc_kind as enum (
    'OVERVIEW',
    'FUND_USE',
    'RISK',
    'DECISION'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.project_docs (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  kind              public.doc_kind not null,
  title             text not null,
  file_name         text not null,
  storage_path      text not null,
  mime_type         text not null,
  file_size_bytes   bigint,
  amount_kobo       bigint check (amount_kobo is null or amount_kobo > 0),
  note              text,
  uploaded_by       uuid not null references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint fund_use_amount check (
    kind <> 'FUND_USE' or amount_kobo is not null
  )
);

create index if not exists project_docs_project_id_idx on public.project_docs (project_id);
create index if not exists project_docs_kind_idx on public.project_docs (kind);

drop trigger if exists project_docs_set_updated_at on public.project_docs;
create trigger project_docs_set_updated_at
  before update on public.project_docs
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper: can read project documents
-- ---------------------------------------------------------------------------

create or replace function public.is_project_doc_reader(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_ceo_or_admin()
    or public.is_project_owner(p_project_id)
    or public.investor_has_invite_on_project(p_project_id);
$$;

-- ---------------------------------------------------------------------------
-- RLS: investor profile lookup for invite picker
-- ---------------------------------------------------------------------------

drop policy if exists profiles_select_investors_for_managers on public.profiles;
create policy profiles_select_investors_for_managers
  on public.profiles
  for select
  to authenticated
  using (
    role = 'INVESTOR'
    and public.current_user_role() in ('LINE_MANAGER', 'ADMIN')
  );

-- ---------------------------------------------------------------------------
-- RLS: project_docs
-- ---------------------------------------------------------------------------

alter table public.project_docs enable row level security;

grant select, insert, delete on public.project_docs to authenticated;

drop policy if exists project_docs_select on public.project_docs;
create policy project_docs_select
  on public.project_docs
  for select
  to authenticated
  using (public.is_project_doc_reader(project_id));

drop policy if exists project_docs_insert on public.project_docs;
create policy project_docs_insert
  on public.project_docs
  for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      public.is_project_owner(project_id)
      or public.current_user_role() = 'ADMIN'
    )
  );

drop policy if exists project_docs_delete on public.project_docs;
create policy project_docs_delete
  on public.project_docs
  for delete
  to authenticated
  using (
    public.current_user_role() = 'ADMIN'
    or (
      public.is_project_owner(project_id)
      and exists (
        select 1 from public.projects p
        where p.id = project_id
          and p.approval_status <> 'APPROVED'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket: project-documents
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

-- Storage RLS helpers use folder name = project_id (first path segment)
create or replace function public.storage_project_id_from_path(path text)
returns uuid
language sql
immutable
as $$
  select (string_to_array(path, '/'))[1]::uuid;
$$;

drop policy if exists project_documents_select on storage.objects;
create policy project_documents_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-documents'
    and public.is_project_doc_reader(public.storage_project_id_from_path(name))
  );

drop policy if exists project_documents_insert on storage.objects;
create policy project_documents_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-documents'
    and (
      public.is_project_owner(public.storage_project_id_from_path(name))
      or public.is_ceo_or_admin()
    )
  );

drop policy if exists project_documents_delete on storage.objects;
create policy project_documents_delete
  on storage.objects
  for delete
  to authenticated
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
