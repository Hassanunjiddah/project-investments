-- RibhShare: project invites (email-based), RPCs, payment-proofs storage

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.invite_status as enum (
    'INVITED',
    'ACCEPTED',
    'COMMITTED',
    'PROOF_SUBMITTED',
    'CONFIRMED',
    'DECLINED'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- invites
-- ---------------------------------------------------------------------------

create table if not exists public.invites (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references public.projects (id) on delete cascade,
  email                   text not null,
  investor_id             uuid not null references public.profiles (id),
  status                  public.invite_status not null default 'INVITED',
  amount_kobo             bigint check (amount_kobo is null or amount_kobo > 0),
  projected_profit_kobo   bigint check (projected_profit_kobo is null or projected_profit_kobo >= 0),
  proof_name              text,
  proof_file_name         text,
  proof_storage_path      text,
  proof_mime_type         text,
  invited_by              uuid not null references public.profiles (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint invites_project_email_unique unique (project_id, email)
);

create index if not exists invites_project_id_idx on public.invites (project_id);
create index if not exists invites_investor_id_idx on public.invites (investor_id);
create index if not exists invites_email_idx on public.invites (lower(email));
create index if not exists invites_status_idx on public.invites (status);

drop trigger if exists invites_set_updated_at on public.invites;
create trigger invites_set_updated_at
  before update on public.invites
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function public.is_investor_invited_to_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.invites i
    where i.project_id = p_project_id
      and i.investor_id = auth.uid()
      and i.status not in ('DECLINED')
  );
$$;

create or replace function public.is_invite_investor(p_invite_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.invites i
    where i.id = p_invite_id
      and i.investor_id = auth.uid()
  );
$$;

create or replace function public.is_invite_project_manager(p_invite_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.invites i
    join public.projects p on p.id = i.project_id
    where i.id = p_invite_id
      and (
        public.is_ceo_or_admin()
        or (public.current_user_role() = 'LINE_MANAGER' and p.created_by = auth.uid())
      )
  );
$$;

create or replace function public.storage_invite_id_from_path(path text)
returns uuid
language sql
immutable
as $$
  select (string_to_array(path, '/'))[1]::uuid;
$$;

-- Investors with an active invite can read project docs after acceptance
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
    or exists (
      select 1 from public.invites i
      where i.project_id = p_project_id
        and i.investor_id = auth.uid()
        and i.status in ('ACCEPTED', 'COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED')
    );
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.list_investor_invitations()
returns table (
  id uuid,
  project_id uuid,
  investor_id uuid,
  email text,
  status public.invite_status,
  amount_kobo bigint,
  projected_profit_kobo bigint,
  proof_name text,
  proof_file_name text,
  proof_storage_path text,
  project_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.project_id,
    i.investor_id,
    i.email,
    i.status,
    i.amount_kobo,
    i.projected_profit_kobo,
    i.proof_name,
    i.proof_file_name,
    i.proof_storage_path,
    p.name as project_name,
    i.created_at
  from public.invites i
  join public.projects p on p.id = i.project_id
  where i.investor_id = auth.uid()
  order by i.created_at desc;
$$;

create or replace function public.get_project_docs_summary(
  p_project_id uuid,
  p_investor_id uuid
)
returns table (
  id uuid,
  kind public.doc_kind,
  title text,
  file_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.kind, d.title, d.file_name
  from public.project_docs d
  where d.project_id = p_project_id
    and (
      public.is_ceo_or_admin()
      or public.is_project_owner(p_project_id)
      or (
        p_investor_id = auth.uid()
        and exists (
          select 1 from public.invites i
          where i.project_id = p_project_id
            and i.investor_id = auth.uid()
            and i.status in ('ACCEPTED', 'COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED')
        )
      )
    )
  order by d.created_at desc;
$$;

grant execute on function public.list_investor_invitations() to authenticated;
grant execute on function public.get_project_docs_summary(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: invites
-- ---------------------------------------------------------------------------

alter table public.invites enable row level security;

grant select, insert, update on public.invites to authenticated;

drop policy if exists invites_select_investor on public.invites;
create policy invites_select_investor
  on public.invites for select to authenticated
  using (investor_id = auth.uid());

drop policy if exists invites_select_manager on public.invites;
create policy invites_select_manager
  on public.invites for select to authenticated
  using (
    public.is_ceo_or_admin()
    or (
      public.current_user_role() = 'LINE_MANAGER'
      and exists (
        select 1 from public.projects p
        where p.id = project_id and p.created_by = auth.uid()
      )
    )
  );

drop policy if exists invites_insert_manager on public.invites;
create policy invites_insert_manager
  on public.invites for insert to authenticated
  with check (
    invited_by = auth.uid()
    and (
      public.current_user_role() = 'ADMIN'
      or (
        public.current_user_role() = 'LINE_MANAGER'
        and exists (
          select 1 from public.projects p
          where p.id = project_id
            and p.created_by = auth.uid()
            and p.approval_status = 'APPROVED'
        )
      )
    )
  );

drop policy if exists invites_update_investor on public.invites;
create policy invites_update_investor
  on public.invites for update to authenticated
  using (investor_id = auth.uid())
  with check (investor_id = auth.uid());

drop policy if exists invites_update_manager on public.invites;
create policy invites_update_manager
  on public.invites for update to authenticated
  using (public.is_invite_project_manager(id))
  with check (public.is_invite_project_manager(id));

-- Investors can read projects they are invited to
drop policy if exists projects_select_investor_invited on public.projects;
create policy projects_select_investor_invited
  on public.projects for select to authenticated
  using (
    public.current_user_role() = 'INVESTOR'
    and public.is_investor_invited_to_project(id)
  );

-- ---------------------------------------------------------------------------
-- Storage: payment-proofs
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists payment_proofs_select on storage.objects;
create policy payment_proofs_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      public.is_invite_investor(public.storage_invite_id_from_path(name))
      or public.is_invite_project_manager(public.storage_invite_id_from_path(name))
    )
  );

drop policy if exists payment_proofs_insert on storage.objects;
create policy payment_proofs_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and public.is_invite_investor(public.storage_invite_id_from_path(name))
  );

drop policy if exists payment_proofs_update on storage.objects;
create policy payment_proofs_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'payment-proofs'
    and public.is_invite_investor(public.storage_invite_id_from_path(name))
  );
