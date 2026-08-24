-- Expected cadence for declaring / distributing realised profit.

do $$ begin
  create type public.profit_declaration_frequency as enum (
    'DAILY',
    'MONTHLY',
    'QUARTERLY',
    'SEMI_ANNUAL',
    'YEARLY'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.projects
  add column if not exists profit_declaration_frequency
    public.profit_declaration_frequency not null default 'MONTHLY';

comment on column public.projects.profit_declaration_frequency is
  'How often the project intends to declare realised profit (daily / monthly / quarterly / semi-annual / yearly).';
