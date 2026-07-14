-- CONFIRM_PAYMENT_PROOF tasks + invite_id; commit/confirm RPCs

alter type public.task_kind add value if not exists 'CONFIRM_PAYMENT_PROOF';

alter table public.tasks
  add column if not exists invite_id uuid references public.invites (id) on delete cascade;

create index if not exists tasks_invite_id_idx
  on public.tasks (invite_id)
  where invite_id is not null;

-- Line managers can complete payment-proof tasks on their own projects
drop policy if exists tasks_update_owner on public.tasks;
create policy tasks_update_owner
  on public.tasks for update to authenticated
  using (
    public.current_user_role() = 'LINE_MANAGER'
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.created_by = auth.uid()
    )
  )
  with check (
    public.current_user_role() = 'LINE_MANAGER'
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- commit_invite_investment — enforce investable max server-side
-- ---------------------------------------------------------------------------

create or replace function public.commit_invite_investment(
  p_invite_id uuid,
  p_amount_minor bigint
)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites;
  v_project public.projects;
  v_remaining bigint;
  v_investable_max bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_invite
  from public.invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_invite.investor_id <> auth.uid() then
    raise exception 'Forbidden';
  end if;

  if v_invite.status <> 'ACCEPTED' then
    raise exception 'Investment can only be committed when status is ACCEPTED';
  end if;

  select * into v_project
  from public.projects
  where id = v_invite.project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  v_remaining := v_project.target_minor - v_project.raised_minor;
  if v_remaining < 0 then
    v_remaining := 0;
  end if;

  if v_invite.max_investment_amount_minor is not null then
    v_investable_max := least(v_invite.max_investment_amount_minor, v_remaining);
  else
    v_investable_max := v_remaining;
  end if;

  if p_amount_minor > v_investable_max then
    raise exception 'Amount exceeds the maximum investment available (%)', v_investable_max;
  end if;

  update public.invites
  set
    status = 'COMMITTED',
    amount_minor = p_amount_minor,
    updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  return v_invite;
end;
$$;

grant execute on function public.commit_invite_investment(uuid, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- confirm_invite_payment — LM/admin confirms proof, bumps raised, completes task
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

  return v_invite;
end;
$$;

grant execute on function public.confirm_invite_payment(uuid) to authenticated;
