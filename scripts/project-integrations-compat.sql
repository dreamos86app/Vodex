-- DreamOS86 — project_integrations, project_secrets, projects build columns, preview/publish tables
-- Idempotent. Run in Supabase SQL Editor, then: NOTIFY pgrst, 'reload schema';

-- project_integrations
alter table public.project_integrations add column if not exists display_name text;
alter table public.project_integrations add column if not exists provider_key text;
alter table public.project_integrations add column if not exists description text;
alter table public.project_integrations add column if not exists icon_url text;
alter table public.project_integrations add column if not exists icon text;
alter table public.project_integrations add column if not exists status text default 'disconnected';
alter table public.project_integrations add column if not exists connected_at timestamptz;
alter table public.project_integrations add column if not exists last_tested_at timestamptz;
alter table public.project_integrations add column if not exists last_error text;
alter table public.project_integrations add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.project_integrations add column if not exists config jsonb default '{}'::jsonb;
alter table public.project_integrations add column if not exists required_env_vars jsonb default '[]'::jsonb;

-- project_secrets
alter table public.project_secrets add column if not exists key_name text;
alter table public.project_secrets add column if not exists encrypted_value text;
alter table public.project_secrets add column if not exists ciphertext text;
alter table public.project_secrets add column if not exists masked_value text;
alter table public.project_secrets add column if not exists provider text;

-- projects build / identity
alter table public.projects add column if not exists app_name text;
alter table public.projects add column if not exists icon_svg text;
alter table public.projects add column if not exists build_status text;
alter table public.projects add column if not exists last_build_id uuid;
alter table public.projects add column if not exists last_build_at timestamptz;

-- build_jobs
alter table public.build_jobs add column if not exists completed_at timestamptz;
alter table public.build_jobs add column if not exists credits_charged integer default 0;
alter table public.build_jobs add column if not exists status text;

-- app_files path compat
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_files' and column_name = 'file_path'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_files' and column_name = 'path'
  ) then
    alter table public.app_files rename column file_path to path;
  end if;
exception when others then null;
end $$;

alter table public.app_files add column if not exists path text;
alter table public.app_files add column if not exists content text;
alter table public.app_files add column if not exists project_id uuid references public.projects (id) on delete cascade;

-- preview_errors
create table if not exists public.preview_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  file_path text,
  line_number integer,
  error_message text not null,
  metadata jsonb default '{}'::jsonb
);

create index if not exists preview_errors_project_idx on public.preview_errors (project_id, created_at desc);

alter table public.preview_errors enable row level security;
drop policy if exists preview_errors_owner on public.preview_errors;
create policy preview_errors_owner on public.preview_errors for all
  using (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

grant all on public.preview_errors to service_role;

-- publish_records
create table if not exists public.publish_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'draft',
  published_url text,
  subdomain text,
  platform text default 'web',
  metadata jsonb default '{}'::jsonb
);

create index if not exists publish_records_project_idx on public.publish_records (project_id, created_at desc);

alter table public.publish_records enable row level security;
drop policy if exists publish_records_owner on public.publish_records;
create policy publish_records_owner on public.publish_records for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant all on public.publish_records to service_role;

NOTIFY pgrst, 'reload schema';
