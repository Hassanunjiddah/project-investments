-- Pending invitations only; set projected_profit_minor on commit from project ROI

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

-- Set projected_profit_minor from amount * estimated_roi_bps / 10000 on commit
create or replace function public.commit_invite_investment(
  p_invite_id uuid,
  p_amount_minor bigint
)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites;
  v_project public.projects;
  v_remaining bigint;
  v_investable_max bigint;
  v_projected_profit bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_invite
  from public.invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_invite.investor_id <> auth.uid() then
    raise exception 'Forbidden';
  end if;

  if v_invite.status <> 'ACCEPTED' then
    raise exception 'Investment can only be committed when status is ACCEPTED';
  end if;

  select * into v_project
  from public.projects
  where id = v_invite.project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  v_remaining := v_project.target_minor - v_project.raised_minor;
  if v_remaining < 0 then
    v_remaining := 0;
  end if;

  if v_invite.max_investment_amount_minor is not null then
    v_investable_max := least(v_invite.max_investment_amount_minor, v_remaining);
  else
    v_investable_max := v_remaining;
  end if;

  if p_amount_minor > v_investable_max then
    raise exception 'Amount exceeds the maximum investment available (%)', v_investable_max;
  end if;

  v_projected_profit := round(p_amount_minor::numeric * v_project.estimated_roi_bps / 10000.0)::bigint;

  update public.invites
  set
    status = 'COMMITTED',
    amount_minor = p_amount_minor,
    projected_profit_minor = v_projected_profit,
    updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  return v_invite;
end;
$$;

grant execute on function public.commit_invite_investment(uuid, bigint) to authenticated;
