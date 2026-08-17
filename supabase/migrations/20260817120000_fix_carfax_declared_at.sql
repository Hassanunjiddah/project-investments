-- Hotfix Carfax export: profit_declarations has declared_at, not created_at.
-- 2026-08-17

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
        'createdAt', d.declared_at
      ) order by d.declared_at)
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
        'id', pd.id,
        'kind', pd.kind,
        'title', pd.title,
        'fileName', pd.file_name,
        'mimeType', pd.mime_type,
        'amountMinor', pd.amount_minor,
        'note', pd.note,
        'drawdownId', pd.drawdown_id,
        'uploadedBy', pd.uploaded_by,
        'createdAt', pd.created_at
      ) order by pd.created_at)
      from public.project_docs pd
      where pd.project_id = p_project_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.export_project_pack(uuid) to authenticated;
