-- Preview sessions for honest preview runtime (project wciioegiczwqlmlroley)

create table if not exists public.preview_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'building', 'ready', 'failed', 'expired')),
  preview_url text,
  snapshot_id text,
  snapshot_files jsonb default '[]'::jsonb,
  logs jsonb default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists preview_sessions_project_idx on public.preview_sessions (project_id, created_at desc);

alter table public.preview_sessions enable row level security;

drop policy if exists "Users read own preview sessions" on public.preview_sessions;
create policy "Users read own preview sessions"
  on public.preview_sessions for select using (auth.uid() = owner_id);
