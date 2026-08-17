-- Professional drawdowns (required support doc) + Carfax export_project_pack.
-- 2026-08-17

-- 1. Link supporting evidence to fund drawdowns --------------------------------

alter table public.fund_drawdowns
  add column if not exists support_doc_id uuid
    references public.project_docs (id) on delete set null;

create index if not exists fund_drawdowns_support_doc_idx
  on public.fund_drawdowns (support_doc_id)
  where support_doc_id is not null;

comment on column public.fund_drawdowns.support_doc_id is
  'Required FUND_USE project_docs evidence (invoice/quote/receipt) for the remittance request.';

alter table public.project_docs
  add column if not exists drawdown_id uuid
    references public.fund_drawdowns (id) on delete set null;

create index if not exists project_docs_drawdown_idx
  on public.project_docs (drawdown_id)
  where drawdown_id is not null;

-- 2. Request drawdown — require support document -------------------------------

create or replace function public.request_fund_drawdown(
  p_project_id uuid,
  p_amount_minor bigint,
  p_purpose text,
  p_category text default 'FUND_USE',
  p_bank_name text default null,
  p_account_name text default null,
  p_account_number text default null,
  p_support_doc_id uuid default null
)
returns public.fund_drawdowns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_row public.fund_drawdowns;
  v_doc public.project_docs;
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

  if p_purpose is null or char_length(trim(p_purpose)) < 20 then
    raise exception 'Provide a detailed purpose (at least 20 characters) for this remittance';
  end if;

  if p_support_doc_id is null then
    raise exception 'A supporting document (invoice, quote, or receipt) is required';
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

  select * into v_doc from public.project_docs where id = p_support_doc_id;
  if not found then
    raise exception 'Supporting document not found';
  end if;
  if v_doc.project_id <> p_project_id then
    raise exception 'Supporting document must belong to this project';
  end if;
  if v_doc.kind <> 'FUND_USE' then
    raise exception 'Supporting document must be a Fund use file (invoice, quote, or receipt)';
  end if;
  if coalesce(nullif(trim(v_doc.storage_path), ''), '') = '' then
    raise exception 'Supporting document is missing its file';
  end if;
  if v_doc.uploaded_by is distinct from auth.uid()
     and v_project.project_owner_id is distinct from auth.uid() then
    raise exception 'Supporting document must be uploaded by the project owner';
  end if;
  if exists (
    select 1 from public.fund_drawdowns
    where support_doc_id = p_support_doc_id
      and status in ('PENDING', 'APPROVED', 'PAID')
  ) then
    raise exception 'That supporting document is already linked to another remittance request';
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
    bank_name, account_name, account_number, support_doc_id
  ) values (
    p_project_id, auth.uid(), p_amount_minor, trim(p_purpose), v_cat, 'PENDING', v_ref,
    v_bank, v_acct_name, v_acct_num, p_support_doc_id
  )
  returning * into v_row;

  update public.project_docs
  set drawdown_id = v_row.id,
      amount_minor = coalesce(amount_minor, p_amount_minor),
      updated_at = now()
  where id = p_support_doc_id;

  if v_project.created_by is not null then
    perform public.create_notifications(
      array[v_project.created_by],
      'DRAWDOWN_REQUESTED',
      'Fund remittance · ' || v_ref,
      coalesce(v_project.name, 'Project') || ' · '
        || trim(to_char(p_amount_minor / 100.0, 'FM999,999,999,990.00'))
        || ' NGN → ' || v_bank || ' ' || v_acct_num
        || ' · evidence: ' || coalesce(v_doc.title, v_doc.file_name),
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
      'support_doc_id', p_support_doc_id,
      'support_doc_title', v_doc.title,
      'current_capital_before', v_current
    ),
    auth.uid()
  );

  perform public.notify_investors_via_edge('DRAWDOWN_REQUESTED', v_row.id);

  return v_row;
end;
$$;

grant execute on function public.request_fund_drawdown(uuid, bigint, text, text, text, text, text, uuid) to authenticated;

-- Keep older 7-arg overload callable but force the support-doc requirement
-- by routing through the new body (callers that omit doc will fail validation).
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
begin
  return public.request_fund_drawdown(
    p_project_id,
    p_amount_minor,
    p_purpose,
    p_category,
    p_bank_name,
    p_account_name,
    p_account_number,
    null
  );
end;
$$;

grant execute on function public.request_fund_drawdown(uuid, bigint, text, text, text, text, text) to authenticated;

-- 3. Carfax export pack -------------------------------------------------------

