-- Enrich list_investor_invitations with project card fields

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
  order by i.created_at desc;
$$;

grant execute on function public.list_investor_invitations() to authenticated;
