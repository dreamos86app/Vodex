-- P5.2B — Free tier 20 BC in RPC defaults, workspace_id audit on major tables

create or replace function public.plan_monthly_credits(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan
    when 'free' then 20
    when 'starter' then 200
    when 'pro' then 500
    when 'business' then 500
    when 'infinity' then 1000
    when 'enterprise' then 1000
    else 20
  end;
$$;

-- Clamp stale free-plan rows that still exceed the 20 BC allowance
update public.profiles
set
  credits_remaining = least(credits_remaining, 20),
  credits_limit = least(coalesce(credits_limit, 20), 20),
  monthly_token_limit = least(coalesce(monthly_token_limit, 20), 20),
  monthly_credit_limit = least(coalesce(monthly_credit_limit, 20), 20),
  updated_at = now()
where plan_id = 'free'
  and (
    credits_remaining > 20
    or coalesce(credits_limit, 0) > 20
    or coalesce(monthly_token_limit, 0) > 20
    or coalesce(monthly_credit_limit, 0) > 20
  );

-- ── workspace_id backfill helper tables ───────────────────────────────────────

alter table public.credit_events
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

alter table public.token_ledger
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

alter table public.action_credit_events
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

alter table public.runtime_action_usage_logs
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

alter table public.mobile_build_jobs
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

alter table public.ai_usage_logs
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

-- Project-scoped rows: inherit workspace from projects
update public.credit_events t
set workspace_id = p.workspace_id
from public.projects p
where t.project_id = p.id
  and t.workspace_id is null
  and p.workspace_id is not null;

update public.action_credit_events t
set workspace_id = p.workspace_id
from public.projects p
where t.project_id = p.id
  and t.workspace_id is null
  and p.workspace_id is not null;

update public.runtime_action_usage_logs t
set workspace_id = p.workspace_id
from public.projects p
where t.project_id = p.id
  and t.workspace_id is null
  and p.workspace_id is not null;

update public.mobile_build_jobs t
set workspace_id = p.workspace_id
from public.projects p
where t.project_id = p.id
  and t.workspace_id is null
  and p.workspace_id is not null;

update public.ai_usage_logs t
set workspace_id = p.workspace_id
from public.projects p
where t.project_id = p.id
  and t.workspace_id is null
  and p.workspace_id is not null;

update public.app_versions t
set workspace_id = p.workspace_id
from public.projects p
where t.project_id = p.id
  and t.workspace_id is null
  and p.workspace_id is not null;

-- Owner-scoped rows without project: default workspace for owner
update public.credit_events t
set workspace_id = w.id
from public.workspaces w
where t.workspace_id is null
  and t.user_id = w.owner_id;

update public.token_ledger t
set workspace_id = w.id
from public.workspaces w
where t.workspace_id is null
  and t.user_id = w.owner_id;

update public.action_credit_events t
set workspace_id = w.id
from public.workspaces w
where t.workspace_id is null
  and t.owner_user_id = w.owner_id;

update public.runtime_action_usage_logs t
set workspace_id = w.id
from public.workspaces w
where t.workspace_id is null
  and t.owner_user_id = w.owner_id;

update public.mobile_build_jobs t
set workspace_id = w.id
from public.workspaces w
where t.workspace_id is null
  and t.owner_id = w.owner_id;

update public.ai_usage_logs t
set workspace_id = w.id
from public.workspaces w
where t.workspace_id is null
  and t.user_id = w.owner_id;

-- P43 dashboard tables (project-scoped analytics)
alter table public.app_analytics_events
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.app_activity_events
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.app_security_scans
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.app_readiness_scans
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.app_api_keys
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.app_payment_provider_connections
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.app_growth_events
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'app_analytics_events',
    'app_activity_events',
    'app_security_scans',
    'app_readiness_scans',
    'app_api_keys',
    'app_payment_provider_connections',
    'app_growth_events'
  ]
  loop
    execute format(
      'update public.%I t set workspace_id = p.workspace_id from public.projects p where t.project_id = p.id and t.workspace_id is null and p.workspace_id is not null',
      tbl
    );
    execute format(
      'update public.%I t set workspace_id = w.id from public.workspaces w where t.workspace_id is null and t.owner_id = w.owner_id',
      tbl
    );
  end loop;
end;
$$;

create index if not exists idx_credit_events_workspace on public.credit_events(workspace_id);
create index if not exists idx_action_credit_events_workspace on public.action_credit_events(workspace_id);
create index if not exists idx_mobile_build_jobs_workspace on public.mobile_build_jobs(workspace_id);
