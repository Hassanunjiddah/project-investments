-- ---------------------------------------------------------------------------
-- Ledger integrity self-audit
--
-- Installs a permanent, read-only RPC that verifies:
--   1. Every `transaction_ref` in `ledger_entries` has sum(DR) = sum(CR).
--   2. The grand total DR - CR = 0 across the entire book.
--   3. No orphan rows (ref_type set but ref_id null, or ref_id points to a
--      deleted invite / declaration).
--
-- Returns a jsonb payload the CEO Dashboard can render inline. Read-only —
-- moves no money, inserts nothing. Idempotent by definition.
--
-- CEO / ADMIN only.
-- ---------------------------------------------------------------------------

create or replace function public.check_ledger_integrity()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor        uuid;
  v_role         text;
  v_tx_count     int;
  v_row_count    int;
  v_dr_total     bigint;
  v_cr_total     bigint;
  v_imbalanced   jsonb;
  v_orphans      jsonb;
begin
  v_actor := auth.uid();

  -- Role guard (same pattern as backfill_ledger).
  if v_actor is not null then
    select role into v_role from public.profiles where id = v_actor;
    if v_role is null or v_role not in ('CEO', 'ADMIN') then
      raise exception 'check_ledger_integrity requires CEO or ADMIN role (got %)', coalesce(v_role, 'null');
    end if;
  end if;

  -- Overall counts + roll-up.
  select
    count(distinct transaction_ref),
    count(*),
    coalesce(sum(case when direction = 'DR' then amount_minor else 0 end), 0),
    coalesce(sum(case when direction = 'CR' then amount_minor else 0 end), 0)
  into v_tx_count, v_row_count, v_dr_total, v_cr_total
  from public.ledger_entries;

  -- Per-transaction imbalance detection. Any row here is a real bug.
  select coalesce(jsonb_agg(t), '[]'::jsonb)
  into v_imbalanced
  from (
    select
      transaction_ref,
      sum(case when direction = 'DR' then amount_minor else 0 end) as dr_minor,
      sum(case when direction = 'CR' then amount_minor else 0 end) as cr_minor,
      sum(case when direction = 'DR' then amount_minor else 0 end)
        - sum(case when direction = 'CR' then amount_minor else 0 end) as delta_minor,
      min(created_at) as first_posted_at,
      (array_agg(distinct ref_type))[1] as ref_type,
      (array_agg(distinct ref_id))[1] as ref_id
    from public.ledger_entries
    group by transaction_ref
    having sum(case when direction = 'DR' then amount_minor else 0 end)
         <> sum(case when direction = 'CR' then amount_minor else 0 end)
    order by min(created_at) desc
    limit 50
  ) t;

  -- Orphan detection: entries whose ref_id no longer resolves.
  select coalesce(jsonb_agg(o), '[]'::jsonb)
  into v_orphans
  from (
    select
      le.transaction_ref,
      le.ref_type,
      le.ref_id,
      count(*) as row_count
    from public.ledger_entries le
    where le.ref_id is not null
      and (
        (le.ref_type = 'invite'      and not exists (select 1 from public.invites             i  where i.id  = le.ref_id))
        or (le.ref_type = 'declaration' and not exists (select 1 from public.profit_declarations d  where d.id  = le.ref_id))
      )
    group by le.transaction_ref, le.ref_type, le.ref_id
    limit 50
  ) o;

  return jsonb_build_object(
    'transaction_count', v_tx_count,
    'row_count',         v_row_count,
    'total_dr_minor',    v_dr_total,
    'total_cr_minor',    v_cr_total,
    'grand_delta_minor', v_dr_total - v_cr_total,
    'imbalanced',        v_imbalanced,
    'imbalanced_count',  jsonb_array_length(v_imbalanced),
    'orphans',           v_orphans,
    'orphan_count',      jsonb_array_length(v_orphans),
    'balanced',          (v_dr_total = v_cr_total and jsonb_array_length(v_imbalanced) = 0),
    'checked_at',        now(),
    'actor_id',          v_actor
  );
end;
$$;

revoke all on function public.check_ledger_integrity() from public;
grant execute on function public.check_ledger_integrity() to authenticated;

comment on function public.check_ledger_integrity() is
  'Read-only self-audit of the ledger. Returns jsonb with per-tx imbalance list, grand total roll-up, and orphan ref detection. CEO/ADMIN only. Safe to call any time — moves no money.';
