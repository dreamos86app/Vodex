-- DreamOS86 — project integrations + build columns + preview/publish (idempotent)

alter table public.project_integrations add column if not exists display_name text;
alter table public.project_integrations add column if not exists provider_key text;
alter table public.project_integrations add column if not exists description text;
alter table public.project_integrations add column if not exists icon_url text;
alter table public.project_integrations add column if not exists icon text;
alter table public.project_integrations add column if not exists connected_at timestamptz;
alter table public.project_integrations add column if not exists last_error text;
alter table public.project_integrations add column if not exists config jsonb default '{}'::jsonb;
alter table public.project_integrations add column if not exists required_env_vars jsonb default '[]'::jsonb;

alter table public.project_secrets add column if not exists encrypted_value text;

alter table public.projects add column if not exists app_name text;
alter table public.projects add column if not exists icon_svg text;
alter table public.projects add column if not exists build_status text;
alter table public.projects add column if not exists last_build_id uuid;
alter table public.projects add column if not exists last_build_at timestamptz;

alter table public.build_jobs add column if not exists completed_at timestamptz;
alter table public.build_jobs add column if not exists credits_charged integer default 0;

create table if not exists public.preview_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  file_path text,
  line_number integer,
  error_message text not null,
  metadata jsonb default '{}'::jsonb
);

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

grant all on public.preview_errors to service_role;
grant all on public.publish_records to service_role;

NOTIFY pgrst, 'reload schema';
