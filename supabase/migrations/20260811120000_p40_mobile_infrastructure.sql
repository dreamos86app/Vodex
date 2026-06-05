-- P4.0 — Real mobile infrastructure (production apply bundle)
-- Creates mobile tables if missing + P4 columns + builder queue RPCs

-- ─── mobile_app_configs ───────────────────────────────────────────────────────
create table if not exists public.mobile_app_configs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  platforms text[] not null default '{}'::text[],
  wrapper_type text not null default 'capacitor'
    check (wrapper_type in ('capacitor', 'twa')),
  app_name text,
  short_name text,
  app_description text,
  package_id text,
  bundle_id text,
  theme_color text default '#6366f1',
  version_name text not null default '0.0.1',
  android_version_code int not null default 1 check (android_version_code >= 1),
  ios_build_number int not null default 1 check (ios_build_number >= 1),
  permissions jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  store_draft jsonb not null default '{}'::jsonb,
  icon_url text,
  splash_url text,
  readiness_android int,
  readiness_ios int,
  readiness_store int,
  meta jsonb not null default '{}'::jsonb,
  splash jsonb not null default '{}'::jsonb,
  sha_keys jsonb not null default '{}'::jsonb,
  revenuecat jsonb not null default '{}'::jsonb,
  play_store jsonb not null default '{}'::jsonb,
  app_store jsonb not null default '{}'::jsonb,
  readiness_state jsonb not null default '{}'::jsonb,
  unique (project_id)
);

alter table public.mobile_app_configs
  add column if not exists splash jsonb not null default '{}'::jsonb,
  add column if not exists sha_keys jsonb not null default '{}'::jsonb,
  add column if not exists revenuecat jsonb not null default '{}'::jsonb,
  add column if not exists play_store jsonb not null default '{}'::jsonb,
  add column if not exists app_store jsonb not null default '{}'::jsonb,
  add column if not exists readiness_state jsonb not null default '{}'::jsonb;

create index if not exists mobile_app_configs_owner_idx on public.mobile_app_configs (owner_id);

drop trigger if exists mobile_app_configs_updated_at on public.mobile_app_configs;
create trigger mobile_app_configs_updated_at
  before update on public.mobile_app_configs
  for each row execute function public.set_updated_at();

alter table public.mobile_app_configs enable row level security;
drop policy if exists "mobile_app_configs: own" on public.mobile_app_configs;
create policy "mobile_app_configs: own"
  on public.mobile_app_configs for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ─── mobile_build_jobs ────────────────────────────────────────────────────────
create table if not exists public.mobile_build_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  wrapper_type text not null default 'capacitor'
    check (wrapper_type in ('capacitor', 'twa')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'success', 'failed', 'cancelled', 'requires_builder_config')),
  build_type text
    check (build_type is null or build_type in ('apk', 'aab', 'wrapper_zip', 'ipa', 'xcarchive', 'zip')),
  artifact_type text
    check (artifact_type is null or artifact_type in ('apk', 'aab', 'ipa', 'xcarchive', 'zip', 'wrapper_zip')),
  version_name text,
  version_code int,
  artifact_url text,
  logs text,
  error_code text,
  error_message text,
  builder_id text,
  locked_at timestamptz,
  locked_by text,
  attempts int not null default 0,
  action_credits_charged numeric(10, 2) not null default 0,
  provider_cost_usd numeric(12, 6),
  meta jsonb not null default '{}'::jsonb
);

alter table public.mobile_build_jobs
  add column if not exists build_type text,
  add column if not exists builder_id text,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists attempts int not null default 0;

create index if not exists mobile_build_jobs_project_idx
  on public.mobile_build_jobs (project_id, created_at desc);
create index if not exists mobile_build_jobs_owner_idx
  on public.mobile_build_jobs (owner_id, created_at desc);
create index if not exists mobile_build_jobs_status_idx
  on public.mobile_build_jobs (status, created_at asc)
  where status in ('queued', 'running');

