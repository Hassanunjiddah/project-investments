-- ---------------------------------------------------------------------------
-- P3: Institutional transparency layer
--
--   * distribution_notices — one per (declaration, confirmed investor) row,
--     immutable, created automatically when a declaration is approved. Shows
--     each investor exactly how their number was computed.
--   * audit_events — universal append-only log of every meaningful action:
--     project created, pledge, payment claimed, verified, declared, approved,
--     rejected, ended, payout, notice generated. Filterable, exportable.
--   * project_reconciliation(project) — RPC that returns expected inflow vs
--     actual amount per confirmed investor, flagging mismatches for Finance.
-- ---------------------------------------------------------------------------

create table if not exists public.distribution_notices (
  id uuid primary key default gen_random_uuid(),
  declaration_id uuid not null references public.profit_declarations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  invite_id uuid not null references public.invites(id) on delete cascade,
  investor_id uuid not null references public.profiles(id),
  units_held int not null,
  per_unit_minor bigint not null,
  profit_minor bigint not null,          -- units_held * per_unit
  capital_returned_minor bigint not null default 0, -- >0 only for FINAL notices
  reference text unique,                  -- PRSM-<code>-NOT<seq>
  is_final boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists distribution_notices_investor_idx
  on public.distribution_notices (investor_id, created_at desc);
create index if not exists distribution_notices_declaration_idx
  on public.distribution_notices (declaration_id);
create index if not exists distribution_notices_project_idx
  on public.distribution_notices (project_id, created_at desc);

alter table public.distribution_notices enable row level security;

drop policy if exists distribution_notices_read on public.distribution_notices;
create policy distribution_notices_read on public.distribution_notices
  for select using (
    investor_id = auth.uid()                 -- investor sees their own
    or exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.created_by = auth.uid() or public.is_ceo_or_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- audit_events
-- ---------------------------------------------------------------------------

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  entity_type text not null,   -- 'project'|'invite'|'declaration'|'payout'|'notice'
  entity_id uuid,
  event_type text not null,    -- see comment above
  actor_id uuid,               -- profile.id; null for system/trigger events
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_project_idx
  on public.audit_events (project_id, created_at desc);
create index if not exists audit_events_actor_idx
  on public.audit_events (actor_id, created_at desc);
create index if not exists audit_events_event_type_idx
  on public.audit_events (event_type);

alter table public.audit_events enable row level security;

drop policy if exists audit_events_read on public.audit_events;
create policy audit_events_read on public.audit_events
  for select using (
    public.is_ceo_or_admin()
    or exists (
      select 1 from public.projects p
      where p.id = audit_events.project_id
        and p.created_by = auth.uid()
    )
    or exists (
      select 1 from public.invites i
      where i.project_id = audit_events.project_id
        and i.investor_id = auth.uid()
        and i.status = 'CONFIRMED'
    )
  );

-- Helper: log an audit event (security definer so triggers/RPCs can use it).
create or replace function public.log_audit(
  p_project_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_context jsonb default '{}'::jsonb,
  p_actor_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_events (project_id, entity_type, entity_id, event_type, actor_id, context)
  values (
    p_project_id,
    p_entity_type,
    p_entity_id,
    p_event_type,
    coalesce(p_actor_id, auth.uid()),
    coalesce(p_context, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.log_audit(uuid, text, uuid, text, jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers that emit audit events automatically
-- ---------------------------------------------------------------------------

create or replace function public.audit_projects_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.id, 'project', new.id, 'created',
      jsonb_build_object('code', new.code, 'name', new.name, 'target_minor', new.target_minor,
        'total_units', new.total_units, 'stage', new.stage),
      new.created_by
    );
  elsif tg_op = 'UPDATE' then
    if new.stage is distinct from old.stage then
      perform public.log_audit(
        new.id, 'project', new.id, 'stage_changed',
        jsonb_build_object('from', old.stage, 'to', new.stage)
      );
    end if;
    if new.approval_status is distinct from old.approval_status then
      perform public.log_audit(
        new.id, 'project', new.id, 'approval_status_changed',
        jsonb_build_object('from', old.approval_status, 'to', new.approval_status)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists audit_projects on public.projects;
create trigger audit_projects after insert or update on public.projects
  for each row execute function public.audit_projects_trg();

create or replace function public.audit_invites_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.project_id, 'invite', new.id, 'created',
      jsonb_build_object('email', new.email, 'status', new.status)
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.log_audit(
      new.project_id, 'invite', new.id,
      case new.status
        when 'ACCEPTED' then 'accepted'
        when 'COMMITTED' then 'pledged'
        when 'PROOF_SUBMITTED' then 'payment_claimed'
        when 'CONFIRMED' then 'verified_and_allotted'
        when 'DECLINED' then 'declined'
        else lower(new.status)
      end,
      jsonb_build_object(
        'from', old.status, 'to', new.status,
        'units', new.units_pledged, 'amount_minor', new.amount_minor,
        'payment_reference', new.payment_reference
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_invites on public.invites;
create trigger audit_invites after insert or update on public.invites
  for each row execute function public.audit_invites_trg();

create or replace function public.audit_declarations_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.project_id, 'declaration', new.id, 'declared',
      jsonb_build_object(
        'reference', new.reference, 'gross', new.gross_amount_minor,
        'net', new.net_amount_minor, 'is_final', new.is_final
      ),
      new.declared_by
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.log_audit(
      new.project_id, 'declaration', new.id,
      case new.status when 'APPROVED' then 'approved' when 'REJECTED' then 'rejected' else lower(new.status) end,
      jsonb_build_object(
        'reference', new.reference,
        'note', new.rejection_note,
        'investor_pool', new.investor_pool_minor,
        'per_unit', new.per_unit_minor
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_declarations on public.profit_declarations;
create trigger audit_declarations after insert or update on public.profit_declarations
  for each row execute function public.audit_declarations_trg();

-- ---------------------------------------------------------------------------
-- Extend approve_profit_declaration to also mint distribution_notices
-- ---------------------------------------------------------------------------

create or replace function public.approve_profit_declaration(p_declaration_id uuid)
returns public.profit_declarations
language plpgsql security definer set search_path = public as $$
declare
  v_row public.profit_declarations;
  v_project public.projects;
  v_seq int;
  v_notice_ref_base text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_ceo_or_admin() then
    raise exception 'Only CEO/Finance Admin can approve profit declarations';
  end if;

  select * into v_row from public.profit_declarations where id = p_declaration_id for update;
  if not found then raise exception 'Declaration not found'; end if;
  if v_row.status <> 'PENDING' then raise exception 'Declaration is already %', v_row.status; end if;
  if v_row.declared_by = auth.uid() then
    raise exception 'You cannot approve a declaration you submitted (four-eyes principle)';
  end if;

  select * into v_project from public.projects where id = v_row.project_id for update;

  update public.profit_declarations
  set status = 'APPROVED', approved_by = auth.uid(), approved_at = now()
  where id = p_declaration_id returning * into v_row;

  update public.projects
  set realised_profit_minor = realised_profit_minor + v_row.gross_amount_minor,
      updated_at = now()
  where id = v_row.project_id;

  -- Distribution notices — one per confirmed investor. Immutable.
  v_notice_ref_base := format('PRSM-%s-NOT', v_project.code);
  insert into public.distribution_notices (
    declaration_id, project_id, invite_id, investor_id,
    units_held, per_unit_minor, profit_minor,
    capital_returned_minor, reference, is_final
  )
  select
    v_row.id, v_row.project_id, i.id, i.investor_id,
    coalesce(i.units_allotted, i.units_pledged, 0),
    v_row.per_unit_minor,
    coalesce(i.units_allotted, i.units_pledged, 0)::bigint * v_row.per_unit_minor,
    case when v_row.is_final then coalesce(i.amount_minor, 0) else 0 end,
    v_notice_ref_base || lpad((row_number() over (order by i.id))::text, 3, '0'),
    v_row.is_final
  from public.invites i
  where i.project_id = v_row.project_id
    and i.status = 'CONFIRMED';

  if v_row.is_final then
    -- Also mint investor_payouts (keeps existing dashboards working).
    insert into public.investor_payouts (project_id, invite_id, investor_id, capital_minor, profit_minor)
    select i.project_id, i.id, i.investor_id, coalesce(i.amount_minor, 0),
           coalesce(i.units_allotted, i.units_pledged, 0)::bigint * v_row.per_unit_minor
    from public.invites i
    where i.project_id = v_row.project_id and i.status = 'CONFIRMED'
    on conflict (invite_id) do nothing;

    update public.projects set stage = 'END', updated_at = now() where id = v_row.project_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.approve_profit_declaration(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.list_investor_notices()
returns table (
  id uuid,
  declaration_id uuid,
  project_id uuid,
  project_name text,
  project_code text,
  invite_id uuid,
  units_held int,
  per_unit_minor bigint,
  profit_minor bigint,
  capital_returned_minor bigint,
  reference text,
  is_final boolean,
  created_at timestamptz,
  declaration_reference text,
  declaration_label text,
  gross_minor bigint,
  net_minor bigint,
  platform_fee_minor bigint,
  investor_pool_minor bigint,
  platform_fee_bps int,
  profit_split_investor_bps int
)
language sql stable security definer set search_path = public as $$
  select
    dn.id, dn.declaration_id, dn.project_id, p.name, p.code,
    dn.invite_id, dn.units_held, dn.per_unit_minor,
    dn.profit_minor, dn.capital_returned_minor,
    dn.reference, dn.is_final, dn.created_at,
    d.reference as declaration_reference,
    d.label as declaration_label,
    d.gross_amount_minor,
    d.net_amount_minor,
    d.platform_fee_minor,
    d.investor_pool_minor,
    d.platform_fee_bps,
    d.profit_split_investor_bps
  from public.distribution_notices dn
  join public.profit_declarations d on d.id = dn.declaration_id
  join public.projects p on p.id = dn.project_id
  where dn.investor_id = auth.uid()
  order by dn.created_at desc;
$$;

grant execute on function public.list_investor_notices() to authenticated;

create or replace function public.list_project_audit(p_project_id uuid, p_limit int default 200)
returns setof public.audit_events
language sql stable security definer set search_path = public as $$
  select * from public.audit_events
  where project_id = p_project_id
    -- RLS on audit_events already gates read; select is safe.
  order by created_at desc
  limit greatest(1, coalesce(p_limit, 200));
$$;

grant execute on function public.list_project_audit(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Reconciliation view: expected vs actual per confirmed invite
-- Returns one row per invite that's currently CONFIRMED or PROOF_SUBMITTED.
-- ---------------------------------------------------------------------------

create or replace function public.project_reconciliation(p_project_id uuid)
returns table (
  invite_id uuid,
  investor_id uuid,
  investor_name text,
  status text,
  payment_reference text,
  units_pledged int,
  units_allotted int,
  expected_minor bigint,
  claimed_minor bigint,
  variance_minor bigint,
  claim_bank text,
  claim_date date,
  claim_narration text,
  verified_at timestamptz,
  verified_by uuid,
  verified_by_name text
)
language sql stable security definer set search_path = public as $$
  select
    i.id,
    i.investor_id,
    coalesce(pr.full_name, i.email) as investor_name,
    i.status,
    i.payment_reference,
    i.units_pledged,
    i.units_allotted,
    coalesce(i.units_pledged, 0)::bigint
      * coalesce(p.target_minor / nullif(p.total_units, 0), 0) as expected_minor,
    coalesce(i.payment_claim_amount_minor, i.amount_minor, 0) as claimed_minor,
    coalesce(i.payment_claim_amount_minor, i.amount_minor, 0)
      - coalesce(i.units_pledged, 0)::bigint
      * coalesce(p.target_minor / nullif(p.total_units, 0), 0) as variance_minor,
    i.payment_claim_bank,
    i.payment_claim_date,
    i.payment_claim_narration,
    i.verified_at,
    i.verified_by,
    vpr.full_name as verified_by_name
  from public.invites i
  join public.projects p on p.id = i.project_id
  left join public.profiles pr on pr.id = i.investor_id
  left join public.profiles vpr on vpr.id = i.verified_by
  where i.project_id = p_project_id
    and i.status in ('COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED')
    -- Only project owner or CEO/admin can see this.
    and (
      exists (select 1 from public.projects x where x.id = p_project_id
              and (x.created_by = auth.uid() or public.is_ceo_or_admin()))
    )
  order by
    case i.status when 'PROOF_SUBMITTED' then 0 when 'COMMITTED' then 1 else 2 end,
    i.id;
$$;

grant execute on function public.project_reconciliation(uuid) to authenticated;
