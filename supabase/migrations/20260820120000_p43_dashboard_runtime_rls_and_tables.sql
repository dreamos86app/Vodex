-- P4.3: Dashboard tables, analytics, activity, security scans, API keys — RLS + grants

-- ─── Grants repair for P4.2 tables ───────────────────────────────────────────
grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on public.custom_domains to authenticated;
grant select, insert, update, delete on public.custom_domains to service_role;

grant select, insert, update, delete on public.app_integration_connections to authenticated;
grant select, insert, update, delete on public.app_integration_connections to service_role;

grant select, insert, update, delete on public.app_auth_provider_settings to authenticated;
grant select, insert, update, delete on public.app_auth_provider_settings to service_role;

grant select, insert, update, delete on public.app_watermark_settings to authenticated;
grant select, insert, update, delete on public.app_watermark_settings to service_role;

grant select, insert, update, delete on public.template_votes to authenticated;
grant select, insert, update, delete on public.template_votes to service_role;

grant select, insert, update on public.published_apps to authenticated;
grant select, insert, update, delete on public.published_apps to service_role;

-- ─── App analytics events ───────────────────────────────────────────────────
create table if not exists public.app_analytics_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null default 'page_view',
  path text,
  referrer text,
  country text,
  device text,
  browser text,
  session_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.app_analytics_events is 'Safe anonymous analytics for published apps';

create index if not exists app_analytics_events_project_created_idx
  on public.app_analytics_events (project_id, created_at desc);
create index if not exists app_analytics_events_owner_idx on public.app_analytics_events (owner_id);

alter table public.app_analytics_events enable row level security;
drop policy if exists "Owners read app analytics" on public.app_analytics_events;
create policy "Owners read app analytics"
  on public.app_analytics_events for select using (auth.uid() = owner_id);
drop policy if exists "Service inserts analytics" on public.app_analytics_events;
create policy "Service inserts analytics"
  on public.app_analytics_events for insert with check (true);

grant select on public.app_analytics_events to authenticated;
grant select, insert, update, delete on public.app_analytics_events to service_role;

-- ─── App activity events (dashboard timeline) ───────────────────────────────
create table if not exists public.app_activity_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  action text not null,
  summary text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.app_activity_events is 'Owner-visible project activity timeline';

create index if not exists app_activity_events_project_created_idx
  on public.app_activity_events (project_id, created_at desc);

alter table public.app_activity_events enable row level security;
drop policy if exists "Owners manage app activity" on public.app_activity_events;
create policy "Owners manage app activity"
  on public.app_activity_events for all using (auth.uid() = owner_id);

grant select, insert on public.app_activity_events to authenticated;
grant select, insert, update, delete on public.app_activity_events to service_role;

-- ─── App security scans ─────────────────────────────────────────────────────
create table if not exists public.app_security_scans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  progress int not null default 0,
  findings jsonb not null default '[]'::jsonb,
  score int,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.app_security_scans is 'Security scan jobs and results for generated apps';

create index if not exists app_security_scans_project_idx
  on public.app_security_scans (project_id, created_at desc);

alter table public.app_security_scans enable row level security;
drop policy if exists "Owners manage security scans" on public.app_security_scans;
create policy "Owners manage security scans"
  on public.app_security_scans for all using (auth.uid() = owner_id);

grant select, insert, update on public.app_security_scans to authenticated;
grant select, insert, update, delete on public.app_security_scans to service_role;

-- ─── App readiness scans (mobile) ───────────────────────────────────────────
create table if not exists public.app_readiness_scans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  progress int not null default 0,
  phase text,
  findings jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.app_readiness_scans is 'Mobile/store readiness scan jobs';

create index if not exists app_readiness_scans_project_idx
  on public.app_readiness_scans (project_id, created_at desc);
create index if not exists app_readiness_scans_status_idx
  on public.app_readiness_scans (project_id, status);

alter table public.app_readiness_scans enable row level security;
drop policy if exists "Owners manage readiness scans" on public.app_readiness_scans;
create policy "Owners manage readiness scans"
  on public.app_readiness_scans for all using (auth.uid() = owner_id);

grant select, insert, update on public.app_readiness_scans to authenticated;
grant select, insert, update, delete on public.app_readiness_scans to service_role;

-- ─── App API keys ───────────────────────────────────────────────────────────
create table if not exists public.app_api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.app_api_keys is 'Generated app API keys (hash only stored)';

create index if not exists app_api_keys_project_idx on public.app_api_keys (project_id);

alter table public.app_api_keys enable row level security;
drop policy if exists "Owners manage app api keys" on public.app_api_keys;
create policy "Owners manage app api keys"
  on public.app_api_keys for all using (auth.uid() = owner_id);

grant select, insert, update, delete on public.app_api_keys to authenticated;
grant select, insert, update, delete on public.app_api_keys to service_role;

-- ─── App payment provider connections ───────────────────────────────────────
create table if not exists public.app_payment_provider_connections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('stripe', 'paddle', 'paypal', 'lemon_squeezy', 'revenuecat')),
  status text not null default 'disconnected',
  secret_ref text,
  metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, provider)
);
comment on table public.app_payment_provider_connections is 'Per-app payment provider connections';

create index if not exists app_payment_provider_connections_project_idx
  on public.app_payment_provider_connections (project_id);

alter table public.app_payment_provider_connections enable row level security;
drop policy if exists "Owners manage payment providers" on public.app_payment_provider_connections;
create policy "Owners manage payment providers"
  on public.app_payment_provider_connections for all using (auth.uid() = owner_id);

grant select, insert, update, delete on public.app_payment_provider_connections to authenticated;
grant select, insert, update, delete on public.app_payment_provider_connections to service_role;

-- ─── App user profiles (end-user signups) ───────────────────────────────────
create table if not exists public.app_user_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  auth_provider text,
  last_seen_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.app_user_profiles is 'End users of published generated apps';

create index if not exists app_user_profiles_project_idx on public.app_user_profiles (project_id, created_at desc);

alter table public.app_user_profiles enable row level security;
drop policy if exists "Owners read app users" on public.app_user_profiles;
create policy "Owners read app users"
  on public.app_user_profiles for select using (auth.uid() = owner_id);
drop policy if exists "Service manages app users" on public.app_user_profiles;
create policy "Service manages app users"
  on public.app_user_profiles for all using (true);

grant select on public.app_user_profiles to authenticated;
grant select, insert, update, delete on public.app_user_profiles to service_role;

-- ─── App growth events ──────────────────────────────────────────────────────
create table if not exists public.app_growth_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  channel text not null,
  action text not null default 'click',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.app_growth_events is 'Share link and growth channel tracking';

create index if not exists app_growth_events_project_idx on public.app_growth_events (project_id, created_at desc);

alter table public.app_growth_events enable row level security;
drop policy if exists "Owners read growth events" on public.app_growth_events;
create policy "Owners read growth events"
  on public.app_growth_events for select using (auth.uid() = owner_id);

grant select, insert on public.app_growth_events to authenticated;
grant select, insert, update, delete on public.app_growth_events to service_role;

-- ─── Imported route manifest column on projects metadata (via comment) ────────
comment on column public.projects.metadata is 'Includes discovered_routes[], preview_artifact_path, import_manifest';

notify pgrst, 'reload schema';
