-- post_ledger inserted lines one INSERT at a time. The statement-level
-- enforce_ledger_balance trigger fired after the first DR-only row and
-- aborted confirm_invite_payment with "Ledger imbalance … CR=0".
-- Insert all lines in a single statement so DR/CR are checked together.

create or replace function public.post_ledger(
  p_transaction_ref text,
  p_project_id uuid,
  p_ref_type text,
  p_ref_id uuid,
  p_actor_id uuid,
  p_lines jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'post_ledger requires at least 2 lines';
  end if;

  insert into public.ledger_entries (
    transaction_ref,
    sequence,
    project_id,
    account_code,
    party_id,
    direction,
    amount_minor,
    actor_id,
    ref_type,
    ref_id,
    memo
  )
  select
    p_transaction_ref,
    ord::smallint,
    p_project_id,
    line->>'account_code',
    nullif(line->>'party_id', '')::uuid,
    line->>'direction',
    (line->>'amount_minor')::bigint,
    p_actor_id,
    p_ref_type,
    p_ref_id,
    line->>'memo'
  from jsonb_array_elements(p_lines) with ordinality as t(line, ord);
end;
$$;

grant execute on function public.post_ledger(text, uuid, text, uuid, uuid, jsonb) to authenticated;
