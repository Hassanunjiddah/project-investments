-- Project owner password gate hardening helpers, earnings split (LM = platform
-- fee, owner = manager share), drawdown payout account + capital deduction +
-- ledger/audit on paid.
-- 2026-08-15

-- 1. Payout destination on fund drawdowns ------------------------------------

alter table public.fund_drawdowns
  add column if not exists bank_name text,
  add column if not exists account_name text,
  add column if not exists account_number text;

comment on column public.fund_drawdowns.bank_name is
  'Destination bank for Prism → project owner transfer';
comment on column public.fund_drawdowns.account_number is
  'Destination account number (NUBAN / local)';

-- 2. LM earnings = sum of approved platform fees -----------------------------

drop function if exists public.get_manager_profit_summary(uuid);

create or replace function public.get_manager_profit_summary(p_manager_id uuid default null)
returns table (
  total_realised_profit_minor bigint,
  manager_share_minor bigint,
  platform_fee_minor bigint,
  project_count int
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select coalesce(p_manager_id, auth.uid()) as uid
  ),
  fees as (
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
  )
  select
    coalesce(sum(f.gross_minor), 0)::bigint as total_realised_profit_minor,
    -- Legacy column: Prism LM "earnings" are platform fees (not owner manager share).
    coalesce(sum(f.fee_minor), 0)::bigint as manager_share_minor,
    coalesce(sum(f.fee_minor), 0)::bigint as platform_fee_minor,
    count(*)::int as project_count
  from fees f;
$$;

grant execute on function public.get_manager_profit_summary(uuid) to authenticated;

-- 3. Project owner earnings = approved manager share -------------------------

create or replace function public.get_owner_profit_summary(p_owner_id uuid default null)
returns table (
  total_realised_profit_minor bigint,
  manager_share_minor bigint,
  project_count int
)
language sql
stable
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.get_owner_profit_summary(uuid) to authenticated;

-- Per-project breakdown for earnings screens
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
    group by p.id, p.code, p.name
    having coalesce(sum(d.manager_share_minor), 0) > 0
    order by 5 desc;
  else
    -- platform fee for Prism LM
    return query
    select
      p.id,
      p.code,
      p.name,
      coalesce(sum(d.gross_amount_minor), 0)::bigint,
      coalesce(sum(d.platform_fee_minor), 0)::bigint,
      count(d.id)::int
    from public.projects p
    join public.profit_declarations d on d.project_id = p.id and d.status = 'APPROVED'
    where p.created_by = auth.uid()
    group by p.id, p.code, p.name
    having coalesce(sum(d.platform_fee_minor), 0) > 0
    order by 5 desc;
  end if;
end;
$$;

grant execute on function public.list_earning_breakdown(text) to authenticated;

-- 4. Request drawdown — require payout account --------------------------------

drop function if exists public.request_fund_drawdown(uuid, bigint, text, text);

