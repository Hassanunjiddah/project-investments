-- Dual Prism fees: raise fee (% of capital raised at target hit) + existing
-- profit platform fee. Current capital = raised - raise_fee - drawn.
-- 2026-08-17

-- 1. Columns -----------------------------------------------------------------

alter table public.projects
  add column if not exists raise_fee_bps int default 250,
  add column if not exists raise_fee_minor bigint not null default 0
    check (raise_fee_minor >= 0);

alter table public.projects
  drop constraint if exists projects_raise_fee_bps_range;

alter table public.projects
  add constraint projects_raise_fee_bps_range
    check (raise_fee_bps is null or (raise_fee_bps >= 0 and raise_fee_bps <= 10000));

comment on column public.projects.raise_fee_bps is
  'Prism raise fee in bps of capital raised, reserved when fundraising target is hit.';
comment on column public.projects.raise_fee_minor is
  'Accrued raise fee (kobo). Set once at ACCEPTANCE→PROGRESS; reduces current capital.';
comment on column public.projects.drawn_minor is
  'Cumulative fund drawdowns marked PAID. Current capital = raised_minor - raise_fee_minor - drawn_minor.';

-- 2. Accrue raise fee when target is reached ---------------------------------

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

    -- Reserve raise fee once from capital raised (does not change raised_minor).
    if coalesce(new.raise_fee_minor, 0) = 0
       and coalesce(new.raise_fee_bps, 0) > 0 then
      new.raise_fee_minor := floor(
        new.raised_minor::numeric * new.raise_fee_bps / 10000.0
      )::bigint;
    end if;

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

-- 3. Ledger raise fee on accrual (AFTER UPDATE) ------------------------------

create or replace function public.ledger_on_raise_fee_accrual()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
begin
  if coalesce(new.raise_fee_minor, 0) > 0
     and coalesce(old.raise_fee_minor, 0) = 0 then
    v_ref := format('LEDGER-RAISE-FEE-%s', new.id);
    if exists (select 1 from public.ledger_entries where transaction_ref = v_ref) then
      return new;
    end if;

    perform public.post_ledger(
      v_ref,
      new.id,
      'raise_fee',
      new.id,
      coalesce(auth.uid(), new.created_by),
      jsonb_build_array(
        jsonb_build_object(
          'account_code', 'project_bank',
          'direction', 'DR',
          'amount_minor', new.raise_fee_minor,
          'memo', format(
            'Prism raise fee reserved (%s%% of raised)',
            round(coalesce(new.raise_fee_bps, 0) / 100.0, 2)
          )
        ),
        jsonb_build_object(
          'account_code', 'platform_fee_payable',
          'direction', 'CR',
          'amount_minor', new.raise_fee_minor,
          'memo', 'Prism raise fee payable'
        )
      )
    );
  end if;
  return new;
end;
$$;

-- Must be AFTER UPDATE (not OF raise_fee_minor): the fee is set on NEW inside
-- check_project_progress_transition during a raised_minor UPDATE, so OF-list
-- triggers would not fire.
drop trigger if exists ledger_raise_fee_accrual on public.projects;
create trigger ledger_raise_fee_accrual
  after update on public.projects
  for each row
  execute function public.ledger_on_raise_fee_accrual();

-- 4. Drawdowns: current capital = raised - raise_fee - drawn -----------------

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
  v_current bigint;
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

  v_current := greatest(
    coalesce(v_project.raised_minor, 0)
      - coalesce(v_project.raise_fee_minor, 0)
      - coalesce(v_project.drawn_minor, 0),
    0
  );
  v_available := greatest(v_current - v_reserved, 0);
  if p_amount_minor > v_available then
    raise exception 'Amount exceeds current capital available (₦% after pending requests)',
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
      'account_number', v_acct_num,
      'current_capital_before', v_current,
      'raise_fee_minor', coalesce(v_project.raise_fee_minor, 0)
    ),
    auth.uid()
  );

  perform public.notify_investors_via_edge('DRAWDOWN_REQUESTED', v_row.id);

  return v_row;
end;
$$;

grant execute on function public.request_fund_drawdown(uuid, bigint, text, text, text, text, text) to authenticated;

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
  v_current bigint;
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

  v_current := greatest(
    coalesce(v_project.raised_minor, 0)
      - coalesce(v_project.raise_fee_minor, 0)
      - coalesce(v_project.drawn_minor, 0),
    0
  );
  if v_current < v_row.amount_minor then
    raise exception 'Insufficient current capital to pay this drawdown';
  end if;

  if v_row.bank_name is null or v_row.account_number is null then
    raise exception 'Drawdown is missing payout account details';
  end if;

  update public.projects
  set drawn_minor = coalesce(drawn_minor, 0) + v_row.amount_minor,
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
      'raised_minor', (select raised_minor from public.projects where id = v_row.project_id),
      'raise_fee_minor', (select raise_fee_minor from public.projects where id = v_row.project_id),
      'drawn_minor', (select drawn_minor from public.projects where id = v_row.project_id),
      'current_capital_after', (
        select greatest(raised_minor - coalesce(raise_fee_minor, 0) - drawn_minor, 0)
        from public.projects where id = v_row.project_id
      ),
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

-- 5. LM earnings include raise fees ------------------------------------------

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
$$;

grant execute on function public.get_manager_profit_summary(uuid) to authenticated;

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
    -- Platform fees = approved profit fees + accrued raise fees
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
    group by p.id, p.code, p.name, p.raise_fee_minor
    having (
      coalesce(sum(d.platform_fee_minor), 0)
      + coalesce(p.raise_fee_minor, 0)
    ) > 0
    order by 5 desc;
  end if;
end;
$$;

grant execute on function public.list_earning_breakdown(text) to authenticated;
