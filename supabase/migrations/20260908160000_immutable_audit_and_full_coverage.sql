-- Make the audit trail tamper-proof and complete.
--
-- 1. audit_events survives project deletion (FK becomes ON DELETE SET NULL)
--    and is hard append-only: no client role can UPDATE or DELETE a row.
-- 2. ledger_entries and distribution_notices get the same hard append-only
--    protection (previously RLS-only).
-- 3. Actions that previously left no audit trail now log events:
--    funding rounds (requested/approved/rejected), cost lines
--    (created/updated/deleted), withdrawal requests (requested/approved/
--    rejected/paid), staff sign-in code redemptions, and user creation.

-- ---------------------------------------------------------------------------
-- 1. audit_events: keep history when a project is deleted
-- ---------------------------------------------------------------------------

alter table public.audit_events
  drop constraint if exists audit_events_project_id_fkey;
alter table public.audit_events
  add constraint audit_events_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete set null;

-- Hard append-only. The only permitted UPDATE is the FK SET NULL fired by a
-- project deletion (project_id -> null, every other column untouched).
-- DELETE is reserved for maintenance roles (never PostgREST clients).
create or replace function public.prevent_audit_event_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.project_id is null
       and old.project_id is not null
       and new.id = old.id
       and new.entity_type = old.entity_type
       and new.entity_id is not distinct from old.entity_id
       and new.event_type = old.event_type
       and new.actor_id is not distinct from old.actor_id
       and new.context is not distinct from old.context
       and new.created_at = old.created_at then
      return new; -- referential SET NULL from a project delete
    end if;
    raise exception 'audit_events are immutable';
  end if;

  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return old;
  end if;
  raise exception 'audit_events are append-only';
end;
$$;

drop trigger if exists audit_events_immutable on public.audit_events;
create trigger audit_events_immutable
  before update or delete on public.audit_events
  for each row execute function public.prevent_audit_event_mutation();

revoke update, delete on public.audit_events from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. ledger_entries + distribution_notices: block mutation outright
-- ---------------------------------------------------------------------------

create or replace function public.prevent_append_only_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception '% rows are immutable', tg_table_name;
  end if;
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return old;
  end if;
  raise exception '% rows are append-only', tg_table_name;
end;
$$;

drop trigger if exists ledger_entries_immutable on public.ledger_entries;
create trigger ledger_entries_immutable
  before update or delete on public.ledger_entries
  for each row execute function public.prevent_append_only_mutation();

revoke update on public.ledger_entries from authenticated, anon;

-- Notices cascade-delete with their project (admin wipes); block UPDATE only.
create or replace function public.prevent_notice_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'distribution_notices are immutable';
end;
$$;

drop trigger if exists distribution_notices_immutable on public.distribution_notices;
create trigger distribution_notices_immutable
  before update on public.distribution_notices
  for each row execute function public.prevent_notice_update();

revoke update on public.distribution_notices from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3a. Funding rounds: requested / approved / rejected
-- ---------------------------------------------------------------------------

create or replace function public.audit_funding_rounds_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.project_id,
      'funding_round',
      new.id,
      'requested',
      jsonb_build_object(
        'additional_units', new.additional_units,
        'additional_minor', new.additional_minor,
        'reason', new.reason
      ),
      new.requested_by
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.log_audit(
      new.project_id,
      'funding_round',
      new.id,
      lower(new.status),
      jsonb_build_object(
        'additional_units', new.additional_units,
        'additional_minor', new.additional_minor,
        'decision_note', new.decision_note
      ),
      coalesce(new.decided_by, auth.uid())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_funding_rounds on public.funding_rounds;
create trigger audit_funding_rounds
  after insert or update on public.funding_rounds
  for each row execute function public.audit_funding_rounds_trg();

-- ---------------------------------------------------------------------------
-- 3b. Cost lines: created / updated / deleted
-- ---------------------------------------------------------------------------

create or replace function public.audit_cost_lines_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.project_id,
      'project_cost_line',
      new.id,
      'created',
      jsonb_build_object(
        'description', new.description,
        'class', new.class::text,
        'total_minor', new.total_minor
      ),
      coalesce(auth.uid(), new.created_by)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    perform public.log_audit(
      new.project_id,
      'project_cost_line',
      new.id,
      'updated',
      jsonb_build_object(
        'description', new.description,
        'class', new.class::text,
        'total_minor', new.total_minor
      ),
      auth.uid()
    );
    return new;
  end if;

  -- Skip logging when the whole project is cascade-deleting (parent row gone).
  if exists (select 1 from public.projects p where p.id = old.project_id) then
    perform public.log_audit(
      old.project_id,
      'project_cost_line',
      old.id,
      'deleted',
      jsonb_build_object(
        'description', old.description,
        'class', old.class::text,
        'total_minor', old.total_minor
      ),
      auth.uid()
    );
  end if;
  return old;
end;
$$;

drop trigger if exists audit_cost_lines on public.project_cost_lines;
create trigger audit_cost_lines
  after insert or update or delete on public.project_cost_lines
  for each row execute function public.audit_cost_lines_trg();

-- ---------------------------------------------------------------------------
-- 3c. Withdrawal requests: requested / approved / rejected / paid
-- ---------------------------------------------------------------------------

create or replace function public.audit_withdrawals_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.project_id,
      'withdrawal_request',
      new.id,
      'requested',
      jsonb_build_object('amount_minor', new.amount_minor),
      new.investor_id
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    perform public.log_audit(
      new.project_id,
      'withdrawal_request',
      new.id,
      lower(new.status),
      jsonb_build_object(
        'amount_minor', new.amount_minor,
        'decision_note', new.decision_note,
        'reference', new.reference
      ),
      coalesce(new.decided_by, auth.uid())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_withdrawals on public.withdrawal_requests;
create trigger audit_withdrawals
  after insert or update on public.withdrawal_requests
  for each row execute function public.audit_withdrawals_trg();

-- ---------------------------------------------------------------------------
-- 3d. Auth lifecycle: staff sign-in code redemptions and new users
-- ---------------------------------------------------------------------------

create or replace function public.audit_signin_redemption_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.redeemed_at is not null and old.redeemed_at is null then
    perform public.log_audit(
      null,
      'auth',
      new.user_id,
      'signin_code_redeemed',
      '{}'::jsonb,
      new.user_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_signin_redemption on public.staff_signin_codes;
create trigger audit_signin_redemption
  after update on public.staff_signin_codes
  for each row execute function public.audit_signin_redemption_trg();

create or replace function public.audit_profile_created_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_audit(
    null,
    'profile',
    new.id,
    'user_created',
    jsonb_build_object('role', new.role::text),
    new.id
  );
  return new;
end;
$$;

drop trigger if exists audit_profile_created on public.profiles;
create trigger audit_profile_created
  after insert on public.profiles
  for each row execute function public.audit_profile_created_trg();
