-- ---------------------------------------------------------------------------
-- Security hardening (2026-09-04 audit).
--
-- Closes the exploitable holes found in the audit:
--   1. post_ledger / log_audit / notification helpers were executable by any
--      authenticated user (forge ledger entries -> withdraw real money, forge
--      audit events, push phishing notifications, enumerate users).
--   2. invites_update_investor allowed investors to PATCH their own invite to
--      CONFIRMED with arbitrary amounts, bypassing payment verification.
--   3. handle_new_user honored client-controlled signup metadata for role
--      (privilege escalation to ADMIN via supabase.auth.signUp options.data).
--   4. finalize_project_if_due (callable by ANY user) and end_project_now
--      minted investor_payouts from a stale gross formula, bypassing the
--      declarations / distribution-notice maker-checker flow.
--   5. SECURITY DEFINER read RPCs leaked every project's ledger and audit
--      trail (including payout bank details) and any user's profit summary.
--   6. mark_password_set accepted an arbitrary target user id.
--   7. LMs could DELETE projects at any stage (cascading away live pledges).
--   8. approve_remnant_pledge set tasks.status = 'DONE' (not a task_status
--      value) so every remnant approval threw and rolled back.
-- ---------------------------------------------------------------------------

-- 1. Internal-only helpers: revoke client execution. Triggers and definer
--    RPCs run with owner privileges and do not need these grants.

revoke execute on function public.post_ledger(text, uuid, text, uuid, uuid, jsonb)
  from authenticated, anon, public;
revoke execute on function public.log_audit(uuid, text, uuid, text, jsonb, uuid)
  from authenticated, anon, public;
revoke execute on function public.create_notifications(uuid[], text, text, text, uuid, uuid, text)
  from authenticated, anon, public;
revoke execute on function public.confirmed_investor_ids(uuid)
  from authenticated, anon, public;
revoke execute on function public.ceo_admin_ids()
  from authenticated, anon, public;
revoke execute on function public.notify_investors_via_edge(text, uuid)
  from authenticated, anon, public;

-- 2. Investors must not write invite rows directly — all their transitions go
--    through the validating RPCs (accept_invite / decline_invite / pledge_*).
--    invites_update_manager remains for staff paths.

drop policy if exists invites_update_investor on public.invites;

-- 3. Never trust signup metadata for role. Staff accounts are provisioned by
--    service-role edge functions which set profiles.role explicitly.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  );
  -- Role is ALWAYS INVESTOR here. raw_user_meta_data is client-controlled at
  -- signup, so honoring a role from it is a privilege-escalation vector.
  -- Staff roles are written by the service-role provisioning flows
  -- (create-user / create-project-owner edge functions).
  insert into public.profiles (id, full_name, email, role)
  values (new.id, v_full_name, new.email, 'INVESTOR')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 4a. finalize_project_if_due: callable by ANY authenticated user and minted
--     payouts outside the declarations flow. Remove entirely (the frontend
--     soft-noops on PGRST202).

drop function if exists public.finalize_project_if_due(uuid);

-- 4b. end_project_now: keep the LM/CEO "end project" action but stop minting
--     investor_payouts from the stale gross realised_profit formula. Payout
--     economics are governed exclusively by the profit-declaration /
--     distribution-notice flow.

create or replace function public.end_project_now(p_project_id uuid)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.created_by <> auth.uid() and not public.is_ceo_or_admin() then
    raise exception 'Only the project manager can end this project';
  end if;

  -- Already ended -> return current row (idempotent).
  if v_project.stage = 'END' then
    return v_project;
  end if;

  if v_project.stage <> 'PROGRESS' then
    raise exception 'Only projects in Progress can be ended (current stage: %)', v_project.stage;
  end if;

  update public.projects
  set stage = 'END', updated_at = now()
  where id = p_project_id
  returning * into v_project;

  return v_project;
end;
$$;

-- 5. Read-leak batch -----------------------------------------------------------

