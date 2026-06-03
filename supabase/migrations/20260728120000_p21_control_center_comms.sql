-- P2.1 — Email marketing + marketing consent (idempotent)
-- After apply: NOTIFY pgrst, 'reload schema';

alter table public.profiles
  add column if not exists marketing_emails_opt_in boolean not null default false;

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  template_id text not null,
  subject text not null,
  target_scope text not null default 'all_opted_in',
  target_plan text,
  target_email text,
  recipient_count int not null default 0,
  status text not null default 'sent'
    check (status in ('draft', 'sent', 'failed')),
  created_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists email_campaigns_sent_at_idx
  on public.email_campaigns (sent_at desc);

alter table public.email_campaigns enable row level security;

drop policy if exists email_campaigns_admin_only on public.email_campaigns;
create policy email_campaigns_admin_only on public.email_campaigns
  for all using (false);

-- Re-assert status tables (safe if already applied via p17)
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

create table if not exists public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  severity text not null default 'info',
  link_label text,
  link_url text,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_announcements
  add column if not exists priority int not null default 100,
  add column if not exists banner_type text not null default 'info',
  add column if not exists gradient_from text,
  add column if not exists gradient_to text,
  add column if not exists text_color text default '#ffffff',
  add column if not exists icon_type text default 'alert',
  add column if not exists effect_key text default 'none',
  add column if not exists target_plan text,
  add column if not exists target_user_id uuid;

NOTIFY pgrst, 'reload schema';
