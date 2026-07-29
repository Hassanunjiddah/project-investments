-- ---------------------------------------------------------------------------
-- Notifications center — persisted in-app notifications + email fan-out for
-- every collaboration event:
--   * project activity posts        → confirmed investors
--   * profit declaration submitted  → CEO / ADMIN (approvers)
--   * profit declaration approved   → confirmed investors + declaring LM
--   * profit declaration rejected   → declaring LM
--   * project submitted for approval→ CEO / ADMIN
--   * project approved / rejected   → project owner (LM)
--   * new chat message              → the other thread participant
--
-- In-app rows land in public.notifications (RLS: owner-only). Emails reuse the
-- existing pg_net → notify-investors edge webhook (fire-and-forget, never
-- blocks the writing transaction). New edge payload types introduced here:
--   DECLARATION_SUBMITTED | DECLARATION_REJECTED | PROJECT_SUBMITTED |
--   PROJECT_DECIDED | NEW_MESSAGE
--
-- 2026-07-29
-- ---------------------------------------------------------------------------

-- 1. Table -------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'ACTIVITY_POST',
    'DECLARATION_SUBMITTED',
    'DECLARATION_APPROVED',
    'DECLARATION_REJECTED',
    'PROJECT_SUBMITTED',
    'PROJECT_APPROVED',
    'PROJECT_REJECTED',
    'NEW_MESSAGE'
  )),
  title text not null,
  body text,
  project_id uuid references public.projects(id) on delete cascade,
  entity_id uuid,
  href text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- Owner may only stamp read_at (no INSERT policy: rows are created by the
-- SECURITY DEFINER trigger functions below).
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2. Helpers -----------------------------------------------------------------

create or replace function public.create_notifications(
  p_user_ids uuid[],
  p_type text,
  p_title text,
  p_body text,
  p_project_id uuid default null,
  p_entity_id uuid default null,
  p_href text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, project_id, entity_id, href)
  select distinct u, p_type, p_title, p_body, p_project_id, p_entity_id, p_href
  from unnest(coalesce(p_user_ids, '{}'::uuid[])) as u
  where u is not null;
$$;

create or replace function public.confirmed_investor_ids(p_project_id uuid)
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(distinct investor_id), '{}'::uuid[])
  from public.invites
  where project_id = p_project_id
    and status = 'CONFIRMED'
    and investor_id is not null;
$$;

create or replace function public.ceo_admin_ids()
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(id), '{}'::uuid[])
  from public.profiles
  where role in ('CEO', 'ADMIN');
$$;

-- 3. Project activity posts → confirmed investors (in-app; email trigger for
--    PROJECT_UPDATE already exists in 20260728300000_email_notifications.sql)

create or replace function public.trg_inapp_project_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_name text;
begin
  select name into v_project_name from public.projects where id = NEW.project_id;
  perform public.create_notifications(
    public.confirmed_investor_ids(NEW.project_id),
    'ACTIVITY_POST',
    'New update on ' || coalesce(v_project_name, 'your project'),
    NEW.title,
    NEW.project_id,
    NEW.id,
    '/(tabs)/projects/' || NEW.project_id
  );
  return NEW;
end;
$$;

drop trigger if exists project_updates_inapp on public.project_updates;
create trigger project_updates_inapp
  after insert on public.project_updates
  for each row execute function public.trg_inapp_project_update();

-- 4. Profit declaration submitted → CEO/ADMIN (in-app + email) ---------------

create or replace function public.trg_notify_declaration_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_name text;
begin
  if NEW.status <> 'PENDING' then
    return NEW;
  end if;
  select name into v_project_name from public.projects where id = NEW.project_id;
  perform public.create_notifications(
    public.ceo_admin_ids(),
    'DECLARATION_SUBMITTED',
    'Profit declaration awaits approval',
    coalesce(v_project_name, 'Project') || ' · ' || coalesce(NEW.label, NEW.reference, 'declaration'),
    NEW.project_id,
    NEW.id,
    '/(tabs)/projects/' || NEW.project_id
  );
  perform public.notify_investors_via_edge('DECLARATION_SUBMITTED', NEW.id);
  return NEW;
end;
$$;

drop trigger if exists profit_declarations_notify_submitted on public.profit_declarations;
create trigger profit_declarations_notify_submitted
  after insert on public.profit_declarations
  for each row execute function public.trg_notify_declaration_submitted();

