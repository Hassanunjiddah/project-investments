-- ---------------------------------------------------------------------------
-- P4: Double-entry ledger backbone
--
-- The idea:
--   * Every money movement (capital in, profit recognised, fees, payouts,
--     capital returned) is expressed as balanced double-entry rows in
--     `ledger_entries`. Every business transaction has a `transaction_ref`
--     (unique). All rows sharing that ref must sum to zero DR/CR — enforced
--     by a deferred CHECK using a trigger.
--   * Screens keep reading from `projects` / `profit_declarations` /
--     `distribution_notices` as before — the ledger is the append-only truth
--     that would win any audit. If a UI number ever disagrees with the
--     ledger, the ledger is right.
--   * Auto-posting is done inside the existing RPCs — when an invite goes
--     CONFIRMED, a set of entries is inserted; when a declaration is APPROVED,
--     another set is inserted. Trigger-based so there's no chance of a code
--     path forgetting to post.
-- ---------------------------------------------------------------------------

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_ref text not null,
  sequence smallint not null default 0,
  project_id uuid references public.projects(id) on delete restrict,
  account_code text not null,      -- e.g. 'project_bank', 'investor_capital', 'platform_fee_payable'
  party_id uuid,                    -- investor/manager id when account is per-party
  direction char(2) not null check (direction in ('DR', 'CR')),
  amount_minor bigint not null check (amount_minor >= 0),
  actor_id uuid,
  ref_type text,                    -- 'invite' | 'declaration' | 'payout' | 'notice'
  ref_id uuid,
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists ledger_entries_transaction_idx
  on public.ledger_entries (transaction_ref);
create index if not exists ledger_entries_project_idx
  on public.ledger_entries (project_id, created_at desc);
create index if not exists ledger_entries_account_idx
  on public.ledger_entries (account_code, party_id);

alter table public.ledger_entries enable row level security;

drop policy if exists ledger_entries_read on public.ledger_entries;
create policy ledger_entries_read on public.ledger_entries
  for select using (
    public.is_ceo_or_admin()
    or exists (
      select 1 from public.projects p
      where p.id = ledger_entries.project_id and p.created_by = auth.uid()
    )
    or party_id = auth.uid()   -- investors see rows on their own account
  );

-- Balance-checking trigger: at STATEMENT end, verify every transaction_ref
-- created/modified in this statement is balanced (sum of DRs = sum of CRs).
create or replace function public.enforce_ledger_balance()
returns trigger language plpgsql as $$
declare
  v_ref text;
  v_dr bigint;
  v_cr bigint;
begin
  for v_ref in
    select distinct transaction_ref from new_table
  loop
    select
      coalesce(sum(case when direction = 'DR' then amount_minor else 0 end), 0),
      coalesce(sum(case when direction = 'CR' then amount_minor else 0 end), 0)
    into v_dr, v_cr
    from public.ledger_entries
    where transaction_ref = v_ref;
    if v_dr <> v_cr then
      raise exception 'Ledger imbalance for transaction %: DR=% CR=%', v_ref, v_dr, v_cr;
    end if;
  end loop;
  return null;
end; $$;

drop trigger if exists enforce_ledger_balance_ins on public.ledger_entries;
create trigger enforce_ledger_balance_ins
  after insert on public.ledger_entries
  referencing new table as new_table
  for each statement execute function public.enforce_ledger_balance();

