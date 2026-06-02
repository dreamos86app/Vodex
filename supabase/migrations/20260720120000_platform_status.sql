-- Platform status page + owner-controlled announcements

create table if not exists public.status_components (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  group_name text not null default 'Platform',
  description text,
  current_status text not null default 'operational'
    check (current_status in ('operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance')),
  sort_order int not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.status_daily_history (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.status_components(id) on delete cascade,
  date date not null,
  status text not null default 'operational'
    check (status in ('operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance')),
  uptime_percent numeric(5,2) not null default 100,
  note text,
  created_at timestamptz not null default now(),
  unique (component_id, date)
);

create table if not exists public.status_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  status text not null default 'investigating'
    check (status in ('investigating', 'identified', 'monitoring', 'resolved')),
  severity text not null default 'incident'
    check (severity in ('info', 'warning', 'incident', 'maintenance', 'outage')),
  affected_components jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  is_public boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  severity text not null default 'incident'
    check (severity in ('info', 'warning', 'incident', 'maintenance', 'outage')),
  link_label text,
  link_url text,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists status_daily_history_component_date_idx
  on public.status_daily_history (component_id, date desc);

create index if not exists status_incidents_public_started_idx
  on public.status_incidents (is_public, started_at desc);

create index if not exists platform_announcements_active_idx
  on public.platform_announcements (is_active, starts_at, ends_at);

alter table public.status_components enable row level security;
alter table public.status_daily_history enable row level security;
alter table public.status_incidents enable row level security;
alter table public.platform_announcements enable row level security;

drop policy if exists status_components_public_read on public.status_components;
create policy status_components_public_read on public.status_components
  for select using (is_public = true);

drop policy if exists status_daily_history_public_read on public.status_daily_history;
create policy status_daily_history_public_read on public.status_daily_history
  for select using (true);

drop policy if exists status_incidents_public_read on public.status_incidents;
create policy status_incidents_public_read on public.status_incidents
  for select using (is_public = true);

drop policy if exists platform_announcements_public_read on public.platform_announcements;
create policy platform_announcements_public_read on public.platform_announcements
  for select using (is_active = true);

insert into public.status_components (key, name, group_name, description, sort_order) values
  ('app_builder', 'App Builder', 'Functionalities', 'AI app generation pipeline', 10),
  ('app_preview', 'Application Preview', 'Functionalities', 'Live preview rendering', 20),
  ('ai_generation', 'AI Generation', 'Functionalities', 'Model provider calls', 30),
  ('billing', 'Billing', 'Functionalities', 'Credits and subscriptions', 40),
  ('data', 'Data', 'Functionalities', 'Project data persistence', 50),
  ('files_serving', 'Files & Images Serving', 'Functionalities', 'Static asset delivery', 60),
  ('file_uploads', 'File Uploads', 'Functionalities', 'User uploads', 70),
  ('hosting', 'Hosting', 'Functionalities', 'Published app hosting', 80),
  ('login', 'Login', 'Functionalities', 'Authentication', 90),
  ('platform', 'Platform', 'Services', 'Core Vodex web app', 100),
  ('published_apps', 'Published Applications', 'Services', 'Public published apps', 110),
  ('website', 'Website', 'Services', 'Marketing site', 120),
  ('admin_panel', 'Admin Panel', 'Services', 'Owner admin tools', 130),
  ('supabase', 'Supabase', 'Services', 'Database and auth', 140),
  ('vercel_hosting', 'Vercel Hosting', 'Services', 'Deployment hosting', 150),
  ('paddle_checkout', 'Paddle Checkout', 'Services', 'Subscription checkout', 160),
  ('email_resend', 'Email / Resend', 'Services', 'Transactional email', 170)
on conflict (key) do nothing;
