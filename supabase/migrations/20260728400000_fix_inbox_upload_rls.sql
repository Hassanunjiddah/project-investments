-- Fix: uploads to `inbox/` prefix on the `project-documents` bucket fail with
--   "invalid input syntax for type uuid: 'inbox'"
-- because RLS calls `storage_project_id_from_path(name)` which casts the first
-- path segment straight to UUID. When the prefix is `inbox/…` (used by the
-- Create-Project wizard to stash a brief before the project row exists), the
-- cast raises.
--
-- 2026-07-28

-- ---------------------------------------------------------------------------
-- 1. NULL-safe path parser
-- ---------------------------------------------------------------------------
create or replace function public.storage_project_id_from_path(path text)
returns uuid
language sql
immutable
as $$
  select case
    when (string_to_array(path, '/'))[1]
         ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((string_to_array(path, '/'))[1])::uuid
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Refresh project-documents policies to accept the `inbox/` prefix.
--    INSERT/SELECT/UPDATE/DELETE are all allowed for the uploader (owner)
--    plus CEO/Admin. LMs can upload; only the uploader or a CEO can read /
--    move / delete their own inbox file.
-- ---------------------------------------------------------------------------

drop policy if exists project_documents_insert on storage.objects;
create policy project_documents_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-documents'
    and (
      public.is_project_owner(public.storage_project_id_from_path(name))
      or public.is_ceo_or_admin()
      or (
        (string_to_array(name, '/'))[1] = 'inbox'
        and public.current_user_role() in ('LINE_MANAGER', 'CEO', 'ADMIN')
      )
    )
  );

drop policy if exists project_documents_select on storage.objects;
create policy project_documents_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-documents'
    and (
      public.is_project_doc_reader(public.storage_project_id_from_path(name))
      or (
        (string_to_array(name, '/'))[1] = 'inbox'
        and (owner = auth.uid() or public.is_ceo_or_admin())
      )
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
      or (
        (string_to_array(name, '/'))[1] = 'inbox'
        and (owner = auth.uid() or public.is_ceo_or_admin())
      )
    )
  );

-- Supabase Storage `move()` performs an UPDATE on the object row. Without
-- this policy the `attachStorageDocument` flow (inbox/ → <projectId>/) fails
-- silently.
drop policy if exists project_documents_update on storage.objects;
create policy project_documents_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'project-documents'
    and (
      public.is_project_owner(public.storage_project_id_from_path(name))
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
      or public.is_ceo_or_admin()
      or (
        (string_to_array(name, '/'))[1] = 'inbox'
        and (owner = auth.uid() or public.is_ceo_or_admin())
      )
    )
  );
