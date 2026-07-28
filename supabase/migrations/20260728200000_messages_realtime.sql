-- ---------------------------------------------------------------------------
-- Messages — per-project Investor ↔ Line Manager threads (realtime)
--
-- Tables
--   * message_threads  — one row per (project, investor, manager) triple
--   * messages         — individual chat messages in a thread
--
-- RPCs (all SECURITY DEFINER, guarded per-user):
--   * ensure_message_thread(p_project_id, p_investor_id) → uuid
--   * send_message(p_thread_id, p_body)                  → uuid
--   * mark_thread_read(p_thread_id)                      → jsonb {ok}
--
-- Realtime: `messages` added to the supabase_realtime publication so the
-- client hook can subscribe to INSERTs scoped to a given thread.
-- ---------------------------------------------------------------------------

-- 1. Tables ------------------------------------------------------------------

create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  investor_id uuid not null references public.profiles(id) on delete cascade,
  manager_id uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz,
  last_message_preview text,
  last_sender_id uuid references public.profiles(id),
  investor_unread_count int not null default 0 check (investor_unread_count >= 0),
  manager_unread_count int not null default 0 check (manager_unread_count >= 0),
  created_at timestamptz not null default now(),
  unique (project_id, investor_id, manager_id)
);

create index if not exists idx_message_threads_investor
  on public.message_threads (investor_id, last_message_at desc);
create index if not exists idx_message_threads_manager
  on public.message_threads (manager_id, last_message_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_messages_thread_created
  on public.messages (thread_id, created_at asc);

-- 2. Row Level Security ------------------------------------------------------

alter table public.message_threads enable row level security;
alter table public.messages       enable row level security;

drop policy if exists "message_threads: participants read"    on public.message_threads;
drop policy if exists "messages: participants read"           on public.messages;
drop policy if exists "messages: participants insert"         on public.messages;

-- Threads: investor or manager party can see their own; CEO/ADMIN see all.
create policy "message_threads: participants read"
  on public.message_threads for select
  using (
    auth.uid() = investor_id
    or auth.uid() = manager_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('CEO','ADMIN')
    )
  );

-- Messages: only participants of the thread (or CEO/ADMIN) can read.
create policy "messages: participants read"
  on public.messages for select
  using (
    exists (
      select 1 from public.message_threads t
      where t.id = messages.thread_id
        and (
          auth.uid() = t.investor_id
          or auth.uid() = t.manager_id
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('CEO','ADMIN')
          )
        )
    )
  );

-- Direct INSERT is blocked at the policy layer; use send_message RPC.
create policy "messages: participants insert"
  on public.messages for insert
  with check (false);

-- 3. RPC: ensure_message_thread ----------------------------------------------
-- Creates the thread row for a (project, investor) pair if it doesn't exist
-- yet. Callable by the investor themselves or the project's line manager.

create or replace function public.ensure_message_thread(
  p_project_id uuid,
  p_investor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor    uuid;
  v_role     text;
  v_manager  uuid;
  v_thread   uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  select created_by into v_manager from public.projects where id = p_project_id;
  if v_manager is null then
    raise exception 'project not found';
  end if;

  select role into v_role from public.profiles where id = v_actor;

  -- Only the investor themselves or the project manager (or CEO/ADMIN) may
  -- bootstrap the thread. Prevents random users from opening threads.
  if not (
    v_actor = p_investor_id
    or v_actor = v_manager
    or v_role in ('CEO','ADMIN')
  ) then
    raise exception 'not authorised to open thread';
  end if;

  select id into v_thread
  from public.message_threads
  where project_id = p_project_id
    and investor_id = p_investor_id
    and manager_id = v_manager;

  if v_thread is null then
    insert into public.message_threads (project_id, investor_id, manager_id)
    values (p_project_id, p_investor_id, v_manager)
    returning id into v_thread;
  end if;

  return v_thread;
end;
$$;

revoke all on function public.ensure_message_thread(uuid, uuid) from public;
grant execute on function public.ensure_message_thread(uuid, uuid) to authenticated;

-- 4. RPC: send_message -------------------------------------------------------

create or replace function public.send_message(
  p_thread_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   uuid;
  v_thread  public.message_threads;
  v_msg_id  uuid;
  v_preview text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  if p_body is null or char_length(trim(p_body)) = 0 then
    raise exception 'message body required';
  end if;
  if char_length(p_body) > 4000 then
    raise exception 'message too long (max 4000 chars)';
  end if;

  select * into v_thread from public.message_threads where id = p_thread_id;
  if not found then
    raise exception 'thread not found';
  end if;

  -- Only thread participants (or CEO/ADMIN) may post.
  if not (
    v_actor = v_thread.investor_id
    or v_actor = v_thread.manager_id
    or exists (
      select 1 from public.profiles p
      where p.id = v_actor and p.role in ('CEO','ADMIN')
    )
  ) then
    raise exception 'not authorised to post in this thread';
  end if;

  insert into public.messages (thread_id, sender_id, body)
  values (p_thread_id, v_actor, trim(p_body))
  returning id into v_msg_id;

  v_preview := substring(trim(p_body) from 1 for 140);

  -- Bump the thread preview + the OTHER party's unread counter.
  update public.message_threads
  set last_message_at = now(),
      last_message_preview = v_preview,
      last_sender_id = v_actor,
      investor_unread_count = case
        when v_actor = investor_id then investor_unread_count
        else investor_unread_count + 1
      end,
      manager_unread_count = case
        when v_actor = manager_id then manager_unread_count
        else manager_unread_count + 1
      end
  where id = p_thread_id;

  return v_msg_id;
end;
$$;

revoke all on function public.send_message(uuid, text) from public;
grant execute on function public.send_message(uuid, text) to authenticated;

-- 5. RPC: mark_thread_read ---------------------------------------------------

create or replace function public.mark_thread_read(p_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  uuid;
  v_thread public.message_threads;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  select * into v_thread from public.message_threads where id = p_thread_id;
  if not found then
    raise exception 'thread not found';
  end if;

  if v_actor = v_thread.investor_id then
    update public.message_threads set investor_unread_count = 0 where id = p_thread_id;
  elsif v_actor = v_thread.manager_id then
    update public.message_threads set manager_unread_count = 0 where id = p_thread_id;
  end if;

  -- Stamp read_at on any un-read messages the actor did not send.
  update public.messages
  set read_at = now()
  where thread_id = p_thread_id
    and sender_id <> v_actor
    and read_at is null;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.mark_thread_read(uuid) from public;
grant execute on function public.mark_thread_read(uuid) to authenticated;

-- 6. Realtime publication ----------------------------------------------------
-- Enables the client `useMessagesRealtime(threadId)` hook to subscribe to
-- INSERT events. Ignored silently on databases where the publication has
-- already added the table.

do $$
begin
  perform 1 from pg_publication_tables
   where pubname = 'supabase_realtime' and tablename = 'messages';
  if not found then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end;
$$;

do $$
begin
  perform 1 from pg_publication_tables
   where pubname = 'supabase_realtime' and tablename = 'message_threads';
  if not found then
    execute 'alter publication supabase_realtime add table public.message_threads';
  end if;
end;
$$;
