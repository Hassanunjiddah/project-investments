-- RibhShare: edge function support, investor gating, payment proof storage

-- ---------------------------------------------------------------------------
-- Invite proof file columns
-- ---------------------------------------------------------------------------

alter table public.invites
  add column if not exists proof_storage_path text,
  add column if not exists proof_file_name text,
  add column if not exists proof_mime_type text;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.investor_invite_status_on_project(p_project_id uuid)
returns public.invite_status
language sql
stable
security definer
set search_path = public
as $$
  select status
  from public.invites
  where project_id = p_project_id
    and investor_id = auth.uid()
  order by created_at desc
  limit 1;
$$;

create or replace function public.investor_can_read_doc_summary(p_project_id uuid)
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
      and status in ('ACCEPTED', 'COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED')
  );
$$;

-- Investors never download project-documents; managers/CEO/admin only
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

alter table public.projects
  drop constraint if exists projects_pay_account_valid;

alter table public.projects
  add constraint projects_pay_account_valid
  check (public.is_valid_pay_account(pay_account))
  not valid;

-- ---------------------------------------------------------------------------
-- Doc summary RPC (metadata only, no storage_path)
-- ---------------------------------------------------------------------------

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
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_investor_id
    and not public.is_ceo_or_admin()
    and not public.is_project_owner(p_project_id)
  then
    raise exception 'Forbidden';
  end if;

  if not exists (
    select 1
    from public.invites
    where project_id = p_project_id
      and investor_id = p_investor_id
      and status in ('ACCEPTED', 'COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED')
  ) then
    return;
  end if;

  return query
  select d.id, d.kind, d.title, d.file_name
  from public.project_docs d
  where d.project_id = p_project_id
  order by d.created_at desc;
end;
$$;

grant execute on function public.get_project_docs_summary(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Investor invitation list RPC (safe project name only)
-- ---------------------------------------------------------------------------

create or replace function public.list_investor_invitations()
returns table (
  id uuid,
  project_id uuid,
  investor_id uuid,
  status public.invite_status,
  amount_kobo bigint,
  projected_profit_kobo bigint,
  proof_name text,
  proof_file_name text,
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
    i.status,
    i.amount_kobo,
    i.projected_profit_kobo,
    i.proof_name,
    i.proof_file_name,
    p.name as project_name,
    i.created_at
  from public.invites i
  join public.projects p on p.id = i.project_id
  where i.investor_id = auth.uid()
  order by i.created_at desc;
$$;

grant execute on function public.list_investor_invitations() to authenticated;

-- ---------------------------------------------------------------------------
-- Remove investor direct SELECT on full projects rows
-- ---------------------------------------------------------------------------

drop policy if exists projects_select_investor_via_invite on public.projects;

-- ---------------------------------------------------------------------------
-- Tighten project_docs SELECT for investors (metadata via RPC only)
-- ---------------------------------------------------------------------------

drop policy if exists project_docs_select on public.project_docs;
create policy project_docs_select
  on public.project_docs
  for select
  to authenticated
  using (public.is_project_doc_reader(project_id));

-- ---------------------------------------------------------------------------
-- Storage bucket: payment-proofs
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

create or replace function public.storage_invite_id_from_path(path text)
returns uuid
language sql
immutable
as $$
  select (string_to_array(path, '/'))[1]::uuid;
$$;

create or replace function public.can_read_payment_proof(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.invites i
    where i.id = public.storage_invite_id_from_path(p_path)
      and (
        i.investor_id = auth.uid()
        or public.is_ceo_or_admin()
        or public.is_project_owner(i.project_id)
      )
  );
$$;

create or replace function public.can_upload_payment_proof(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.invites i
    where i.id = public.storage_invite_id_from_path(p_path)
      and i.investor_id = auth.uid()
      and i.status = 'COMMITTED'
  );
$$;

drop policy if exists payment_proofs_select on storage.objects;
create policy payment_proofs_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and public.can_read_payment_proof(name)
  );

drop policy if exists payment_proofs_insert on storage.objects;
create policy payment_proofs_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and public.can_upload_payment_proof(name)
  );

drop policy if exists payment_proofs_delete on storage.objects;
create policy payment_proofs_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and public.is_ceo_or_admin()
  );
