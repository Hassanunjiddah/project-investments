-- ---------------------------------------------------------------------------
-- LM mediation model
--   * Target reached → LM is tasked to notify owner; owner gets mediated notice
--   * Owner proposes profit to LM; LM forwards to CEO pipeline (investors see
--     only after CEO approval — LM is the publisher into that path)
--   * Messaging: investor↔LM and owner↔LM only (no owner↔investor)
-- 2026-08-04
-- ---------------------------------------------------------------------------

-- 1. Notification types ------------------------------------------------------

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
    'PROOF_SUBMITTED',
    'TARGET_REACHED',
    'DRAWDOWN_REQUESTED',
    'DRAWDOWN_DECIDED',
    'WITHDRAWAL_REQUESTED',
    'WITHDRAWAL_DECIDED',
    'PROFIT_PROPOSED'
  ));

alter type public.task_kind add value if not exists 'INFORM_OWNER_TARGET_REACHED';

-- 2. Target reached: LM mediates --------------------------------------------

create or replace function public.check_project_progress_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raised_minor >= new.target_minor
     and new.stage = 'ACCEPTANCE'
     and new.approval_status = 'APPROVED' then
    new.stage := 'PROGRESS';
    new.progress_started_at := coalesce(new.progress_started_at, now());

    -- Prism LM: action to inform the project owner
    if new.created_by is not null then
      perform public.create_notifications(
        array[new.created_by],
        'TARGET_REACHED',
        'Target reached — inform project owner',
        coalesce(new.code || ' · ', '') || coalesce(new.name, 'Project')
          || ' hit its raise target. Notify the project owner and proceed to Progress ops.',
        new.id,
        new.id,
        '/(tabs)/projects/' || new.id || '?tab=overview'
      );

      insert into public.tasks (kind, title, project_id, assignee_role, status)
      values (
        'INFORM_OWNER_TARGET_REACHED',
        'Inform project owner: target reached on ' || coalesce(new.code, 'project'),
        new.id,
        'LINE_MANAGER',
        'OPEN'
      );
    end if;

    -- Owner: mediated notice (comes from Prism process, not a direct investor channel)
    if new.project_owner_id is not null then
      perform public.create_notifications(
        array[new.project_owner_id],
        'TARGET_REACHED',
        'Fundraising target reached',
        coalesce(new.name, 'Your project')
          || ' has reached its target. Your Prism Line Manager will confirm next steps — message them for drawdowns and ops.',
        new.id,
        new.id,
        '/(tabs)/projects/' || new.id
      );
    end if;
  end if;
  return new;
end;
$$;

-- 3. Profit: owner proposes to LM; LM forwards into CEO/investor path --------

alter table public.profit_declarations drop constraint if exists profit_declarations_status_check;
alter table public.profit_declarations
  add constraint profit_declarations_status_check
  check (status in ('PROPOSED', 'PENDING', 'APPROVED', 'REJECTED'));

