-- Document requests (LM → project owner) + audit trail for docs/activity/edits
-- Also unlocks PROJECT_OWNER uploads (storage + project_docs insert).
-- 2026-09-03

-- ---------------------------------------------------------------------------
-- 1. Helper: assigned originator (PROJECT_OWNER), distinct from legacy
--    is_project_owner() which means projects.created_by (LM).
-- ---------------------------------------------------------------------------

create or replace function public.is_project_originator(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.project_owner_id = auth.uid()
  );
$$;

grant execute on function public.is_project_originator(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Allow originator to insert project_docs + storage objects
-- ---------------------------------------------------------------------------

drop policy if exists project_docs_insert on public.project_docs;
create policy project_docs_insert
  on public.project_docs for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      public.is_project_owner(project_id)          -- LM created_by
      or public.is_project_originator(project_id)  -- assigned PROJECT_OWNER
      or public.current_user_role() in ('CEO', 'ADMIN')
    )
  );

drop policy if exists project_documents_insert on storage.objects;
create policy project_documents_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-documents'
    and (
      public.is_project_owner(public.storage_project_id_from_path(name))
      or public.is_project_originator(public.storage_project_id_from_path(name))
      or public.is_ceo_or_admin()
      or (
        (string_to_array(name, '/'))[1] = 'inbox'
        and public.current_user_role() in ('LINE_MANAGER', 'CEO', 'ADMIN')
      )
    )
  );

