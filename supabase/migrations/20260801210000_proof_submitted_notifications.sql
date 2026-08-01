-- ---------------------------------------------------------------------------
-- Notify Line Managers when an investor submits payment proof, and fix
-- investor deep-links on activity / declaration notifications to use the
-- portfolio stack (investors cannot see /(tabs)/projects).
-- 2026-08-01
-- ---------------------------------------------------------------------------

-- 1. Allow PROOF_SUBMITTED on notifications.type ------------------------------

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
    'PROOF_SUBMITTED'
  ));

-- 2. Persist a notification for the project owner when proof lands ------------

create or replace function public.trg_inapp_proof_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_project_name text;
  v_investor_label text;
begin
  if NEW.status is not distinct from OLD.status then
    return NEW;
  end if;
  if NEW.status <> 'PROOF_SUBMITTED' then
    return NEW;
  end if;

  select p.created_by, p.name
    into v_owner, v_project_name
  from public.projects p
  where p.id = NEW.project_id;

  if v_owner is null then
    return NEW;
  end if;

  v_investor_label := coalesce(NEW.email, 'Investor');

  perform public.create_notifications(
    array[v_owner],
    'PROOF_SUBMITTED',
    'Payment proof submitted',
    v_investor_label || ' · ' || coalesce(v_project_name, 'Project') || ' awaits confirmation.',
    NEW.project_id,
    NEW.id,
    '/(tabs)/projects/' || NEW.project_id || '?tab=investors&invite=' || NEW.id::text
  );

  return NEW;
end;
$$;

drop trigger if exists invites_inapp_proof_submitted on public.invites;
create trigger invites_inapp_proof_submitted
  after update of status on public.invites
  for each row execute function public.trg_inapp_proof_submitted();

-- 3. Investor-facing activity / declaration hrefs → portfolio stack -----------

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
    '/(tabs)/portfolio/projects/' || NEW.project_id
  );
  return NEW;
end;
$$;

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
      '/(tabs)/portfolio/projects/' || NEW.project_id
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

-- 4. Realtime so the client can invalidate the feed immediately ---------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'tasks'
  ) then
    execute 'alter publication supabase_realtime add table public.tasks';
  end if;
end $$;
