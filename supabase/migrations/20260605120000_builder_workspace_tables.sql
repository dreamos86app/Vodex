-- Builder workspace: pending diffs + project deployments
-- Project: wciioegiczwqlmlroley

create table if not exists public.pending_diffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'rejected', 'failed')),
  summary text,
  changed_files jsonb not null default '[]'::jsonb,
  quote_id uuid,
  checkpoint_id text,
  generation_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pending_diffs_project_idx
  on public.pending_diffs (project_id, status, created_at desc);

create table if not exists public.project_deployments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  provider text not null default 'vercel',
  status text not null default 'pending'
    check (status in ('pending', 'building', 'ready', 'failed', 'cancelled')),
  deployment_url text,
  provider_deployment_id text,
  commit_sha text,
  logs jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_deployments_project_idx
  on public.project_deployments (project_id, created_at desc);

alter table public.pending_diffs enable row level security;
alter table public.project_deployments enable row level security;

drop policy if exists "Users read own pending diffs" on public.pending_diffs;
create policy "Users read own pending diffs"
  on public.pending_diffs for select using (auth.uid() = user_id);

drop policy if exists "Users read own deployments" on public.project_deployments;
create policy "Users read own deployments"
  on public.project_deployments for select using (auth.uid() = user_id);
