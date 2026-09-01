-- CEO/ADMIN oversight on project message threads.
-- RLS already allows CEO/ADMIN to SELECT all threads/messages.
-- restore send_message + mark_thread_read for CEO/ADMIN (dropped in lm_mediation).

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
  v_is_ceo  boolean;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'message body required';
  end if;

  if char_length(p_body) > 4000 then
    raise exception 'message too long (max 4000 chars)';
  end if;

  select * into v_thread from public.message_threads where id = p_thread_id;
  if not found then
    raise exception 'thread not found';
  end if;

  v_is_ceo := public.is_ceo_or_admin();

  if v_actor <> v_thread.manager_id
     and v_actor is distinct from v_thread.investor_id
     and v_actor is distinct from v_thread.owner_id
     and not v_is_ceo then
    raise exception 'not a participant';
  end if;

  v_preview := left(trim(p_body), 140);

  insert into public.messages (thread_id, sender_id, body)
  values (p_thread_id, v_actor, trim(p_body))
  returning id into v_msg_id;

  if v_is_ceo
     and v_actor is distinct from v_thread.manager_id
     and v_actor is distinct from v_thread.investor_id
     and v_actor is distinct from v_thread.owner_id then
    -- Oversight post: bump unread for LM and the counterparty.
    update public.message_threads
    set
      last_message_at = now(),
      last_message_preview = v_preview,
      last_sender_id = v_actor,
      investor_unread_count = case
        when v_thread.investor_id is not null or v_thread.owner_id is not null
          then investor_unread_count + 1
        else investor_unread_count
      end,
      manager_unread_count = manager_unread_count + 1
    where id = p_thread_id;
  else
    update public.message_threads
    set
      last_message_at = now(),
      last_message_preview = v_preview,
      last_sender_id = v_actor,
      investor_unread_count = case
        when v_actor = v_thread.manager_id
             and (v_thread.investor_id is not null or v_thread.owner_id is not null)
          then investor_unread_count + 1
        else investor_unread_count
      end,
      manager_unread_count = case
        when v_actor is distinct from v_thread.manager_id
          then manager_unread_count + 1
        else manager_unread_count
      end
    where id = p_thread_id;
  end if;

  return v_msg_id;
end;
$$;

revoke all on function public.send_message(uuid, text) from public;
grant execute on function public.send_message(uuid, text) to authenticated;

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

  -- CEO/ADMIN oversight: no unread counters of their own — succeed as no-op.
  if public.is_ceo_or_admin()
     and v_actor is distinct from v_thread.manager_id
     and v_actor is distinct from v_thread.investor_id
     and v_actor is distinct from v_thread.owner_id then
    return jsonb_build_object('ok', true, 'oversight', true);
  end if;

  if v_actor = v_thread.investor_id or v_actor = v_thread.owner_id then
    update public.message_threads set investor_unread_count = 0 where id = p_thread_id;
  elsif v_actor = v_thread.manager_id then
    update public.message_threads set manager_unread_count = 0 where id = p_thread_id;
  end if;

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
