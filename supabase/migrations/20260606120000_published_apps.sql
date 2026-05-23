-- Published apps: public slug + URL (project wciioegiczwqlmlroley)

create table if not exists public.published_apps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  subdomain text,
  public_url text not null,
  status text not null default 'published'
    check (status in ('published', 'unpublished', 'failed')),
  version int not null default 1,
  build_snapshot_id text,
  deployment_id uuid,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  snapshot_files jsonb default '[]'::jsonb,
  title text,
  description text
);

create index if not exists published_apps_project_idx on public.published_apps (project_id);
create index if not exists published_apps_owner_idx on public.published_apps (owner_id, updated_at desc);

alter table public.published_apps enable row level security;

drop policy if exists "Anyone can read published apps" on public.published_apps;
create policy "Anyone can read published apps"
  on public.published_apps for select using (status = 'published');

drop policy if exists "Owners manage published apps" on public.published_apps;
create policy "Owners manage published apps"
  on public.published_apps for all using (auth.uid() = owner_id);