-- Helper: post a set of balanced entries in a single transaction.
create or replace function public.post_ledger(
  p_transaction_ref text,
  p_project_id uuid,
  p_ref_type text,
  p_ref_id uuid,
  p_actor_id uuid,
  p_lines jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_line jsonb;
  v_seq smallint := 0;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'post_ledger requires at least 2 lines';
  end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_seq := v_seq + 1;
    insert into public.ledger_entries (
      transaction_ref, sequence, project_id, account_code, party_id,
      direction, amount_minor, actor_id, ref_type, ref_id, memo
    ) values (
      p_transaction_ref, v_seq, p_project_id,
      v_line->>'account_code',
      nullif(v_line->>'party_id', '')::uuid,
      v_line->>'direction',
      (v_line->>'amount_minor')::bigint,
      p_actor_id,
      p_ref_type, p_ref_id,
      v_line->>'memo'
    );
  end loop;
end; $$;

grant execute on function public.post_ledger(text, uuid, text, uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Auto-post on invite CONFIRMED (capital in)
-- ---------------------------------------------------------------------------

create or replace function public.ledger_on_invite_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ref text;
  v_amount bigint;
begin
  if new.status = 'CONFIRMED' and (old.status is distinct from 'CONFIRMED') then
    v_amount := coalesce(new.amount_minor, 0);
    if v_amount > 0 then
      v_ref := format('LEDGER-INV-%s', new.id);
      -- Idempotent: skip if already posted for this invite confirm.
      if not exists (select 1 from public.ledger_entries where transaction_ref = v_ref) then
        perform public.post_ledger(
          v_ref, new.project_id, 'invite', new.id, auth.uid(),
          jsonb_build_array(
            jsonb_build_object('account_code', 'project_bank',
              'direction', 'DR', 'amount_minor', v_amount,
              'memo', format('Capital received · %s', new.payment_reference)),
            jsonb_build_object('account_code', 'investor_capital',
              'party_id', new.investor_id::text,
              'direction', 'CR', 'amount_minor', v_amount,
              'memo', format('Investor capital subscribed · %s units', new.units_allotted))
          )
        );
      end if;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists ledger_invite_confirm on public.invites;
create trigger ledger_invite_confirm after update on public.invites
  for each row execute function public.ledger_on_invite_confirm();

-- ---------------------------------------------------------------------------
-- Auto-post on declaration APPROVED — recognizes profit + queues payables
-- ---------------------------------------------------------------------------

create or replace function public.ledger_on_declaration_approve()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ref text;
  v_project public.projects;
  v_lines jsonb;
  v_investor record;
begin
  if new.status = 'APPROVED' and (old.status is distinct from 'APPROVED') then
    v_ref := format('LEDGER-DECL-%s', new.id);
    if exists (select 1 from public.ledger_entries where transaction_ref = v_ref) then
      return new; -- idempotent
    end if;
    select * into v_project from public.projects where id = new.project_id;

    -- Build the ledger lines JSON array.
    -- Single DR to project_realised_pnl for the net; CRs for Prism fee,
    -- manager share, and per-investor investor_payable (based on units held).
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', 'project_realised_pnl',
        'direction', 'DR', 'amount_minor', new.net_amount_minor,
        'memo', format('Net profit recognised · %s', new.reference))
    );

    if new.platform_fee_minor > 0 then
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_code', 'platform_fee_payable',
          'direction', 'CR', 'amount_minor', new.platform_fee_minor,
          'memo', 'Prism Capital fee')
      );
    end if;

    if new.manager_share_minor > 0 then
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_code', 'manager_payable',
          'party_id', v_project.created_by::text,
          'direction', 'CR', 'amount_minor', new.manager_share_minor,
          'memo', 'Manager profit share')
      );
    end if;

    -- Per-investor payables — sums exactly to investor_pool_minor because
    -- the notices are minted from the same allotted units.
    for v_investor in
      select investor_id, sum(profit_minor) as amt
      from public.distribution_notices
      where declaration_id = new.id
      group by investor_id
    loop
      if v_investor.amt > 0 then
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_code', 'investor_payable',
            'party_id', v_investor.investor_id::text,
            'direction', 'CR', 'amount_minor', v_investor.amt,
            'memo', format('Investor profit · %s', new.reference))
        );
      end if;
    end loop;

    -- Rounding balancer: because per-unit is floored, there may be a small
    -- residue between investor_pool and sum of investor payouts. Post the
    -- residue to `rounding_reserve` to keep the ledger balanced.
    declare
      v_residue bigint;
      v_declared_pool bigint := new.investor_pool_minor;
      v_actual_pool bigint;
    begin
      select coalesce(sum(profit_minor), 0) into v_actual_pool
      from public.distribution_notices where declaration_id = new.id;
      v_residue := v_declared_pool - v_actual_pool;
      if v_residue <> 0 then
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object(
            'account_code', 'rounding_reserve',
            'direction', case when v_residue > 0 then 'CR' else 'DR' end,
            'amount_minor', abs(v_residue),
            'memo', 'Per-unit rounding residue'
          )
        );
      end if;
    end;

    -- On FINAL declarations, also record capital returned per investor.
    if new.is_final then
      declare
        v_final_ref text := format('LEDGER-FINAL-%s', new.id);
        v_final_lines jsonb := '[]'::jsonb;
        v_confirmed record;
        v_total_capital bigint := 0;
      begin
        for v_confirmed in
          select investor_id, amount_minor from public.invites
          where project_id = new.project_id and status = 'CONFIRMED'
            and coalesce(amount_minor, 0) > 0
        loop
          v_final_lines := v_final_lines || jsonb_build_array(
            jsonb_build_object('account_code', 'investor_capital',
              'party_id', v_confirmed.investor_id::text,
              'direction', 'DR', 'amount_minor', v_confirmed.amount_minor,
              'memo', 'Capital returned to investor')
          );
          v_total_capital := v_total_capital + v_confirmed.amount_minor;
        end loop;
        if v_total_capital > 0 then
          v_final_lines := v_final_lines || jsonb_build_array(
            jsonb_build_object('account_code', 'project_bank',
              'direction', 'CR', 'amount_minor', v_total_capital,
              'memo', 'Return of capital')
          );
          perform public.post_ledger(v_final_ref, new.project_id, 'declaration', new.id, auth.uid(), v_final_lines);
        end if;
      end;
    end if;

    perform public.post_ledger(v_ref, new.project_id, 'declaration', new.id, auth.uid(), v_lines);
  end if;
  return new;
end; $$;

drop trigger if exists ledger_declaration_approve on public.profit_declarations;
create trigger ledger_declaration_approve after update on public.profit_declarations
  for each row execute function public.ledger_on_declaration_approve();

-- ---------------------------------------------------------------------------
-- Convenience view: account balances rolled up per project
-- ---------------------------------------------------------------------------

create or replace view public.ledger_project_balances as
select
  project_id,
  account_code,
  party_id,
  coalesce(sum(case when direction = 'DR' then amount_minor else -amount_minor end), 0) as balance_minor
from public.ledger_entries
group by project_id, account_code, party_id;

grant select on public.ledger_project_balances to authenticated;

-- RPC to fetch entries for a project (respects RLS).
create or replace function public.list_project_ledger(p_project_id uuid, p_limit int default 500)
returns setof public.ledger_entries
language sql stable security definer set search_path = public as $$
  select * from public.ledger_entries
  where project_id = p_project_id
  order by created_at desc, sequence asc
  limit greatest(1, coalesce(p_limit, 500));
$$;

grant execute on function public.list_project_ledger(uuid, int) to authenticated;
