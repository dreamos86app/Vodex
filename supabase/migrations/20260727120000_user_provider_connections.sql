-- P2 — Account-level GitHub / Supabase links for one-click per-app connect

create table if not exists public.user_provider_connections (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('github', 'supabase')),
  status text not null default 'connected'
    check (status in ('connected', 'disconnected', 'error')),
  display_name text,
  metadata jsonb not null default '{}',
  encrypted_access_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create index if not exists user_provider_connections_user_id_idx
  on public.user_provider_connections (user_id);

alter table public.user_provider_connections enable row level security;

drop policy if exists user_provider_connections_select_own on public.user_provider_connections;
create policy user_provider_connections_select_own on public.user_provider_connections
  for select using (auth.uid() = user_id);

drop policy if exists user_provider_connections_write_own on public.user_provider_connections;
create policy user_provider_connections_write_own on public.user_provider_connections
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