drop trigger if exists mobile_build_jobs_updated_at on public.mobile_build_jobs;
create trigger mobile_build_jobs_updated_at
  before update on public.mobile_build_jobs
  for each row execute function public.set_updated_at();

alter table public.mobile_build_jobs enable row level security;
drop policy if exists "mobile_build_jobs: own" on public.mobile_build_jobs;
create policy "mobile_build_jobs: own"
  on public.mobile_build_jobs for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ─── mobile_readiness_checks ──────────────────────────────────────────────────
create table if not exists public.mobile_readiness_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('general', 'android', 'ios', 'store')),
  score int not null default 0 check (score >= 0 and score <= 100),
  items jsonb not null default '[]'::jsonb,
  action_credits_charged numeric(10, 2) not null default 0,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists mobile_readiness_checks_project_idx
  on public.mobile_readiness_checks (project_id, created_at desc);

alter table public.mobile_readiness_checks enable row level security;
drop policy if exists "mobile_readiness_checks: own" on public.mobile_readiness_checks;
create policy "mobile_readiness_checks: own"
  on public.mobile_readiness_checks for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ─── mobile_publish_attempts ──────────────────────────────────────────────────
create table if not exists public.mobile_publish_attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'success', 'failed', 'manual_required', 'not_configured')),
  error_message text,
  action_credits_charged numeric(10, 2) not null default 0,
  provider_cost_usd numeric(12, 6),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists mobile_publish_attempts_project_idx
  on public.mobile_publish_attempts (project_id, created_at desc);

alter table public.mobile_publish_attempts enable row level security;
drop policy if exists "mobile_publish_attempts: own" on public.mobile_publish_attempts;
create policy "mobile_publish_attempts: own"
  on public.mobile_publish_attempts for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ─── android builder heartbeats ───────────────────────────────────────────────
create table if not exists public.android_builder_heartbeats (
  builder_id text primary key,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version text,
  host text,
  status text not null default 'online'
    check (status in ('online', 'offline', 'degraded'))
);

alter table public.android_builder_heartbeats enable row level security;
drop policy if exists android_builder_heartbeats_service on public.android_builder_heartbeats;
create policy android_builder_heartbeats_service on public.android_builder_heartbeats
  for all using (false);

-- ─── claim mobile build job (service role) ────────────────────────────────────
create or replace function public.claim_mobile_build_job(
  p_builder_id text,
  p_stale_lock_minutes int default 45
)
returns public.mobile_build_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.mobile_build_jobs;
  v_stale interval;
begin
  if p_builder_id is null or length(trim(p_builder_id)) = 0 then
    raise exception 'builder_id required';
  end if;

  v_stale := make_interval(mins => greatest(p_stale_lock_minutes, 10));

  with candidate as (
    select id
    from public.mobile_build_jobs
    where status = 'queued'
      and platform = 'android'
      and build_type in ('apk', 'aab')
      and (
        locked_at is null
        or locked_at < now() - v_stale
      )
    order by created_at asc
    limit 1
    for update skip locked
  )
  update public.mobile_build_jobs j
  set
    status = 'running',
    locked_at = now(),
    locked_by = p_builder_id,
    builder_id = p_builder_id,
    updated_at = now(),
    attempts = j.attempts + 1
  from candidate c
  where j.id = c.id
  returning j.* into v_job;

  return v_job;
end;
$$;

revoke all on function public.claim_mobile_build_job(text, int) from public;
grant execute on function public.claim_mobile_build_job(text, int) to service_role;

-- ─── service role table access ────────────────────────────────────────────────
grant select, insert, update on public.mobile_build_jobs to service_role;
grant select, insert, update on public.mobile_app_configs to service_role;
grant select, insert, update on public.mobile_readiness_checks to service_role;
grant select, insert, update on public.mobile_publish_attempts to service_role;
grant all on public.android_builder_heartbeats to service_role;

notify pgrst, 'reload schema';
