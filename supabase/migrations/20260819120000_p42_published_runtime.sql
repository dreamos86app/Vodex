-- P4.2: Published app runtime, custom domains, auth providers, templates, watermark

-- Published apps: artifact + canonical URL + render verification
alter table public.published_apps
  add column if not exists canonical_url text,
  add column if not exists artifact_path text,
  add column if not exists artifact_build_id text,
  add column if not exists watermark_disabled boolean not null default false,
  add column if not exists render_verified boolean not null default false;

create index if not exists published_apps_canonical_url_idx
  on public.published_apps (canonical_url)
  where canonical_url is not null;

-- Custom domains (self-serve Starter+)
create table if not exists public.custom_domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  hostname text not null,
  verification_token text not null default encode(gen_random_bytes(16), 'hex'),
  status text not null default 'pending_dns'
    check (status in ('pending_dns', 'verified', 'tls_pending', 'active', 'failed')),
  dns_records jsonb not null default '[]'::jsonb,
  last_checked_at timestamptz,
  verified_at timestamptz,
  tls_status text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hostname)
);

create index if not exists custom_domains_project_idx on public.custom_domains (project_id);
create index if not exists custom_domains_owner_idx on public.custom_domains (owner_id);
create index if not exists custom_domains_hostname_active_idx
  on public.custom_domains (hostname)
  where status = 'active';

alter table public.custom_domains enable row level security;

drop policy if exists "Owners manage custom domains" on public.custom_domains;
create policy "Owners manage custom domains"
  on public.custom_domains for all using (auth.uid() = owner_id);

drop policy if exists "Public read active custom domains" on public.custom_domains;
create policy "Public read active custom domains"
  on public.custom_domains for select using (status = 'active');

-- App integration connections (encrypted refs)
create table if not exists public.app_integration_connections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('github', 'supabase', 'revenuecat', 'resend', 'stripe')),
  status text not null default 'connected' check (status in ('pending', 'connected', 'failed', 'disconnected')),
  account_label text,
  secret_ref text,
  metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, provider)
);

create index if not exists app_integration_connections_project_idx
  on public.app_integration_connections (project_id);

alter table public.app_integration_connections enable row level security;

drop policy if exists "Owners manage app integrations" on public.app_integration_connections;
create policy "Owners manage app integrations"
  on public.app_integration_connections for all using (auth.uid() = owner_id);

-- App auth provider settings
create table if not exists public.app_auth_provider_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  email_password_enabled boolean not null default true,
  google_enabled boolean not null default false,
  github_enabled boolean not null default false,
  apple_enabled boolean not null default false,
  microsoft_enabled boolean not null default false,
  facebook_enabled boolean not null default false,
  oauth_mode text not null default 'vodex_managed'
    check (oauth_mode in ('vodex_managed', 'custom')),
  custom_oauth jsonb not null default '{}'::jsonb,
  callback_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

alter table public.app_auth_provider_settings enable row level security;

drop policy if exists "Owners manage app auth settings" on public.app_auth_provider_settings;
create policy "Owners manage app auth settings"
  on public.app_auth_provider_settings for all using (auth.uid() = owner_id);

-- Watermark settings per project
create table if not exists public.app_watermark_settings (
  project_id uuid primary key references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  watermark_disabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.app_watermark_settings enable row level security;

drop policy if exists "Owners manage watermark settings" on public.app_watermark_settings;
create policy "Owners manage watermark settings"
  on public.app_watermark_settings for all using (auth.uid() = owner_id);

-- Template votes (community marketplace)
create table if not exists public.template_votes (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote int not null default 1 check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (template_id, user_id)
);

create index if not exists template_votes_template_idx on public.template_votes (template_id);

alter table public.template_votes enable row level security;

drop policy if exists "Users manage own template votes" on public.template_votes;
create policy "Users manage own template votes"
  on public.template_votes for all using (auth.uid() = user_id);

drop policy if exists "Anyone reads template votes" on public.template_votes;
create policy "Anyone reads template votes"
  on public.template_votes for select using (true);

notify pgrst, 'reload schema';
