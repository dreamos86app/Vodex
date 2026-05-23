-- Preview session provider metadata + immutable publish version history

alter table public.preview_sessions
  add column if not exists provider_level text,
  add column if not exists external_url text;

create table if not exists public.published_app_versions (
  id uuid primary key default gen_random_uuid(),
  published_app_id uuid references public.published_apps (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  version int not null,
  slug text not null,
  build_snapshot_id text,
  snapshot_files jsonb not null default '[]'::jsonb,
  title text,
  description text,
  public_url text not null,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists published_app_versions_project_idx
  on public.published_app_versions (project_id, version desc);

alter table public.published_app_versions enable row level security;

drop policy if exists "Owners read publish versions" on public.published_app_versions;
create policy "Owners read publish versions"
  on public.published_app_versions for select using (auth.uid() = owner_id);

drop policy if exists "Owners manage publish versions" on public.published_app_versions;
create policy "Owners manage publish versions"
  on public.published_app_versions for all using (auth.uid() = owner_id);
