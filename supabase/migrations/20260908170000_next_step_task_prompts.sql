-- "What to do next" prompts. After a decision lands, the next actor gets an
-- explicit task or notification instead of having to infer their next move:
--   1. CEO approves a project  → LM task "Invite investors: <code>"
--   2. CEO approves a raise    → LM task "Invite investors to raise: <code>"
--   3. LM confirms a payment   → investor notification "Payment confirmed"
--   4. First invite sent       → open INVITE_INVESTORS tasks auto-complete

-- ---------------------------------------------------------------------------
-- 1. decide_project_approval — same body, plus the LM invite task on approval
-- ---------------------------------------------------------------------------

create or replace function public.decide_project_approval(
  p_project_id uuid,
  p_approval_status public.approval_status,
  p_rejection_note text default null
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
begin
  if not public.is_ceo_or_admin() then
    raise exception 'Only CEO or admin can approve projects';
  end if;

  if p_approval_status not in ('APPROVED', 'REJECTED') then
    raise exception 'approval_status must be APPROVED or REJECTED';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  -- Auto-submit: LM created but never formally submitted (legacy or wizard glitch)
  if v_project.submitted_at is null then
    update public.projects
    set submitted_at = now()
    where id = p_project_id
    returning * into v_project;
  end if;

  if v_project.approval_status <> 'PENDING' then
    raise exception 'Project is not pending approval';
  end if;

  if p_approval_status = 'APPROVED' then
    update public.projects
    set
      approval_status = 'APPROVED',
      approved_by = auth.uid(),
      approved_at = now(),
      rejected_by = null,
      rejected_at = null,
      rejection_note = null,
      stage = case when stage = 'INITIATION' then 'ACCEPTANCE'::public.project_stage else stage end
    where id = p_project_id
    returning * into v_project;
  else
    update public.projects
    set
      approval_status = 'REJECTED',
      rejected_by = auth.uid(),
      rejected_at = now(),
      rejection_note = p_rejection_note,
      approved_by = null,
      approved_at = null
    where id = p_project_id
    returning * into v_project;
  end if;

  update public.tasks
  set
    status = 'COMPLETED',
    completed_at = now(),
    completed_by = auth.uid()
  where project_id = p_project_id
    and kind = 'REVIEW_PROJECT'
    and status = 'OPEN';

  -- Next step for the LM: start raising capital.
  if p_approval_status = 'APPROVED'
     and not exists (
       select 1 from public.tasks
       where project_id = p_project_id
         and kind = 'INVITE_INVESTORS'
         and status = 'OPEN'
     ) then
    insert into public.tasks (kind, title, project_id, assignee_role, status)
    values (
      'INVITE_INVESTORS',
      'Invite investors: ' || v_project.code,
      p_project_id,
      'LINE_MANAGER',
      'OPEN'
    );
  end if;

  return v_project;
end;
$$;

grant execute on function public.decide_project_approval(uuid, public.approval_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. decide_funding_round — same body, plus the LM invite task on approval
-- ---------------------------------------------------------------------------

create or replace function public.decide_funding_round(
  p_round_id uuid,
  p_status text,
  p_note text default null
)
returns public.funding_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.funding_rounds;
  v_project public.projects;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_ceo_or_admin() then
    raise exception 'Only the CEO can decide a funding round';
  end if;
  if p_status not in ('APPROVED', 'REJECTED') then
    raise exception 'status must be APPROVED or REJECTED';
  end if;

  select * into v_row from public.funding_rounds where id = p_round_id for update;
  if not found then
    raise exception 'Funding round not found';
  end if;
  if v_row.status <> 'PENDING' then
    raise exception 'Funding round is not pending (current: %)', v_row.status;
  end if;

  select * into v_project from public.projects where id = v_row.project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  if p_status = 'APPROVED' then
    update public.projects
    set
      total_units = total_units + v_row.additional_units,
      target_minor = target_minor + v_row.additional_minor,
      updated_at = now()
    where id = v_project.id;
  end if;

  update public.funding_rounds
  set
    status = p_status,
    decided_by = auth.uid(),
    decided_at = now(),
    decision_note = nullif(trim(coalesce(p_note, '')), ''),
    updated_at = now()
  where id = p_round_id
  returning * into v_row;

  update public.tasks
  set status = 'COMPLETED'
  where project_id = v_project.id
    and kind = 'DECIDE_FUNDING_ROUND'
    and status = 'OPEN';

  -- Next step for the requester: place the newly minted units.
  if p_status = 'APPROVED'
     and not exists (
       select 1 from public.tasks
       where project_id = v_project.id
         and kind = 'INVITE_INVESTORS'
         and status = 'OPEN'
     ) then
    insert into public.tasks (kind, title, project_id, assignee_role, status)
    values (
      'INVITE_INVESTORS',
      'Invite investors to raise: ' || v_project.code,
      v_project.id,
      'LINE_MANAGER',
      'OPEN'
    );
  end if;

  if v_row.requested_by is not null then
    perform public.create_notifications(
      array[v_row.requested_by],
      case when p_status = 'APPROVED' then 'PROJECT_APPROVED' else 'PROJECT_REJECTED' end,
      case when p_status = 'APPROVED'
        then 'Additional capital approved'
        else 'Additional capital rejected' end,
      v_project.code || ' · ' || coalesce(p_note, p_status),
      v_project.id,
      null,
      '/(tabs)/projects/' || v_project.id || '?tab=capital'
    );
  end if;

  return v_row;
end;
$$;

grant execute on function public.decide_funding_round(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. confirm_invite_payment — same body, plus the investor confirmation
-- ---------------------------------------------------------------------------

create or replace function public.confirm_invite_payment(p_invite_id uuid)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites;
  v_project public.projects;
  v_amount bigint;
  v_remaining bigint;
  v_is_manager boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_invite.status <> 'PROOF_SUBMITTED' then
    raise exception 'Payment can only be confirmed when status is PROOF_SUBMITTED';
  end if;

  if v_invite.amount_minor is null or v_invite.amount_minor <= 0 then
    raise exception 'Invite has no committed amount';
  end if;

  v_amount := v_invite.amount_minor;

  select * into v_project
  from public.projects
  where id = v_invite.project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  v_is_manager :=
    public.is_ceo_or_admin()
    or (
      public.current_user_role() = 'LINE_MANAGER'
      and v_project.created_by = auth.uid()
    );

  if not v_is_manager then
    raise exception 'Forbidden';
  end if;

  v_remaining := v_project.target_minor - v_project.raised_minor;
  if v_amount > v_remaining then
    raise exception 'Committed amount exceeds remaining project capacity';
  end if;

  update public.invites
  set
    status = 'CONFIRMED',
    updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  perform set_config('app.allow_raised_minor_update', 'true', true);

  update public.projects
  set
    raised_minor = raised_minor + v_amount,
    updated_at = now()
  where id = v_project.id;

  update public.tasks
  set
    status = 'COMPLETED',
    completed_at = now(),
    completed_by = auth.uid()
  where invite_id = p_invite_id
    and kind = 'CONFIRM_PAYMENT_PROOF'
    and status = 'OPEN';

  -- Close the loop for the investor — previously they heard nothing.
  if v_invite.investor_id is not null then
    perform public.create_notifications(
      array[v_invite.investor_id],
      'PAYMENT_CONFIRMED',
      'Payment confirmed',
      v_project.name || ' — your investment is confirmed and units are allotted',
      v_project.id,
      v_invite.id,
      '/(tabs)/projects/' || v_project.id
    );
  end if;

  return v_invite;
end;
$$;

grant execute on function public.confirm_invite_payment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Sending an invite completes the open INVITE_INVESTORS task
-- ---------------------------------------------------------------------------

create or replace function public.complete_invite_investors_task_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tasks
  set
    status = 'COMPLETED',
    completed_at = now(),
    completed_by = coalesce(auth.uid(), new.invited_by)
  where project_id = new.project_id
    and kind = 'INVITE_INVESTORS'
    and status = 'OPEN';
  return new;
end;
$$;

drop trigger if exists complete_invite_investors_task on public.invites;
create trigger complete_invite_investors_task
  after insert on public.invites
  for each row execute function public.complete_invite_investors_task_trg();
