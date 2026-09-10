-- ---------------------------------------------------------------------------
-- Next-step task prompts, batch 2:
--
-- 1. Owner proposes profit → OPEN task "Forward profit proposal" for the LM,
--    auto-completed when the proposal leaves the PROPOSED state (forwarded to
--    CEO or withdrawn). Implemented as triggers on profit_declarations so all
--    entry points (propose_profit_to_lm and any future path) are covered.
--
-- 2. INFORM_OWNER_TARGET_REACHED previously never completed. It now
--    auto-completes when the LM sends a message in the owner–LM thread
--    (identified by message_threads.owner_id set + investor_id null).
-- ---------------------------------------------------------------------------

-- 1a. Proposal created → LM task ---------------------------------------------

create or replace function public.sync_forward_profit_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'PROPOSED'
       and not exists (
         select 1 from public.tasks
         where project_id = new.project_id
           and kind = 'FORWARD_PROFIT_PROPOSAL'
           and status = 'OPEN'
       ) then
      insert into public.tasks (kind, title, project_id, assignee_role, status)
      values (
        'FORWARD_PROFIT_PROPOSAL',
        'Forward profit proposal: ' || coalesce(new.reference, 'declaration'),
        new.project_id,
        'LINE_MANAGER',
        'OPEN'
      );
    end if;
    return new;
  end if;

  -- Proposal left PROPOSED (forwarded to CEO or withdrawn). Close the task
  -- only when no other proposal on the project is still waiting.
  if old.status = 'PROPOSED'
     and new.status <> 'PROPOSED'
     and not exists (
       select 1 from public.profit_declarations d
       where d.project_id = new.project_id
         and d.status = 'PROPOSED'
         and d.id <> new.id
     ) then
    update public.tasks
    set status = 'COMPLETED',
        completed_at = now(),
        completed_by = auth.uid()
    where project_id = new.project_id
      and kind = 'FORWARD_PROFIT_PROPOSAL'
      and status = 'OPEN';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_forward_profit_task_trg on public.profit_declarations;
create trigger sync_forward_profit_task_trg
  after insert or update of status on public.profit_declarations
  for each row execute function public.sync_forward_profit_task();

-- 2. LM messages the owner → inform-owner task done ---------------------------

create or replace function public.complete_inform_owner_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread record;
begin
  select project_id, investor_id, owner_id, manager_id
  into v_thread
  from public.message_threads
  where id = new.thread_id;

  -- Only owner–LM threads, and only when the LM is the one reaching out.
  if v_thread.owner_id is null
     or v_thread.investor_id is not null
     or new.sender_id <> v_thread.manager_id then
    return new;
  end if;

  update public.tasks
  set status = 'COMPLETED',
      completed_at = now(),
      completed_by = new.sender_id
  where project_id = v_thread.project_id
    and kind = 'INFORM_OWNER_TARGET_REACHED'
    and status = 'OPEN';

  return new;
end;
$$;

drop trigger if exists complete_inform_owner_task_trg on public.messages;
create trigger complete_inform_owner_task_trg
  after insert on public.messages
  for each row execute function public.complete_inform_owner_task();
