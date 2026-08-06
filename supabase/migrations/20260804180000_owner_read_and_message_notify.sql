-- Originator (PROJECT_OWNER) read access + owner↔LM message notifications
-- 2026-08-04

-- 1. Doc/activity reader: include assigned project_owner_id --------------------

create or replace function public.is_project_doc_reader(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_ceo_or_admin()
    or public.is_project_owner(p_project_id) -- legacy: LM created_by
    or exists (
      select 1 from public.projects p
      where p.id = p_project_id
        and p.project_owner_id = auth.uid()
    )
    or exists (
      select 1 from public.invites i
      where i.project_id = p_project_id
        and i.investor_id = auth.uid()
        and i.status in ('ACCEPTED', 'COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED')
    );
$$;

-- 2. Profit declarations: originator can read their project's declarations ----

drop policy if exists profit_declarations_read on public.profit_declarations;
create policy profit_declarations_read on public.profit_declarations
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (
          p.created_by = auth.uid()
          or p.project_owner_id = auth.uid()
          or public.is_ceo_or_admin()
        )
    )
    or exists (
      select 1 from public.invites i
      where i.project_id = profit_declarations.project_id
        and i.investor_id = auth.uid()
        and i.status = 'CONFIRMED'
    )
  );

-- 3. NEW_MESSAGE: notify owner_id on owner↔LM threads ----------------------

create or replace function public.trg_notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.message_threads;
  v_sender_name text;
  v_project_name text;
  v_recipients uuid[];
begin
  select * into v_thread from public.message_threads where id = NEW.thread_id;
  if not found then
    return NEW;
  end if;

  if NEW.sender_id = v_thread.investor_id then
    v_recipients := array[v_thread.manager_id];
  elsif NEW.sender_id = v_thread.owner_id then
    v_recipients := array[v_thread.manager_id];
  elsif NEW.sender_id = v_thread.manager_id then
    v_recipients := array_remove(
      array[v_thread.investor_id, v_thread.owner_id],
      null
    );
  else
    -- CEO/ADMIN posting into a thread — alert all counterparties + LM
    v_recipients := array_remove(
      array[v_thread.investor_id, v_thread.owner_id, v_thread.manager_id],
      null
    );
    v_recipients := array_remove(v_recipients, NEW.sender_id);
  end if;

  select full_name into v_sender_name from public.profiles where id = NEW.sender_id;
  select name into v_project_name from public.projects where id = v_thread.project_id;

  perform public.create_notifications(
    v_recipients,
    'NEW_MESSAGE',
    'New message from ' || coalesce(v_sender_name, 'a participant'),
    coalesce(v_project_name || ' · ', '') || substring(NEW.body from 1 for 140),
    v_thread.project_id,
    NEW.thread_id,
    '/(tabs)/messages/' || NEW.thread_id
  );
  perform public.notify_investors_via_edge('NEW_MESSAGE', NEW.id);
  return NEW;
end;
$$;