-- Owner → LM only
create or replace function public.propose_profit_to_lm(
  p_project_id uuid,
  p_gross_minor bigint,
  p_costs_minor bigint default 0,
  p_label text default null,
  p_is_final boolean default false
)
returns public.profit_declarations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_net bigint;
  v_prism bigint;
  v_distributable bigint;
  v_pool bigint;
  v_manager bigint;
  v_per_unit bigint;
  v_seq int;
  v_reference text;
  v_row public.profit_declarations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_project from public.projects where id = p_project_id for share;
  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.project_owner_id is distinct from auth.uid() then
    raise exception 'Only the project owner can propose profit to Prism';
  end if;

  if not coalesce(p_is_final, false) and v_project.stage <> 'PROGRESS' then
    raise exception 'Profit can only be proposed while the project is in Progress';
  end if;
  if v_project.total_units is null or v_project.total_units <= 0 then
    raise exception 'Project is not configured for unit-based profit distribution';
  end if;
  if p_gross_minor is null or p_gross_minor < 0 then
    raise exception 'Gross amount must be zero or positive';
  end if;
  if p_costs_minor is null or p_costs_minor < 0 then
    raise exception 'Costs must be zero or positive';
  end if;
  if p_costs_minor > p_gross_minor then
    raise exception 'Costs cannot exceed gross';
  end if;

  v_net := p_gross_minor - p_costs_minor;
  v_prism := floor(v_net::numeric * coalesce(v_project.platform_fee_bps, 750) / 10000.0)::bigint;
  v_distributable := v_net - v_prism;
  v_pool := floor(v_distributable::numeric * v_project.profit_split_investor_bps / 10000.0)::bigint;
  v_manager := v_distributable - v_pool;
  v_per_unit := floor(v_pool::numeric / v_project.total_units)::bigint;

  select coalesce(max(seq), 0) + 1 into v_seq
  from (
    select cast(regexp_replace(reference, '^.*-DECL(\d+)$', '\1') as int) as seq
    from public.profit_declarations
    where project_id = p_project_id
      and reference ~ '-DECL\d+$'
  ) t;
  v_reference := format('PRSM-%s-DECL%s', v_project.code, lpad(v_seq::text, 3, '0'));

  insert into public.profit_declarations (
    project_id, reference, label, is_final,
    gross_amount_minor, costs_minor, net_amount_minor,
    platform_fee_bps, platform_fee_minor,
    distributable_minor,
    profit_split_investor_bps, investor_pool_minor, manager_share_minor,
    total_units_at_declaration, per_unit_minor,
    status, declared_by
  )
  values (
    p_project_id, v_reference, coalesce(p_label, ''), coalesce(p_is_final, false),
    p_gross_minor, p_costs_minor, v_net,
    coalesce(v_project.platform_fee_bps, 750), v_prism,
    v_distributable,
    v_project.profit_split_investor_bps, v_pool, v_manager,
    v_project.total_units, v_per_unit,
    'PROPOSED', auth.uid()
  )
  returning * into v_row;

  if v_project.created_by is not null then
    perform public.create_notifications(
      array[v_project.created_by],
      'PROFIT_PROPOSED',
      'Owner proposed profit · ' || v_reference,
      coalesce(v_project.name, 'Project')
        || ' — review and declare to investors (via CEO approval).',
      p_project_id,
      v_row.id,
      '/(tabs)/projects/' || p_project_id || '?tab=profits'
    );
  end if;

  return v_row;
end;
$$;

grant execute on function public.propose_profit_to_lm(uuid, bigint, bigint, text, boolean) to authenticated;

-- LM forwards owner proposal into CEO approval path (investors notified on approve)
create or replace function public.forward_profit_proposal_to_investors(p_declaration_id uuid)
returns public.profit_declarations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profit_declarations;
  v_project public.projects;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from public.profit_declarations where id = p_declaration_id for update;
  if not found then
    raise exception 'Declaration not found';
  end if;
  if v_row.status <> 'PROPOSED' then
    raise exception 'Only owner proposals can be forwarded (current: %)', v_row.status;
  end if;

  select * into v_project from public.projects where id = v_row.project_id;
  if v_project.created_by <> auth.uid() and not public.is_ceo_or_admin() then
    raise exception 'Only Prism (Line Manager) can declare this profit to investors';
  end if;

  update public.profit_declarations
  set status = 'PENDING'
  where id = p_declaration_id
  returning * into v_row;

  -- CEO notify is handled by trg_notify_declaration_submitted on status → PENDING.
  -- Confirm to owner that LM has taken it forward.
  if v_project.project_owner_id is not null then
    perform public.create_notifications(
      array[v_project.project_owner_id],
      'DECLARATION_SUBMITTED',
      'Prism submitted your profit proposal',
      coalesce(v_row.reference, 'Declaration')
        || ' was forwarded by your Line Manager for approval and investor distribution.',
      v_row.project_id,
      v_row.id,
      '/(tabs)/projects/' || v_row.project_id || '?tab=profits'
    );
  end if;

  return v_row;
end;
$$;

grant execute on function public.forward_profit_proposal_to_investors(uuid) to authenticated;