-- 5. Profit declaration decided → investors + declaring LM (in-app; email for
--    APPROVED already exists, add REJECTED email) ----------------------------

create or replace function public.trg_inapp_declaration_decided()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_name text;
  v_label text;
begin
  if OLD.status is not distinct from NEW.status then
    return NEW;
  end if;
  select name into v_project_name from public.projects where id = NEW.project_id;
  v_label := coalesce(NEW.label, NEW.reference, 'declaration');

  if NEW.status = 'APPROVED' then
    perform public.create_notifications(
      public.confirmed_investor_ids(NEW.project_id),
      'DECLARATION_APPROVED',
      'Distribution approved · ' || coalesce(v_project_name, 'your project'),
      v_label || ' has been approved and posted to the ledger.',
      NEW.project_id,
      NEW.id,
      '/(tabs)/projects/' || NEW.project_id
    );
    perform public.create_notifications(
      array[NEW.declared_by],
      'DECLARATION_APPROVED',
      'Your profit declaration was approved',
      coalesce(v_project_name, 'Project') || ' · ' || v_label,
      NEW.project_id,
      NEW.id,
      '/(tabs)/projects/' || NEW.project_id
    );
  elsif NEW.status = 'REJECTED' then
    perform public.create_notifications(
      array[NEW.declared_by],
      'DECLARATION_REJECTED',
      'Your profit declaration was rejected',
      coalesce(v_project_name, 'Project') || ' · ' || v_label
        || coalesce(' — ' || NEW.rejection_note, ''),
      NEW.project_id,
      NEW.id,
      '/(tabs)/projects/' || NEW.project_id
    );
    perform public.notify_investors_via_edge('DECLARATION_REJECTED', NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists profit_declarations_inapp_decided on public.profit_declarations;
create trigger profit_declarations_inapp_decided
  after update on public.profit_declarations
  for each row execute function public.trg_inapp_declaration_decided();

-- 6. Project submitted / decided ----------------------------------------------

create or replace function public.trg_notify_project_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.approval_status = 'PENDING' then
    perform public.create_notifications(
      public.ceo_admin_ids(),
      'PROJECT_SUBMITTED',
      'Project awaits approval',
      coalesce(NEW.code || ' · ', '') || NEW.name,
      NEW.id,
      NEW.id,
      '/(tabs)/projects/' || NEW.id
    );
    perform public.notify_investors_via_edge('PROJECT_SUBMITTED', NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists projects_notify_submitted on public.projects;
create trigger projects_notify_submitted
  after insert on public.projects
  for each row execute function public.trg_notify_project_submitted();

create or replace function public.trg_notify_project_decided()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.approval_status is not distinct from NEW.approval_status then
    return NEW;
  end if;

  if NEW.approval_status = 'PENDING' then
    -- Resubmission after edits — approvers need to look again.
    perform public.create_notifications(
      public.ceo_admin_ids(),
      'PROJECT_SUBMITTED',
      'Project resubmitted for approval',
      coalesce(NEW.code || ' · ', '') || NEW.name,
      NEW.id,
      NEW.id,
      '/(tabs)/projects/' || NEW.id
    );
    perform public.notify_investors_via_edge('PROJECT_SUBMITTED', NEW.id);
  elsif NEW.approval_status in ('APPROVED', 'REJECTED') and NEW.created_by is not null then
    perform public.create_notifications(
      array[NEW.created_by],
      case when NEW.approval_status = 'APPROVED' then 'PROJECT_APPROVED' else 'PROJECT_REJECTED' end,
      case when NEW.approval_status = 'APPROVED'
        then 'Your project was approved'
        else 'Your project was rejected'
      end,
      coalesce(NEW.code || ' · ', '') || NEW.name,
      NEW.id,
      NEW.id,
      '/(tabs)/projects/' || NEW.id
    );
    perform public.notify_investors_via_edge('PROJECT_DECIDED', NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists projects_notify_decided on public.projects;
create trigger projects_notify_decided
  after update on public.projects
  for each row execute function public.trg_notify_project_decided();

-- 7. New chat message → counterparty (in-app + email) -------------------------

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
  elsif NEW.sender_id = v_thread.manager_id then
    v_recipients := array[v_thread.investor_id];
  else
    -- CEO/ADMIN posting into a thread — alert both participants.
    v_recipients := array[v_thread.investor_id, v_thread.manager_id];
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

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify
  after insert on public.messages
  for each row execute function public.trg_notify_new_message();
