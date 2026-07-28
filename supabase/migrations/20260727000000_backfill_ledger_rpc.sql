-- ---------------------------------------------------------------------------
-- Backfill historical ledger entries
--
-- The P4 ledger triggers (see 20260128000000_p4_ledger.sql) only fire on
-- NEW status transitions. Any invite that reached CONFIRMED or any
-- declaration that reached APPROVED *before* the triggers were installed
-- carries zero ledger entries today.
--
-- This migration installs one permanent, idempotent RPC:
--
--   public.backfill_ledger()  → jsonb with per-bucket count
--
-- It re-plays exactly the same balanced lines the triggers would have
-- posted. Every insert is guarded by a `transaction_ref` existence check,
-- so running the RPC repeatedly is safe.
--
-- Only CEO/ADMIN may execute it (RLS-style guard inside the function).
-- ---------------------------------------------------------------------------

create or replace function public.backfill_ledger()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite       record;
  v_decl         record;
  v_project      public.projects;
  v_lines        jsonb;
  v_investor     record;
  v_residue      bigint;
  v_declared_pool bigint;
  v_actual_pool  bigint;
  v_final_ref    text;
  v_final_lines  jsonb;
  v_confirmed    record;
  v_total_capital bigint;
  v_ref          text;
  v_actor        uuid;
  v_role         text;
  v_c_invites    int := 0;
  v_c_decls      int := 0;
  v_c_finals     int := 0;
