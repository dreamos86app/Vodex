-- P5.0: Idempotent runtime repair for production certification data checks

grant usage on schema public to authenticated, service_role;

-- P4.5 profile sync columns (safe if already applied)
alter table public.app_user_profiles
  add column if not exists auth_user_id uuid,
  add column if not exists published_app_id uuid,
  add column if not exists first_seen_at timestamptz;

alter table public.app_user_profiles
  drop constraint if exists app_user_profiles_project_auth_user_unique;

alter table public.app_user_profiles
  add constraint app_user_profiles_project_auth_user_unique unique (project_id, auth_user_id);

create index if not exists app_user_profiles_auth_user_idx
  on public.app_user_profiles (auth_user_id);

grant select on public.app_user_profiles to authenticated;
grant select, insert, update, delete on public.app_user_profiles to service_role;

-- P4.7 payment events (safe if already applied)
create table if not exists public.app_payment_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  published_app_id uuid references public.published_apps (id) on delete set null,
  payment_provider text not null,
  event_type text not null,
  amount_cents bigint,
  currency text,
  customer_id_hash text,
  subscription_id_hash text,
  mode text not null default 'sandbox' check (mode in ('sandbox', 'live', 'mock')),
  meta jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists app_payment_events_project_idx
  on public.app_payment_events (project_id, occurred_at desc);

alter table public.app_payment_events enable row level security;

drop policy if exists "Owners read app payment events" on public.app_payment_events;
create policy "Owners read app payment events"
  on public.app_payment_events for select using (auth.uid() = owner_id);

grant select on public.app_payment_events to authenticated;
grant select, insert, update, delete on public.app_payment_events to service_role;

-- Analytics events grants (certification probes service_role read)
grant select, insert, update, delete on public.app_analytics_events to service_role;

-- Integration harness columns (P4.7)
alter table public.app_integration_connections
  add column if not exists mode text not null default 'disconnected',
  add column if not exists last_test_status text,
  add column if not exists last_test_at timestamptz,
  add column if not exists last_error text,
  add column if not exists connection_health text not null default 'unknown',
  add column if not exists webhook_status text not null default 'unknown';

grant select, insert, update, delete on public.app_integration_connections to service_role;

-- Auth diagnostics columns (P4.6)
alter table public.app_auth_provider_settings
  add column if not exists last_auth_error text,
  add column if not exists last_auth_error_at timestamptz;

notify pgrst, 'reload schema';
