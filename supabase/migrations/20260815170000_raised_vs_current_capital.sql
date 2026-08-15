-- Capital raised stays cumulative (never reduced by drawdowns).
-- drawn_minor tracks paid remittances; current capital = raised - drawn.
-- 2026-08-15

alter table public.projects
  add column if not exists drawn_minor bigint not null default 0
    check (drawn_minor >= 0);

comment on column public.projects.drawn_minor is
  'Cumulative fund drawdowns marked PAID. Current capital = raised_minor - drawn_minor.';

-- Restore raised that was incorrectly reduced on paid drawdowns, and backfill drawn.
do $$
declare
  r record;
  v_paid bigint;
begin
  for r in select id, raised_minor from public.projects loop
    select coalesce(sum(amount_minor), 0) into v_paid
    from public.fund_drawdowns
    where project_id = r.id and status = 'PAID';

    if v_paid > 0 then
      perform set_config('app.allow_raised_minor_update', 'true', true);
      update public.projects
      set
        drawn_minor = v_paid,
        -- Re-add amounts previously deducted from raised_minor on mark-paid.
        raised_minor = raised_minor + v_paid,
        updated_at = now()
      where id = r.id;
    end if;
  end loop;
end $$;

-- Request: availability uses current capital (raised - drawn - reserved)
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

  v_current := greatest(coalesce(v_project.raised_minor, 0) - coalesce(v_project.drawn_minor, 0), 0);
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
      'current_capital_before', v_current
    ),
    auth.uid()
  );

  perform public.notify_investors_via_edge('DRAWDOWN_REQUESTED', v_row.id);

  return v_row;
end;
$$;

grant execute on function public.request_fund_drawdown(uuid, bigint, text, text, text, text, text) to authenticated;

-- Mark paid: increase drawn_minor only — never touch raised_minor
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

  v_current := greatest(coalesce(v_project.raised_minor, 0) - coalesce(v_project.drawn_minor, 0), 0);
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
      'drawn_minor', (select drawn_minor from public.projects where id = v_row.project_id),
      'current_capital_after', (
        select greatest(raised_minor - drawn_minor, 0)
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