begin
  v_actor := auth.uid();

  -- Guard: only CEO / ADMIN may run this. Callable via SQL editor as
  -- service_role too (auth.uid() is NULL then).
  if v_actor is not null then
    select role into v_role from public.profiles where id = v_actor;
    if v_role is null or v_role not in ('CEO', 'ADMIN') then
      raise exception 'backfill_ledger requires CEO or ADMIN role (got %)', coalesce(v_role, 'null');
    end if;
  end if;

  -- ---------------------------------------------------------------
  -- 1. CONFIRMED invites → capital-in ledger pair
  -- ---------------------------------------------------------------
  for v_invite in
    select id, project_id, investor_id, amount_minor, units_allotted, payment_reference
    from public.invites
    where status = 'CONFIRMED'
      and coalesce(amount_minor, 0) > 0
  loop
    v_ref := format('LEDGER-INV-%s', v_invite.id);
    if not exists (select 1 from public.ledger_entries where transaction_ref = v_ref) then
      perform public.post_ledger(
        v_ref, v_invite.project_id, 'invite', v_invite.id, v_actor,
        jsonb_build_array(
          jsonb_build_object('account_code', 'project_bank',
            'direction', 'DR', 'amount_minor', v_invite.amount_minor,
            'memo', format('Backfill · Capital received · %s', coalesce(v_invite.payment_reference, '—'))),
          jsonb_build_object('account_code', 'investor_capital',
            'party_id', v_invite.investor_id::text,
            'direction', 'CR', 'amount_minor', v_invite.amount_minor,
            'memo', format('Backfill · Investor capital subscribed · %s units', coalesce(v_invite.units_allotted, 0)))
        )
      );
      v_c_invites := v_c_invites + 1;
    end if;
  end loop;

  -- ---------------------------------------------------------------
  -- 2. APPROVED declarations → profit recognition + payables
  -- ---------------------------------------------------------------
  for v_decl in
    select * from public.profit_declarations
    where status = 'APPROVED'
  loop
    v_ref := format('LEDGER-DECL-%s', v_decl.id);
    if not exists (select 1 from public.ledger_entries where transaction_ref = v_ref) then
      select * into v_project from public.projects where id = v_decl.project_id;

      v_lines := jsonb_build_array(
        jsonb_build_object('account_code', 'project_realised_pnl',
          'direction', 'DR', 'amount_minor', v_decl.net_amount_minor,
          'memo', format('Backfill · Net profit recognised · %s', v_decl.reference))
      );

      if coalesce(v_decl.platform_fee_minor, 0) > 0 then
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', 'platform_fee_payable',
            'direction', 'CR', 'amount_minor', v_decl.platform_fee_minor,
            'memo', 'Backfill · Prism Capital fee')
        );
      end if;

      if coalesce(v_decl.manager_share_minor, 0) > 0 then
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', 'manager_payable',
            'party_id', v_project.created_by::text,
            'direction', 'CR', 'amount_minor', v_decl.manager_share_minor,
            'memo', 'Backfill · Manager profit share')
        );
      end if;

      for v_investor in
        select investor_id, sum(profit_minor) as amt
        from public.distribution_notices
        where declaration_id = v_decl.id
        group by investor_id
      loop
        if v_investor.amt > 0 then
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_code', 'investor_payable',
              'party_id', v_investor.investor_id::text,
              'direction', 'CR', 'amount_minor', v_investor.amt,
              'memo', format('Backfill · Investor profit · %s', v_decl.reference))
          );
        end if;
      end loop;

      -- Rounding balancer to keep DR/CR balanced
      v_declared_pool := coalesce(v_decl.investor_pool_minor, 0);
      select coalesce(sum(profit_minor), 0) into v_actual_pool
      from public.distribution_notices where declaration_id = v_decl.id;
      v_residue := v_declared_pool - v_actual_pool;
      if v_residue <> 0 then
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object(
            'account_code', 'rounding_reserve',
            'direction', case when v_residue > 0 then 'CR' else 'DR' end,
            'amount_minor', abs(v_residue),
            'memo', 'Backfill · Per-unit rounding residue'
          )
        );
      end if;

      perform public.post_ledger(v_ref, v_decl.project_id, 'declaration', v_decl.id, v_actor, v_lines);
      v_c_decls := v_c_decls + 1;
    end if;

    -- ---------------------------------------------------------------
    -- 3. FINAL declarations → capital return pair (separate ref)
    -- ---------------------------------------------------------------
    if v_decl.is_final then
      v_final_ref := format('LEDGER-FINAL-%s', v_decl.id);
      if not exists (select 1 from public.ledger_entries where transaction_ref = v_final_ref) then
        v_final_lines := '[]'::jsonb;
        v_total_capital := 0;
        for v_confirmed in
          select investor_id, amount_minor from public.invites
          where project_id = v_decl.project_id and status = 'CONFIRMED'
            and coalesce(amount_minor, 0) > 0
        loop
          v_final_lines := v_final_lines || jsonb_build_array(
            jsonb_build_object('account_code', 'investor_capital',
              'party_id', v_confirmed.investor_id::text,
              'direction', 'DR', 'amount_minor', v_confirmed.amount_minor,
              'memo', 'Backfill · Capital returned to investor')
          );
          v_total_capital := v_total_capital + v_confirmed.amount_minor;
        end loop;
        if v_total_capital > 0 then
          v_final_lines := v_final_lines || jsonb_build_array(
            jsonb_build_object('account_code', 'project_bank',
              'direction', 'CR', 'amount_minor', v_total_capital,
              'memo', 'Backfill · Return of capital')
          );
          perform public.post_ledger(v_final_ref, v_decl.project_id, 'declaration', v_decl.id, v_actor, v_final_lines);
          v_c_finals := v_c_finals + 1;
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'invites_backfilled',        v_c_invites,
    'declarations_backfilled',   v_c_decls,
    'final_returns_backfilled',  v_c_finals,
    'executed_at',               now(),
    'actor_id',                  v_actor
  );
end;
$$;

-- Only authenticated users can call — the CEO/ADMIN guard is inside.
revoke all on function public.backfill_ledger() from public;
grant execute on function public.backfill_ledger() to authenticated;

comment on function public.backfill_ledger() is
  'Idempotent one-shot backfill of historical ledger entries for invites and declarations that predate the P4 auto-post triggers. Safe to re-run — every insert is guarded by transaction_ref uniqueness. CEO/ADMIN only.';
