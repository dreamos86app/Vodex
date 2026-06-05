-- P4.7: Integration test harness columns + app payment events

alter table public.app_integration_connections
  add column if not exists mode text not null default 'disconnected',
  add column if not exists last_test_status text,
  add column if not exists last_test_at timestamptz,
  add column if not exists last_error text,
  add column if not exists connection_health text not null default 'unknown',
  add column if not exists webhook_status text not null default 'unknown';

comment on column public.app_integration_connections.mode is 'disconnected | connected_mock | connected_sandbox | connected_live | error';

alter table public.app_integration_connections
  drop constraint if exists app_integration_connections_provider_check;

alter table public.app_integration_connections
  add constraint app_integration_connections_provider_check
  check (provider in (
    'github', 'supabase', 'stripe', 'paypal', 'paddle', 'lemon_squeezy',
    'revenuecat', 'resend', 'openai', 'anthropic', 'gemini', 'firebase'
  ));

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

grant select, insert on public.app_payment_events to service_role;
grant select on public.app_payment_events to authenticated;

notify pgrst, 'reload schema';
