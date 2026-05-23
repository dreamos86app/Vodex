-- Ensure imported_projects exists for ZIP import metadata tracking.

create table if not exists public.imported_projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  source_archive_path text,
  framework_detected text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists imported_projects_user_idx on public.imported_projects (user_id);
create unique index if not exists imported_projects_project_unique on public.imported_projects (project_id);

alter table public.imported_projects enable row level security;

drop policy if exists "imported_projects: own" on public.imported_projects;
create policy "imported_projects: own"
  on public.imported_projects for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant all on table public.imported_projects to service_role;
grant select, insert, update, delete on table public.imported_projects to authenticated;

notify pgrst, 'reload schema';