drop policy if exists project_documents_update on storage.objects;
create policy project_documents_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'project-documents'
    and (
      public.is_project_owner(public.storage_project_id_from_path(name))
      or public.is_project_originator(public.storage_project_id_from_path(name))
      or public.is_ceo_or_admin()
      or (
        (string_to_array(name, '/'))[1] = 'inbox'
        and (owner = auth.uid() or public.is_ceo_or_admin())
      )
    )
  )
  with check (
    bucket_id = 'project-documents'
    and (
      public.is_project_owner(public.storage_project_id_from_path(name))
      or public.is_project_originator(public.storage_project_id_from_path(name))
      or public.is_ceo_or_admin()
      or (
        (string_to_array(name, '/'))[1] = 'inbox'
        and (owner = auth.uid() or public.is_ceo_or_admin())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Notification types
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'ACTIVITY_POST',
    'DECLARATION_SUBMITTED',
    'DECLARATION_APPROVED',
    'DECLARATION_REJECTED',
    'PROJECT_SUBMITTED',
    'PROJECT_APPROVED',
    'PROJECT_REJECTED',
    'NEW_MESSAGE',
    'PROOF_SUBMITTED',
    'TARGET_REACHED',
    'DRAWDOWN_REQUESTED',
    'DRAWDOWN_DECIDED',
    'WITHDRAWAL_REQUESTED',
    'WITHDRAWAL_DECIDED',
    'PROFIT_PROPOSED',
    'DOC_REQUESTED',
    'DOC_FULFILLED'
  ));

-- ---------------------------------------------------------------------------
-- 4. document_requests
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.document_request_status as enum (
    'PENDING',
    'FULFILLED',
    'CANCELLED'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.document_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  assignee_id uuid not null references public.profiles(id),
  doc_kind public.doc_kind not null default 'OVERVIEW',
  title text not null check (char_length(trim(title)) >= 2),
  note text,
  status public.document_request_status not null default 'PENDING',
  fulfilled_doc_id uuid references public.project_docs(id) on delete set null,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_requests_project_idx
  on public.document_requests (project_id, created_at desc);
create index if not exists document_requests_assignee_pending_idx
  on public.document_requests (assignee_id, status)
  where status = 'PENDING';

drop trigger if exists document_requests_set_updated_at on public.document_requests;
create trigger document_requests_set_updated_at
  before update on public.document_requests
  for each row execute function public.set_updated_at();

alter table public.document_requests enable row level security;
grant select, insert, update on public.document_requests to authenticated;

drop policy if exists document_requests_select on public.document_requests;
create policy document_requests_select
  on public.document_requests for select to authenticated
  using (
    public.is_ceo_or_admin()
    or requested_by = auth.uid()
    or assignee_id = auth.uid()
    or public.is_project_owner(project_id)
  );

-- Mutations go through security-definer RPCs only.
drop policy if exists document_requests_insert on public.document_requests;
create policy document_requests_insert
  on public.document_requests for insert to authenticated
  with check (false);

drop policy if exists document_requests_update on public.document_requests;
create policy document_requests_update
  on public.document_requests for update to authenticated
  using (false);

-- ---------------------------------------------------------------------------
-- 5. RPCs
-- ---------------------------------------------------------------------------

create or replace function public.request_project_document(
  p_project_id uuid,
  p_kind public.doc_kind,
  p_title text,
  p_note text default null
)
returns public.document_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_row public.document_requests;
  v_title text := trim(coalesce(p_title, ''));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if char_length(v_title) < 2 then
    raise exception 'Title is required';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.project_owner_id is null then
    raise exception 'Assign a project owner before requesting a document';
  end if;

  if not (
    public.is_ceo_or_admin()
    or v_project.created_by = auth.uid()
  ) then
    raise exception 'Only the Line Manager or CEO can request documents from the owner';
  end if;

  insert into public.document_requests (
    project_id, requested_by, assignee_id, doc_kind, title, note, status
  ) values (
    p_project_id, auth.uid(), v_project.project_owner_id, p_kind, v_title,
    nullif(trim(coalesce(p_note, '')), ''), 'PENDING'
  )
  returning * into v_row;

  perform public.create_notifications(
    array[v_project.project_owner_id],
    'DOC_REQUESTED',
    'Document requested · ' || v_title,
    coalesce(v_project.code || ' · ', '') || coalesce(v_project.name, 'Project')
      || ' — please upload: ' || v_title,
    p_project_id,
    v_row.id,
    '/(tabs)/projects/' || p_project_id || '?tab=documents&request=' || v_row.id
  );

  perform public.log_audit(
    p_project_id,
    'document_request',
    v_row.id,
    'requested',
    jsonb_build_object(
      'title', v_title,
      'doc_kind', p_kind::text,
      'note', v_row.note,
      'assignee_id', v_project.project_owner_id
    ),
    auth.uid()
  );

  return v_row;
end;
$$;

grant execute on function public.request_project_document(uuid, public.doc_kind, text, text) to authenticated;

create or replace function public.fulfill_document_request(
  p_request_id uuid,
  p_doc_id uuid
)
returns public.document_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.document_requests;
  v_doc public.project_docs;
  v_project public.projects;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_req from public.document_requests where id = p_request_id for update;
  if not found then
    raise exception 'Document request not found';
  end if;
  if v_req.status <> 'PENDING' then
    raise exception 'This request is no longer pending';
  end if;
  if v_req.assignee_id is distinct from auth.uid()
     and not public.is_ceo_or_admin() then
    raise exception 'Only the assigned project owner can fulfill this request';
  end if;

  select * into v_doc from public.project_docs where id = p_doc_id;
  if not found then
    raise exception 'Document not found';
  end if;
  if v_doc.project_id is distinct from v_req.project_id then
    raise exception 'Document does not belong to this project';
  end if;

  update public.document_requests
  set status = 'FULFILLED',
      fulfilled_doc_id = p_doc_id,
      fulfilled_at = now()
  where id = p_request_id
  returning * into v_req;

  select * into v_project from public.projects where id = v_req.project_id;

  if v_req.requested_by is not null then
    perform public.create_notifications(
      array[v_req.requested_by],
      'DOC_FULFILLED',
      'Document uploaded · ' || v_req.title,
      coalesce(v_project.code || ' · ', '') || coalesce(v_project.name, 'Project')
        || ' — owner fulfilled: ' || v_req.title,
      v_req.project_id,
      v_req.id,
      '/(tabs)/projects/' || v_req.project_id || '?tab=documents'
    );
  end if;

  perform public.log_audit(
    v_req.project_id,
    'document_request',
    v_req.id,
    'fulfilled',
    jsonb_build_object(
      'title', v_req.title,
      'doc_kind', v_req.doc_kind::text,
      'fulfilled_doc_id', p_doc_id
    ),
    auth.uid()
  );

  return v_req;
end;
$$;

grant execute on function public.fulfill_document_request(uuid, uuid) to authenticated;

create or replace function public.cancel_document_request(p_request_id uuid)
returns public.document_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.document_requests;
  v_project public.projects;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_req from public.document_requests where id = p_request_id for update;
  if not found then
    raise exception 'Document request not found';
  end if;
  if v_req.status <> 'PENDING' then
    raise exception 'Only pending requests can be cancelled';
  end if;

  select * into v_project from public.projects where id = v_req.project_id;
  if not (
    public.is_ceo_or_admin()
    or v_req.requested_by = auth.uid()
    or v_project.created_by = auth.uid()
  ) then
    raise exception 'Not allowed to cancel this request';
  end if;

  update public.document_requests
  set status = 'CANCELLED',
      cancelled_at = now()
  where id = p_request_id
  returning * into v_req;

  perform public.log_audit(
    v_req.project_id,
    'document_request',
    v_req.id,
    'cancelled',
    jsonb_build_object('title', v_req.title, 'doc_kind', v_req.doc_kind::text),
    auth.uid()
  );

  return v_req;
end;
$$;

grant execute on function public.cancel_document_request(uuid) to authenticated;

create or replace function public.list_document_requests(p_project_id uuid)
returns setof public.document_requests
language sql
stable
security definer
set search_path = public
as $$
  select r.*
  from public.document_requests r
  where r.project_id = p_project_id
    and (
      public.is_ceo_or_admin()
      or r.requested_by = auth.uid()
      or r.assignee_id = auth.uid()
      or public.is_project_owner(p_project_id)
    )
  order by r.created_at desc;
$$;

grant execute on function public.list_document_requests(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Audit: every document upload/delete
-- ---------------------------------------------------------------------------

create or replace function public.audit_project_docs_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.project_id,
      'project_doc',
      new.id,
      'uploaded',
      jsonb_build_object(
        'kind', new.kind::text,
        'title', new.title,
        'file_name', new.file_name,
        'amount_minor', new.amount_minor,
        'note', new.note,
        'drawdown_id', new.drawdown_id
      ),
      new.uploaded_by
    );
    return new;
  elsif tg_op = 'DELETE' then
    perform public.log_audit(
      old.project_id,
      'project_doc',
      old.id,
      'deleted',
      jsonb_build_object(
        'kind', old.kind::text,
        'title', old.title,
        'file_name', old.file_name,
        'amount_minor', old.amount_minor
      ),
      auth.uid()
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists audit_project_docs on public.project_docs;
create trigger audit_project_docs
  after insert or delete on public.project_docs
  for each row execute function public.audit_project_docs_trg();

-- ---------------------------------------------------------------------------
-- 7. Audit: activity posts
-- ---------------------------------------------------------------------------

create or replace function public.audit_project_updates_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.project_id,
      'project_update',
      new.id,
      'posted',
      jsonb_build_object(
        'kind', new.kind::text,
        'title', new.title,
        'amount_minor', new.amount_minor
      ),
      new.posted_by
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_project_updates on public.project_updates;
create trigger audit_project_updates
  after insert on public.project_updates
  for each row execute function public.audit_project_updates_trg();

-- ---------------------------------------------------------------------------
-- 8. Audit: richer project field changes (beyond stage/approval)
-- ---------------------------------------------------------------------------

create or replace function public.audit_projects_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_changes jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.id, 'project', new.id, 'created',
      jsonb_build_object('code', new.code, 'name', new.name, 'target_minor', new.target_minor,
        'total_units', new.total_units, 'stage', new.stage),
      new.created_by
    );
  elsif tg_op = 'UPDATE' then
    if new.stage is distinct from old.stage then
      perform public.log_audit(
        new.id, 'project', new.id, 'stage_changed',
        jsonb_build_object('from', old.stage, 'to', new.stage)
      );
    end if;
    if new.approval_status is distinct from old.approval_status then
      perform public.log_audit(
        new.id, 'project', new.id, 'approval_status_changed',
        jsonb_build_object('from', old.approval_status, 'to', new.approval_status)
      );
    end if;
    if new.project_owner_id is distinct from old.project_owner_id then
      perform public.log_audit(
        new.id, 'project', new.id, 'owner_assigned',
        jsonb_build_object('from', old.project_owner_id, 'to', new.project_owner_id)
      );
    end if;
    if new.name is distinct from old.name then
      v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('from', old.name, 'to', new.name));
    end if;
    if new.target_minor is distinct from old.target_minor then
      v_changes := v_changes || jsonb_build_object('target_minor', jsonb_build_object('from', old.target_minor, 'to', new.target_minor));
    end if;
    if new.total_units is distinct from old.total_units then
      v_changes := v_changes || jsonb_build_object('total_units', jsonb_build_object('from', old.total_units, 'to', new.total_units));
    end if;
    if new.summary is distinct from old.summary then
      v_changes := v_changes || jsonb_build_object('summary', true);
    end if;
    if new.full_details is distinct from old.full_details then
      v_changes := v_changes || jsonb_build_object('full_details', true);
    end if;
    if new.risks is distinct from old.risks then
      v_changes := v_changes || jsonb_build_object('risks', true);
    end if;
    if new.timeline is distinct from old.timeline then
      v_changes := v_changes || jsonb_build_object('timeline', true);
    end if;
    if new.drawn_minor is distinct from old.drawn_minor then
      v_changes := v_changes || jsonb_build_object(
        'drawn_minor', jsonb_build_object('from', old.drawn_minor, 'to', new.drawn_minor)
      );
    end if;
    if v_changes <> '{}'::jsonb then
      perform public.log_audit(
        new.id, 'project', new.id, 'updated',
        v_changes
      );
    end if;
  end if;
  return new;
end;
$$;