-- Fire CEO/edge notify when status becomes PENDING (insert OR LM forward)
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
  if TG_OP = 'UPDATE' and OLD.status = 'PENDING' then
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
  after insert or update of status on public.profit_declarations
  for each row execute function public.trg_notify_declaration_submitted();

-- declare_profit: Prism LM / CEO only (owner must use propose_profit_to_lm)
create or replace function public.declare_profit(
  p_project_id uuid,
  p_gross_minor bigint,
  p_costs_minor bigint default 0,
  p_label text default null,
  p_is_final boolean default false
)
returns public.profit_declarations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_net bigint;
  v_prism bigint;
  v_distributable bigint;
  v_pool bigint;
  v_manager bigint;
  v_per_unit bigint;
  v_seq int;
  v_reference text;
  v_row public.profit_declarations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_gross_minor is null or p_gross_minor < 0 then
    raise exception 'Gross amount must be zero or positive';
  end if;
  if p_costs_minor is null or p_costs_minor < 0 then
    raise exception 'Costs must be zero or positive';
  end if;
  if p_costs_minor > p_gross_minor then
    raise exception 'Costs (%) cannot exceed gross (%)', p_costs_minor, p_gross_minor;
  end if;

  select * into v_project from public.projects where id = p_project_id for share;
  if not found then
    raise exception 'Project not found';
  end if;

  -- Owner cannot declare directly to investors — only Prism LM / CEO
  if v_project.created_by <> auth.uid() and not public.is_ceo_or_admin() then
    raise exception 'Only Prism (Line Manager) can declare profit to investors. Project owners must propose to their LM.';
  end if;

  if not p_is_final and v_project.stage <> 'PROGRESS' then
    raise exception 'Profit can only be declared while the project is in Progress';
  end if;
  if v_project.total_units is null or v_project.total_units <= 0 then
    raise exception 'Project is not configured for unit-based profit distribution';
  end if;

  v_net := p_gross_minor - p_costs_minor;
  v_prism := floor(v_net::numeric * coalesce(v_project.platform_fee_bps, 750) / 10000.0)::bigint;
  v_distributable := v_net - v_prism;
  v_pool := floor(v_distributable::numeric * v_project.profit_split_investor_bps / 10000.0)::bigint;
  v_manager := v_distributable - v_pool;
  v_per_unit := floor(v_pool::numeric / v_project.total_units)::bigint;

  select coalesce(max(seq), 0) + 1 into v_seq
  from (
    select cast(regexp_replace(reference, '^.*-DECL(\d+)$', '\1') as int) as seq
    from public.profit_declarations
    where project_id = p_project_id
      and reference ~ '-DECL\d+$'
  ) t;
  v_reference := format('PRSM-%s-DECL%s', v_project.code, lpad(v_seq::text, 3, '0'));

  insert into public.profit_declarations (
    project_id, reference, label, is_final,
    gross_amount_minor, costs_minor, net_amount_minor,
    platform_fee_bps, platform_fee_minor,
    distributable_minor,
    profit_split_investor_bps, investor_pool_minor, manager_share_minor,
    total_units_at_declaration, per_unit_minor,
    status, declared_by
  )
  values (
    p_project_id, v_reference, coalesce(p_label, ''), coalesce(p_is_final, false),
    p_gross_minor, p_costs_minor, v_net,
    coalesce(v_project.platform_fee_bps, 750), v_prism,
    v_distributable,
    v_project.profit_split_investor_bps, v_pool, v_manager,
    v_project.total_units, v_per_unit,
    'PENDING', auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- 4. Owner ↔ LM messaging ----------------------------------------------------

alter table public.message_threads
  add column if not exists owner_id uuid references public.profiles(id) on delete cascade;

alter table public.message_threads
  alter column investor_id drop not null;

-- Replace old unique (null investor_id would not enforce owner uniqueness well)
alter table public.message_threads
  drop constraint if exists message_threads_project_id_investor_id_manager_id_key;

create unique index if not exists message_threads_investor_uniq
  on public.message_threads (project_id, investor_id, manager_id)
  where investor_id is not null;

-- One counterparty per thread: investor XOR owner
alter table public.message_threads drop constraint if exists message_threads_counterparty_chk;
alter table public.message_threads
  add constraint message_threads_counterparty_chk check (
    (investor_id is not null and owner_id is null)
    or (investor_id is null and owner_id is not null)
  );

create unique index if not exists message_threads_owner_uniq
  on public.message_threads (project_id, owner_id, manager_id)
  where owner_id is not null;

drop policy if exists "message_threads: participants read" on public.message_threads;
create policy "message_threads: participants read"
  on public.message_threads for select
  using (
    auth.uid() = investor_id
    or auth.uid() = owner_id
    or auth.uid() = manager_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('CEO','ADMIN')
    )
  );