create or replace function public.request_fund_drawdown(
  p_project_id uuid,
  p_amount_minor bigint,
  p_purpose text,
  p_category text default 'FUND_USE',
  p_bank_name text default null,
  p_account_name text default null,
  p_account_number text default null
)
returns public.fund_drawdowns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_row public.fund_drawdowns;
  v_seq int;
  v_ref text;
  v_cat text;
  v_bank text;
  v_acct_name text;
  v_acct_num text;
  v_reserved bigint;
  v_available bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_purpose is null or char_length(trim(p_purpose)) < 3 then
    raise exception 'Purpose is required';
  end if;

  v_bank := trim(coalesce(p_bank_name, ''));
  v_acct_name := trim(coalesce(p_account_name, ''));
  v_acct_num := regexp_replace(trim(coalesce(p_account_number, '')), '\s+', '', 'g');

  if char_length(v_bank) < 2 then
    raise exception 'Bank name is required so Prism knows where to send funds';
  end if;
  if char_length(v_acct_name) < 2 then
    raise exception 'Account name is required';
  end if;
  if char_length(v_acct_num) < 8 then
    raise exception 'A valid account number is required';
  end if;

  v_cat := coalesce(nullif(trim(p_category), ''), 'FUND_USE');
  if v_cat not in ('FUND_USE', 'RISK_MITIGATION', 'OTHER') then
    raise exception 'Invalid category';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.stage <> 'PROGRESS' then
    raise exception 'Drawdowns are only allowed while the project is in Progress';
  end if;

  if v_project.project_owner_id is distinct from auth.uid() then
    raise exception 'Only the assigned project owner can request a drawdown';
  end if;

  select coalesce(sum(amount_minor), 0) into v_reserved
  from public.fund_drawdowns
  where project_id = p_project_id
    and status in ('PENDING', 'APPROVED');

  v_available := greatest(coalesce(v_project.raised_minor, 0) - v_reserved, 0);
  if p_amount_minor > v_available then
    raise exception 'Amount exceeds available capital (₦% available after pending requests)',
      trim(to_char(v_available / 100.0, 'FM999,999,999,990.00'));
  end if;

  select coalesce(max(
    cast(nullif(regexp_replace(coalesce(reference, ''), '^.*-DD(\d+)$', '\1'), '') as int)
  ), 0) + 1
  into v_seq
  from public.fund_drawdowns
  where project_id = p_project_id;

  v_ref := format('PRSM-%s-DD%s', v_project.code, lpad(v_seq::text, 3, '0'));

  insert into public.fund_drawdowns (
    project_id, requested_by, amount_minor, purpose, category, status, reference,
    bank_name, account_name, account_number
  ) values (
    p_project_id, auth.uid(), p_amount_minor, trim(p_purpose), v_cat, 'PENDING', v_ref,
    v_bank, v_acct_name, v_acct_num
  )
  returning * into v_row;

  if v_project.created_by is not null then
    perform public.create_notifications(
      array[v_project.created_by],
      'DRAWDOWN_REQUESTED',
      'Drawdown request · ' || v_ref,
      coalesce(v_project.name, 'Project') || ' · '
        || trim(to_char(p_amount_minor / 100.0, 'FM999,999,999,990.00'))
        || ' NGN → ' || v_bank || ' ' || v_acct_num,
      p_project_id,
      v_row.id,
      '/(tabs)/projects/' || p_project_id || '?tab=drawdowns'
    );
  end if;

  perform public.log_audit(
    p_project_id,
    'fund_drawdown',
    v_row.id,
    'requested',
    jsonb_build_object(
      'reference', v_ref,
      'amount_minor', p_amount_minor,
      'category', v_cat,
      'bank_name', v_bank,
      'account_name', v_acct_name,
      'account_number', v_acct_num
    ),
    auth.uid()
  );

  perform public.notify_investors_via_edge('DRAWDOWN_REQUESTED', v_row.id);

  return v_row;
end;
$$;

grant execute on function public.request_fund_drawdown(uuid, bigint, text, text, text, text, text) to authenticated;

-- 5. Mark paid — deduct raised capital + ledger + audit ----------------------

