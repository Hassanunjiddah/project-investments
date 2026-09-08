-- Prism raise fee also accrues when an additional capital raise hits its
-- new target. Previously raise_fee_minor was set once (ACCEPTANCE→PROGRESS)
-- and never increased, so a CEO-approved funding round collected no fee.

comment on column public.projects.raise_fee_minor is
  'Accrued Prism raise fee (kobo). Recalculated as raised × raise_fee_bps whenever raised_minor >= target_minor (original target and later additional raises). Reduces current capital.';

-- Accrue (or top up) the raise fee whenever fundraising is at or past target.
create or replace function public.check_project_progress_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected bigint;
  v_prior bigint;
begin
  if new.raised_minor >= new.target_minor
     and new.approval_status = 'APPROVED'
     and coalesce(new.raise_fee_bps, 0) > 0 then
    v_expected := floor(
      new.raised_minor::numeric * new.raise_fee_bps / 10000.0
    )::bigint;
    v_prior := coalesce(new.raise_fee_minor, 0);
    if v_expected > v_prior then
      new.raise_fee_minor := v_expected;

      -- Subsequent target (additional raise) — original ACCEPTANCE hit
      -- already notifies below. Avoid a duplicate on the first transition.
      if new.stage = 'PROGRESS' and v_prior > 0 then
        if new.created_by is not null then
          perform public.create_notifications(
            array[new.created_by],
            'TARGET_REACHED',
            'Raise target filled',
            coalesce(new.code || ' · ', '') || coalesce(new.name, 'Project')
              || ' hit its current target. Prism raise fee reserved on the extra capital.',
            new.id,
            new.id,
            '/(tabs)/projects/' || new.id || '?tab=capital'
          );
        end if;
        if new.project_owner_id is not null then
          perform public.create_notifications(
            array[new.project_owner_id],
            'TARGET_REACHED',
            'Raise target filled',
            coalesce(new.name, 'Your project')
              || ' has filled its current target. Prism has reserved the raise fee on the extra capital.',
            new.id,
            new.id,
            '/(tabs)/projects/' || new.id
          );
        end if;
      end if;
    end if;
  end if;

  if new.raised_minor >= new.target_minor
     and new.stage = 'ACCEPTANCE'
     and new.approval_status = 'APPROVED' then
    new.stage := 'PROGRESS';
    new.progress_started_at := coalesce(new.progress_started_at, now());

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

-- Post only the incremental fee so a second (or third) target hit ledgers
-- the extra raise fee without rewriting the original entry.
create or replace function public.ledger_on_raise_fee_accrual()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta bigint;
  v_ref text;
begin
  v_delta := coalesce(new.raise_fee_minor, 0) - coalesce(old.raise_fee_minor, 0);
  if v_delta <= 0 then
    return new;
  end if;

  v_ref := format('LEDGER-RAISE-FEE-%s-%s', new.id, new.raise_fee_minor);
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
        'amount_minor', v_delta,
        'memo', format(
          'Prism raise fee reserved (%s%% of raised)',
          round(coalesce(new.raise_fee_bps, 0) / 100.0, 2)
        )
      ),
      jsonb_build_object(
        'account_code', 'platform_fee_payable',
        'direction', 'CR',
        'amount_minor', v_delta,
        'memo', 'Prism raise fee payable'
      )
    )
  );
  return new;
end;
$$;