drop policy if exists "messages: participants read" on public.messages;
create policy "messages: participants read"
  on public.messages for select
  using (
    exists (
      select 1 from public.message_threads t
      where t.id = messages.thread_id
        and (
          auth.uid() = t.investor_id
          or auth.uid() = t.owner_id
          or auth.uid() = t.manager_id
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('CEO','ADMIN')
          )
        )
    )
  );

-- Investor threads: only investor or LM (not owner)
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
  v_inv_role text;
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
  select role into v_inv_role from public.profiles where id = p_investor_id;

  if v_inv_role is distinct from 'INVESTOR' then
    raise exception 'Investor threads are only for investors — use owner thread for project owners';
  end if;

  if not (
    v_actor = p_investor_id
    or v_actor = v_manager
    or v_role in ('CEO','ADMIN')
  ) then
    raise exception 'not authorised to open thread';
  end if;

  -- Block project owners from opening investor threads
  if v_role = 'PROJECT_OWNER' then
    raise exception 'Project owners may only message their Prism Line Manager';
  end if;

  select id into v_thread
  from public.message_threads
  where project_id = p_project_id
    and investor_id = p_investor_id
    and manager_id = v_manager
    and owner_id is null;

  if v_thread is null then
    insert into public.message_threads (project_id, investor_id, manager_id, owner_id)
    values (p_project_id, p_investor_id, v_manager, null)
    returning id into v_thread;
  end if;

  return v_thread;
end;
$$;

create or replace function public.ensure_owner_lm_thread(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   uuid;
  v_role    text;
  v_manager uuid;
  v_owner   uuid;
  v_thread  uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  select created_by, project_owner_id
    into v_manager, v_owner
  from public.projects
  where id = p_project_id;

  if v_manager is null then
    raise exception 'project not found';
  end if;
  if v_owner is null then
    raise exception 'No project owner assigned on this project';
  end if;

  select role into v_role from public.profiles where id = v_actor;

  if not (
    v_actor = v_owner
    or v_actor = v_manager
    or v_role in ('CEO','ADMIN')
  ) then
    raise exception 'not authorised to open owner–LM thread';
  end if;

  select id into v_thread
  from public.message_threads
  where project_id = p_project_id
    and owner_id = v_owner
    and manager_id = v_manager
    and investor_id is null;

  if v_thread is null then
    insert into public.message_threads (project_id, investor_id, owner_id, manager_id)
    values (p_project_id, null, v_owner, v_manager)
    returning id into v_thread;
  end if;

  return v_thread;
end;
$$;

grant execute on function public.ensure_owner_lm_thread(uuid) to authenticated;

-- send_message: treat owner as participant; unread counters
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

  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'message body required';
  end if;

  select * into v_thread from public.message_threads where id = p_thread_id;
  if not found then
    raise exception 'thread not found';
  end if;

  if v_actor <> v_thread.manager_id
     and v_actor is distinct from v_thread.investor_id
     and v_actor is distinct from v_thread.owner_id then
    raise exception 'not a participant';
  end if;

  v_preview := left(trim(p_body), 140);

  insert into public.messages (thread_id, sender_id, body)
  values (p_thread_id, v_actor, trim(p_body))
  returning id into v_msg_id;

  update public.message_threads
  set
    last_message_at = now(),
    last_message_preview = v_preview,
    last_sender_id = v_actor,
    -- investor_unread_count also stores owner unread on owner↔LM threads
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

  return v_msg_id;
end;
$$;

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
