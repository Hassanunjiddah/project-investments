-- Email notifications for project updates and approved profit declarations.
-- 2026-07-28
--
-- Wires two Postgres triggers that POST to the `notify-investors` edge function
-- via `pg_net` whenever:
--   1. A row is inserted into public.project_updates
--   2. A row in public.profit_declarations transitions from PENDING → APPROVED
--
-- Config prerequisites (set once per Supabase project):
--   alter database postgres set "app.notify_url"    = 'https://<PROJECT_REF>.supabase.co/functions/v1/notify-investors';
--   alter database postgres set "app.notify_secret" = '<same value as NOTIFY_WEBHOOK_SECRET secret on the edge function>';
--
-- The `net.http_post` call is fire-and-forget; failures are logged in the
-- `net._http_response` table but do not roll back the inserting transaction.
-- This is intentional: an email hiccup must never block a manager from
-- posting an update or a CEO from approving a distribution.

-- pg_net ships with Supabase but is not enabled by default on every project.
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Helper: fire a notification (idempotent per trigger call)
-- ---------------------------------------------------------------------------

create or replace function public.notify_investors_via_edge(
  p_type text,
  p_record_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_url    text := current_setting('app.notify_url',    true);
  v_secret text := current_setting('app.notify_secret', true);
begin
  -- Skip silently if config is not wired — allows migrations to run cleanly
  -- on projects that haven't configured the URL/secret yet.
  if v_url is null or v_url = '' or v_secret is null or v_secret = '' then
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'content-type',     'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := jsonb_build_object(
      'type',     p_type,
      'recordId', p_record_id
    ),
    timeout_milliseconds := 5000
  );
end;
$$;

grant execute on function public.notify_investors_via_edge(text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Trigger 1: on INSERT into project_updates
-- ---------------------------------------------------------------------------

create or replace function public.trg_notify_project_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_investors_via_edge('PROJECT_UPDATE', NEW.id);
  return NEW;
end;
$$;

drop trigger if exists project_updates_notify on public.project_updates;
create trigger project_updates_notify
  after insert on public.project_updates
  for each row execute function public.trg_notify_project_update();

-- ---------------------------------------------------------------------------
-- Trigger 2: on profit_declarations transition PENDING → APPROVED
-- ---------------------------------------------------------------------------

create or replace function public.trg_notify_declaration_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.status is distinct from NEW.status
     and NEW.status = 'APPROVED' then
    perform public.notify_investors_via_edge('DECLARATION_APPROVED', NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists profit_declarations_notify_approved on public.profit_declarations;
create trigger profit_declarations_notify_approved
  after update on public.profit_declarations
  for each row execute function public.trg_notify_declaration_approved();