create or replace function public.export_project_pack(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_project public.projects;
  v_result jsonb;
  v_current bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_project from public.projects where id = p_project_id;
  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.created_by <> auth.uid()
     and v_project.project_owner_id is distinct from auth.uid()
     and not public.is_ceo_or_admin() then
    raise exception 'Not allowed to export this project';
  end if;

  v_current := greatest(
    coalesce(v_project.raised_minor, 0)
      - coalesce(v_project.raise_fee_minor, 0)
      - coalesce(v_project.drawn_minor, 0),
    0
  );

  select jsonb_build_object(
    'exportedAt', now(),
    'project', jsonb_build_object(
      'id', v_project.id,
      'code', v_project.code,
      'name', v_project.name,
      'sector', v_project.sector,
      'location', v_project.location,
      'stage', v_project.stage,
      'approvalStatus', v_project.approval_status,
      'targetMinor', v_project.target_minor,
      'raisedMinor', v_project.raised_minor,
      'drawnMinor', coalesce(v_project.drawn_minor, 0),
      'raiseFeeBps', v_project.raise_fee_bps,
      'raiseFeeMinor', coalesce(v_project.raise_fee_minor, 0),
      'currentCapitalMinor', v_current,
      'totalUnits', v_project.total_units,
      'platformFeeBps', v_project.platform_fee_bps,
      'profitSplitInvestorBps', v_project.profit_split_investor_bps,
      'realisedProfitMinor', coalesce(v_project.realised_profit_minor, 0),
      'createdBy', v_project.created_by,
      'projectOwnerId', v_project.project_owner_id,
      'progressStartedAt', v_project.progress_started_at,
      'createdAt', v_project.created_at
    ),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'email', i.email,
        'status', i.status,
        'unitsPledged', i.units_pledged,
        'unitsAllotted', i.units_allotted,
        'amountMinor', i.amount_minor,
        'paymentReference', i.payment_reference,
        'minUnits', i.min_units,
        'minWaiverStatus', i.min_waiver_status,
        'investorId', i.investor_id,
        'pledgedAt', i.pledged_at,
        'verifiedAt', i.verified_at,
        'createdAt', i.created_at
      ) order by i.created_at)
      from public.invites i where i.project_id = p_project_id
    ), '[]'::jsonb),
    'declarations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'reference', d.reference,
        'status', d.status,
        'label', d.label,
        'isFinal', d.is_final,
        'grossMinor', d.gross_amount_minor,
        'costsMinor', d.costs_minor,
        'netMinor', d.net_amount_minor,
        'platformFeeBps', d.platform_fee_bps,
        'platformFeeMinor', d.platform_fee_minor,
        'distributableMinor', d.distributable_minor,
        'investorPoolMinor', d.investor_pool_minor,
        'managerShareMinor', d.manager_share_minor,
        'perUnitMinor', d.per_unit_minor,
        'declaredAt', d.declared_at,
        'approvedAt', d.approved_at,
        'createdAt', d.created_at
      ) order by d.created_at)
      from public.profit_declarations d where d.project_id = p_project_id
    ), '[]'::jsonb),
    'drawdowns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'reference', f.reference,
        'status', f.status,
        'amountMinor', f.amount_minor,
        'purpose', f.purpose,
        'category', f.category,
        'bankName', f.bank_name,
        'accountName', f.account_name,
        'accountNumber', f.account_number,
        'supportDocId', f.support_doc_id,
        'supportDocTitle', doc.title,
        'supportDocFileName', doc.file_name,
        'decidedBy', f.decided_by,
        'decidedAt', f.decided_at,
        'decisionNote', f.decision_note,
        'requestedBy', f.requested_by,
        'createdAt', f.created_at
      ) order by f.created_at)
      from public.fund_drawdowns f
      left join public.project_docs doc on doc.id = f.support_doc_id
      where f.project_id = p_project_id
    ), '[]'::jsonb),
    'withdrawals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id,
        'reference', w.reference,
        'status', w.status,
        'amountMinor', w.amount_minor,
        'investorId', w.investor_id,
        'inviteId', w.invite_id,
        'decidedBy', w.decided_by,
        'decidedAt', w.decided_at,
        'decisionNote', w.decision_note,
        'createdAt', w.created_at
      ) order by w.created_at)
      from public.withdrawal_requests w where w.project_id = p_project_id
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'entityType', a.entity_type,
        'entityId', a.entity_id,
        'eventType', a.event_type,
        'actorId', a.actor_id,
        'context', a.context,
        'createdAt', a.created_at
      ) order by a.created_at desc)
      from (
        select * from public.audit_events
        where project_id = p_project_id
        order by created_at desc
        limit 500
      ) a
    ), '[]'::jsonb),
    'ledger', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'transactionRef', l.transaction_ref,
        'sequence', l.sequence,
        'accountCode', l.account_code,
        'partyId', l.party_id,
        'direction', l.direction,
        'amountMinor', l.amount_minor,
        'memo', l.memo,
        'refType', l.ref_type,
        'refId', l.ref_id,
        'createdAt', l.created_at
      ) order by l.created_at, l.sequence)
      from public.ledger_entries l
      where l.project_id = p_project_id
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'kind', d.kind,
        'title', d.title,
        'fileName', d.file_name,
        'mimeType', d.mime_type,
        'amountMinor', d.amount_minor,
        'note', d.note,
        'drawdownId', d.drawdown_id,
        'uploadedBy', d.uploaded_by,
        'createdAt', d.created_at
      ) order by d.created_at)
      from public.project_docs d
      where d.project_id = p_project_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.export_project_pack(uuid) to authenticated;
