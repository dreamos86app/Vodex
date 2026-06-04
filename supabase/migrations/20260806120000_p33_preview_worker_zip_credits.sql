-- P3.2 — Preview worker observability, platform settings, ZIP action credit holds
-- After apply: NOTIFY pgrst, 'reload schema';

alter table public.preview_worker_heartbeats
  add column if not exists version text,
  add column if not exists host text,
  add column if not exists status text not null default 'online';

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (key, value)
values ('preview_cost_multiplier', '3.0'::jsonb)
on conflict (key) do nothing;

create table if not exists public.zip_preview_action_holds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  operation_id text not null,
  credits numeric(12, 2) not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'charged', 'refunded', 'cancelled')),
  tier int not null default 1,
  size_mb numeric(12, 2) not null default 0,
  framework text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists zip_preview_action_holds_operation_unique
  on public.zip_preview_action_holds (operation_id);

create index if not exists zip_preview_action_holds_user_idx
  on public.zip_preview_action_holds (user_id, created_at desc);

alter table public.platform_settings enable row level security;
alter table public.zip_preview_action_holds enable row level security;

-- Service role only (app uses admin client)

NOTIFY pgrst, 'reload schema';
