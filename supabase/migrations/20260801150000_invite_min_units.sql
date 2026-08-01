-- Replace per-invite max ₦ allocation with optional min units (unit subscription model).

alter table public.invites
  add column if not exists min_units integer;

alter table public.invites
  drop constraint if exists invites_min_units_check;

alter table public.invites
  add constraint invites_min_units_check
  check (min_units is null or min_units > 0);

comment on column public.invites.min_units is
  'Optional per-invite floor (units). Enforced as greatest(invite.min_units, project.min_units_per_investor).';

-- pledge_units: honour invite-level min when set
create or replace function public.pledge_units(
  p_invite_id uuid,
  p_units int
)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites;
  v_project public.projects;
  v_unit_price bigint;
  v_units_committed int;
  v_units_available int;
  v_seq int;
  v_expiry_hours int;
  v_amount_minor bigint;
  v_reference text;
  v_min_units int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_units is null or p_units <= 0 then
    raise exception 'Units must be a positive integer';
  end if;

  select * into v_invite
  from public.invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_invite.investor_id <> auth.uid() then
    raise exception 'You cannot act on this invitation';
  end if;

  if v_invite.status not in ('ACCEPTED', 'COMMITTED') then
    raise exception 'Invitation must be Accepted before pledging (current: %)', v_invite.status;
  end if;

  select * into v_project
  from public.projects
  where id = v_invite.project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.total_units is null or v_project.total_units <= 0 then
    raise exception 'Project is not configured for unit-based subscription';
  end if;

  v_min_units := greatest(
    coalesce(v_invite.min_units, 0),
    coalesce(v_project.min_units_per_investor, 1)
  );

  if p_units < v_min_units then
    raise exception 'Minimum % unit(s) required', v_min_units;
  end if;

  v_unit_price := v_project.target_minor / v_project.total_units;
  v_expiry_hours := coalesce(v_project.pledge_expiry_hours, 72);

  -- Compute available units, ignoring this invite's current pledge so
  -- re-pledging (up-sizing) works.
  select coalesce(sum(units_pledged), 0)::int into v_units_committed
  from public.invites
  where project_id = v_project.id
    and id <> p_invite_id
    and status in ('COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED')
    and (pledge_expires_at is null or pledge_expires_at > now() or status = 'CONFIRMED');

  v_units_available := v_project.total_units - v_units_committed;

  if p_units > v_units_available then
    raise exception 'Only % units remaining on this project', v_units_available;
  end if;

  v_amount_minor := p_units::bigint * v_unit_price;

  -- Reuse reference if already generated, else mint a new one.
  if v_invite.payment_reference is not null then
    v_reference := v_invite.payment_reference;
  else
    select coalesce(max(seq), 0) + 1 into v_seq
    from (
      select
        cast(regexp_replace(payment_reference, '^.*-INV(\d+)$', '\1') as int) as seq
      from public.invites
      where project_id = v_project.id
        and payment_reference ~ '-INV\d+$'
    ) t;
    v_reference := format('PRSM-%s-INV%s', v_project.code, lpad(v_seq::text, 3, '0'));
  end if;

  update public.invites
  set
    units_pledged = p_units,
    amount_minor = v_amount_minor,
    payment_reference = v_reference,
    pledged_at = coalesce(pledged_at, now()),
    pledge_expires_at = now() + make_interval(hours => v_expiry_hours),
    status = 'COMMITTED'
  where id = p_invite_id
  returning * into v_invite;

  return v_invite;
end;
$$;

grant execute on function public.pledge_units(uuid, int) to authenticated;

-- Surface min_units on the investor invitations list
drop function if exists public.list_investor_invitations();

create or replace function public.list_investor_invitations()
returns table (
  id uuid,
  project_id uuid,
  investor_id uuid,
  email text,
  status public.invite_status,
  amount_minor bigint,
  projected_profit_minor bigint,
  max_investment_amount_minor bigint,
  min_units integer,
  proof_name text,
  proof_file_name text,
  proof_storage_path text,
  project_name text,
  project_sector text,
  project_banner_storage_path text,
  project_stage public.project_stage,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.project_id,
    i.investor_id,
    i.email,
    i.status,
    i.amount_minor,
    i.projected_profit_minor,
    i.max_investment_amount_minor,
    i.min_units,
    i.proof_name,
    i.proof_file_name,
    i.proof_storage_path,
    p.name as project_name,
    p.sector as project_sector,
    p.banner_storage_path as project_banner_storage_path,
    p.stage as project_stage,
    i.created_at
  from public.invites i
  join public.projects p on p.id = i.project_id
  where i.investor_id = auth.uid()
    and i.status in ('INVITED', 'ACCEPTED', 'COMMITTED', 'PROOF_SUBMITTED')
  order by i.created_at desc;
$$;

grant execute on function public.list_investor_invitations() to authenticated;
