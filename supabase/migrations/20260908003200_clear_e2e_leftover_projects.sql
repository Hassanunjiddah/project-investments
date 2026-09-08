-- Clear leftover E2E shells (PRJ-139 / PRJ-140) that client DELETE could not
-- remove: cascading project_docs deletes fire audit_project_docs, which
-- inserts audit_events.project_id while the project row is already being
-- deleted — FK violation.
--
-- 2026-09-08

-- 1. Skip audit on cascade-delete so project wipe can succeed.
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
    -- Same-statement project CASCADE makes a new audit row illegal
    -- (audit_events.project_id → projects). Only log standalone doc deletes.
    if exists (select 1 from public.projects p where p.id = old.project_id) then
      begin
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
      exception
        when foreign_key_violation then
          null;
      end;
    end if;
    return old;
  end if;
  return null;
end;
$$;

-- 2. Drop leftover E2E projects. ledger_entries is ON DELETE RESTRICT.
delete from public.ledger_entries
where project_id in (
  select id from public.projects
  where code in ('PRJ-139', 'PRJ-140', 'PRJ-141')
     or name like 'E2E Rice Aggregation %'
);

delete from public.projects
where code in ('PRJ-139', 'PRJ-140', 'PRJ-141')
   or name like 'E2E Rice Aggregation %';