create or replace function public.mark_fund_drawdown_paid(p_drawdown_id uuid)
returns public.fund_drawdowns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.fund_drawdowns;
  v_project public.projects;
  v_txn text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from public.fund_drawdowns where id = p_drawdown_id for update;
  if not found then
    raise exception 'Drawdown not found';
  end if;
  if v_row.status <> 'APPROVED' then
    raise exception 'Only approved drawdowns can be marked paid';
  end if;

  select * into v_project from public.projects where id = v_row.project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;
  if v_project.created_by <> auth.uid() and not public.is_ceo_or_admin() then
    raise exception 'Only Prism or CEO can mark a drawdown paid';
  end if;

  if coalesce(v_project.raised_minor, 0) < v_row.amount_minor then
    raise exception 'Insufficient raised capital to pay this drawdown';
  end if;

  if v_row.bank_name is null or v_row.account_number is null then
    raise exception 'Drawdown is missing payout account details';
  end if;

  perform set_config('app.allow_raised_minor_update', 'true', true);

  update public.projects
  set raised_minor = raised_minor - v_row.amount_minor,
      updated_at = now()
  where id = v_row.project_id;

  update public.fund_drawdowns
  set status = 'PAID', updated_at = now()
  where id = p_drawdown_id
  returning * into v_row;

  v_txn := coalesce(v_row.reference, 'DD-' || v_row.id::text) || '-PAID';

  perform public.post_ledger(
    v_txn,
    v_row.project_id,
    'fund_drawdown',
    v_row.id,
    auth.uid(),
    jsonb_build_array(
      jsonb_build_object(
        'account_code', 'capital_deployed',
        'party_id', v_row.requested_by::text,
        'direction', 'DR',
        'amount_minor', v_row.amount_minor,
        'memo', 'Drawdown paid to project owner'
      ),
      jsonb_build_object(
        'account_code', 'project_bank',
        'party_id', null,
        'direction', 'CR',
        'amount_minor', v_row.amount_minor,
        'memo', 'Capital remitted · ' || coalesce(v_row.bank_name, '') || ' ' || coalesce(v_row.account_number, '')
      )
    )
  );

  perform public.log_audit(
    v_row.project_id,
    'fund_drawdown',
    v_row.id,
    'paid',
    jsonb_build_object(
      'reference', v_row.reference,
      'amount_minor', v_row.amount_minor,
      'raised_minor_after', (select raised_minor from public.projects where id = v_row.project_id),
      'bank_name', v_row.bank_name,
      'account_name', v_row.account_name,
      'account_number', v_row.account_number,
      'ledger_txn', v_txn
    ),
    auth.uid()
  );

  return v_row;
end;
$$;

grant execute on function public.mark_fund_drawdown_paid(uuid) to authenticated;

-- Also audit approve/reject decisions
create or replace function public.decide_fund_drawdown(
  p_drawdown_id uuid,
  p_approve boolean,
  p_note text default null
)
returns public.fund_drawdowns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.fund_drawdowns;
  v_project public.projects;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from public.fund_drawdowns where id = p_drawdown_id for update;
  if not found then
    raise exception 'Drawdown not found';
  end if;
  if v_row.status <> 'PENDING' then
    raise exception 'Drawdown is already %', v_row.status;
  end if;

  select * into v_project from public.projects where id = v_row.project_id;
  if v_project.created_by <> auth.uid() and not public.is_ceo_or_admin() then
    raise exception 'Only Prism or CEO can decide a drawdown';
  end if;

  update public.fund_drawdowns
  set
    status = case when p_approve then 'APPROVED' else 'REJECTED' end,
    decided_by = auth.uid(),
    decided_at = now(),
    decision_note = nullif(trim(coalesce(p_note, '')), ''),
    updated_at = now()
  where id = p_drawdown_id
  returning * into v_row;

  perform public.create_notifications(
    array[v_row.requested_by],
    'DRAWDOWN_DECIDED',
    case when p_approve then 'Drawdown approved · ' else 'Drawdown rejected · ' end
      || coalesce(v_row.reference, ''),
    coalesce(v_project.name, 'Project')
      || coalesce(' — ' || v_row.decision_note, ''),
    v_row.project_id,
    v_row.id,
    '/(tabs)/projects/' || v_row.project_id || '?tab=drawdowns'
  );

  perform public.log_audit(
    v_row.project_id,
    'fund_drawdown',
    v_row.id,
    case when p_approve then 'approved' else 'rejected' end,
    jsonb_build_object(
      'reference', v_row.reference,
      'amount_minor', v_row.amount_minor,
      'note', v_row.decision_note,
      'bank_name', v_row.bank_name,
      'account_number', v_row.account_number
    ),
    auth.uid()
  );

  perform public.notify_investors_via_edge('DRAWDOWN_DECIDED', v_row.id);

  return v_row;
end;
$$;

grant execute on function public.decide_fund_drawdown(uuid, boolean, text) to authenticated;

-- 6. Project owners can read ledger rows on their projects -------------------

drop policy if exists ledger_entries_read on public.ledger_entries;
create policy ledger_entries_read on public.ledger_entries
  for select using (
    public.is_ceo_or_admin()
    or exists (
      select 1 from public.projects p
      where p.id = ledger_entries.project_id
        and (p.created_by = auth.uid() or p.project_owner_id = auth.uid())
    )
    or party_id = auth.uid()
  );