-- View ran with owner privileges; flip to invoker so ledger_entries RLS applies.
alter view public.ledger_project_balances set (security_invoker = true);

-- list_project_ledger: RLS on ledger_entries already encodes visibility
-- (staff + project participants); run as invoker instead of definer.
create or replace function public.list_project_ledger(p_project_id uuid, p_limit int default 500)
returns setof public.ledger_entries
language sql stable security invoker set search_path = public as $$
  select * from public.ledger_entries
  where project_id = p_project_id
  order by created_at desc, sequence asc
  limit greatest(1, coalesce(p_limit, 500));
$$;

-- list_project_audit: same treatment; audit_events RLS gates reads. The audit
-- trail contains payout bank details, so definer semantics leaked them to all.
create or replace function public.list_project_audit(p_project_id uuid, p_limit int default 200)
returns setof public.audit_events
language sql stable security invoker set search_path = public as $$
  select * from public.audit_events
  where project_id = p_project_id
  order by created_at desc
  limit greatest(1, coalesce(p_limit, 200));
$$;

-- Profit summaries: the target-id parameter is only honored for staff; any
-- other caller gets their own data regardless of the parameter.

create or replace function public.get_investor_profit_summary(p_investor_id uuid default null)
returns table (
  project_id uuid,
  invite_id uuid,
  capital_minor bigint,
  realised_profit_minor bigint,
  investor_share_minor bigint,
  project_stage public.project_stage,
  project_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_investor_id is not null
     and p_investor_id <> auth.uid()
     and not public.is_ceo_or_admin() then
    raise exception 'Not authorized to view another investor''s profit summary';
  end if;

  return query
  with target as (
    select coalesce(p_investor_id, auth.uid()) as uid
  ),
  notice_profit as (
    select
      dn.invite_id,
      coalesce(sum(dn.profit_minor), 0)::bigint as share_minor
    from public.distribution_notices dn
    cross join target
    where dn.investor_id = target.uid
    group by dn.invite_id
  ),
  unit_profit as (
    select
      i.id as invite_id,
      coalesce(
        round(
          coalesce(i.units_allotted, i.units_pledged, 0)::numeric
          * coalesce(sum(d.per_unit_minor), 0)::numeric
        ),
        0
      )::bigint as share_minor
    from public.invites i
    join public.profit_declarations d
      on d.project_id = i.project_id
     and d.status = 'APPROVED'
    cross join target
    where i.investor_id = target.uid
      and i.status = 'CONFIRMED'
    group by i.id, i.units_allotted, i.units_pledged
  ),
  project_pool as (
    select
      d.project_id,
      coalesce(sum(d.investor_pool_minor), 0)::bigint as pool_minor
    from public.profit_declarations d
    where d.status = 'APPROVED'
    group by d.project_id
  )
  select
    p.id as project_id,
    i.id as invite_id,
    coalesce(i.amount_minor, 0) as capital_minor,
    coalesce(pp.pool_minor, 0) as realised_profit_minor,
    coalesce(nullif(np.share_minor, 0), up.share_minor, 0) as investor_share_minor,
    p.stage as project_stage,
    p.name as project_name
  from public.invites i
  join public.projects p on p.id = i.project_id
  cross join target
  left join notice_profit np on np.invite_id = i.id
  left join unit_profit up on up.invite_id = i.id
  left join project_pool pp on pp.project_id = p.id
  where i.investor_id = target.uid
    and i.status = 'CONFIRMED';
end;
$$;

create or replace function public.get_owner_profit_summary(p_owner_id uuid default null)
returns table (
  total_realised_profit_minor bigint,
  manager_share_minor bigint,
  project_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_owner_id is not null
     and p_owner_id <> auth.uid()
     and not public.is_ceo_or_admin() then
    raise exception 'Not authorized to view another owner''s earnings';
  end if;

  return query
  with target as (
    select coalesce(p_owner_id, auth.uid()) as uid
  ),
  shares as (
    select
      d.project_id,
      coalesce(sum(d.manager_share_minor), 0)::bigint as share_minor,
      coalesce(sum(d.gross_amount_minor), 0)::bigint as gross_minor
    from public.profit_declarations d
    join public.projects p on p.id = d.project_id
    cross join target
    where d.status = 'APPROVED'
      and p.project_owner_id = target.uid
    group by d.project_id
  )
  select
    coalesce(sum(s.gross_minor), 0)::bigint as total_realised_profit_minor,
    coalesce(sum(s.share_minor), 0)::bigint as manager_share_minor,
    count(*)::int as project_count
  from shares s;
end;
$$;

create or replace function public.get_manager_profit_summary(p_manager_id uuid default null)
returns table (
  total_realised_profit_minor bigint,
  manager_share_minor bigint,
  platform_fee_minor bigint,
  project_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_manager_id is not null
     and p_manager_id <> auth.uid()
     and not public.is_ceo_or_admin() then
    raise exception 'Not authorized to view another manager''s earnings';
  end if;

  return query
  with target as (
    select coalesce(p_manager_id, auth.uid()) as uid
  ),
  decl_fees as (
    select
      d.project_id,
      coalesce(sum(d.platform_fee_minor), 0)::bigint as fee_minor,
      coalesce(sum(d.gross_amount_minor), 0)::bigint as gross_minor
    from public.profit_declarations d
    join public.projects p on p.id = d.project_id
    cross join target
    where d.status = 'APPROVED'
      and p.created_by = target.uid
    group by d.project_id
  ),
  raise_fees as (
    select
      p.id as project_id,
      coalesce(p.raise_fee_minor, 0)::bigint as fee_minor
    from public.projects p
    cross join target
    where p.created_by = target.uid
      and coalesce(p.raise_fee_minor, 0) > 0
  ),
  combined as (
    select project_id, fee_minor, gross_minor from decl_fees
    union all
    select project_id, fee_minor, 0::bigint from raise_fees
  )
  select
    coalesce(sum(c.gross_minor), 0)::bigint as total_realised_profit_minor,
    coalesce(sum(c.fee_minor), 0)::bigint as manager_share_minor,
    coalesce(sum(c.fee_minor), 0)::bigint as platform_fee_minor,
    count(distinct c.project_id)::int as project_count
  from combined c;
end;
$$;

-- 6. mark_password_set: the target parameter allowed any user to suppress
--    another account's forced password-setup step. Always act on the caller.

create or replace function public.mark_password_set(p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- p_user_id kept for signature compatibility but intentionally ignored.
  update public.profiles
  set password_set_at = coalesce(password_set_at, now())
  where id = auth.uid();
end;
$$;

-- 7. Project deletion: LMs may only delete their own pre-submission drafts
--    (the create-wizard rollback case). CEO/ADMIN retain cleanup powers; the
--    ledger_entries FK (on delete restrict) still protects funded projects.

drop policy if exists projects_delete_owner_or_ceo on public.projects;
create policy projects_delete_owner_or_ceo
  on public.projects for delete to authenticated
  using (
    public.is_ceo_or_admin()
    or (
      created_by = auth.uid()
      and stage = 'INITIATION'
      and submitted_at is null
    )
  );

-- 8. approve_remnant_pledge: 'DONE' is not a task_status value, so every
--    remnant approval raised and rolled back. Use 'COMPLETED'.

create or replace function public.approve_remnant_pledge(
  p_invite_id uuid
)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites;
  v_project public.projects;
  v_seq int;
  v_expiry_hours int;
  v_reference text;
  v_available numeric;
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

  if v_invite.min_waiver_status <> 'PENDING' then
    raise exception 'No remnant pledge awaiting approval';
  end if;

  if v_invite.status <> 'ACCEPTED' then
    raise exception 'Invitation is not in an approvable state (current: %)', v_invite.status;
  end if;

  if v_invite.units_pledged is null or v_invite.units_pledged <= 0 then
    raise exception 'Remnant pledge has no units reserved';
  end if;

  select * into v_project
  from public.projects
  where id = v_invite.project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.created_by <> auth.uid()
     and public.current_user_role() not in ('CEO', 'ADMIN') then
    raise exception 'Only the project Line Manager can approve a remnant pledge';
  end if;

  -- Re-check availability excluding this invite's pending reservation
  v_available := round(
    v_project.total_units::numeric - public.project_units_reserved(v_project.id, p_invite_id),
    6
  );

  if v_invite.units_pledged > v_available then
    raise exception 'Only % units remaining; cannot approve this remnant pledge', v_available;
  end if;

  v_expiry_hours := coalesce(v_project.pledge_expiry_hours, 72);

  if v_invite.payment_reference is not null then
    v_reference := v_invite.payment_reference;
  else
    select coalesce(max(seq), 0) + 1 into v_seq
    from (
      select
        cast(regexp_replace(payment_reference, '^.*-INV(\d+)$', '\1') as int) as seq
      from public.invites
      where project_id = v_project.id
        and payment_reference ~ '-INV\d+$'
    ) t;
    v_reference := format('PRSM-%s-INV%s', v_project.code, lpad(v_seq::text, 3, '0'));
  end if;

  update public.invites
  set
    status = 'COMMITTED',
    min_waiver_status = 'APPROVED',
    payment_reference = v_reference,
    pledged_at = coalesce(pledged_at, now()),
    pledge_expires_at = now() + make_interval(hours => v_expiry_hours),
    updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  update public.tasks
  set status = 'COMPLETED'
  where invite_id = p_invite_id
    and kind = 'APPROVE_REMNANT_PLEDGE'
    and status = 'OPEN';

  -- Notify investor
  if v_invite.investor_id is not null then
    perform public.create_notifications(
      array[v_invite.investor_id],
      'PROJECT_APPROVED',
      'Remnant pledge approved',
      'Your below-minimum pledge of '
        || trim(to_char(v_invite.units_pledged, 'FM999999990.999999'))
        || ' units was approved. Complete payment with reference ' || v_reference || '.',
      v_project.id,
      p_invite_id,
      '/(tabs)/portfolio/projects/' || v_project.id || '?invite=' || p_invite_id::text
    );
  end if;

  return v_invite;
end;
$$;

-- 9. list_earning_breakdown: keep auth.uid() scoping for LM/owner, but let
--    CEO/ADMIN inspect either kind across the book.
create or replace function public.list_earning_breakdown(p_kind text default 'platform')
returns table (
  project_id uuid,
  project_code text,
  project_name text,
  gross_minor bigint,
  amount_minor bigint,
  declaration_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_kind = 'manager_share' then
    return query
    select
      p.id,
      p.code,
      p.name,
      coalesce(sum(d.gross_amount_minor), 0)::bigint,
      coalesce(sum(d.manager_share_minor), 0)::bigint,
      count(d.id)::int
    from public.projects p
    join public.profit_declarations d on d.project_id = p.id and d.status = 'APPROVED'
    where p.project_owner_id = auth.uid()
       or public.is_ceo_or_admin()
    group by p.id, p.code, p.name
    having coalesce(sum(d.manager_share_minor), 0) > 0
    order by 5 desc;
  else
    return query
    select
      p.id,
      p.code,
      p.name,
      coalesce(sum(d.gross_amount_minor), 0)::bigint,
      (
        coalesce(sum(d.platform_fee_minor), 0)
        + coalesce(p.raise_fee_minor, 0)
      )::bigint,
      count(d.id)::int
    from public.projects p
    left join public.profit_declarations d
      on d.project_id = p.id and d.status = 'APPROVED'
    where p.created_by = auth.uid()
       or public.is_ceo_or_admin()
    group by p.id, p.code, p.name, p.raise_fee_minor
    having (
      coalesce(sum(d.platform_fee_minor), 0)
      + coalesce(p.raise_fee_minor, 0)
    ) > 0
    order by 5 desc;
  end if;
end;
$$;
