-- P2.2 — User presence (Discord-style online/offline)
-- After apply: NOTIFY pgrst, 'reload schema';

alter table public.profiles
  add column if not exists presence_mode text not null default 'auto';

alter table public.profiles
  drop constraint if exists profiles_presence_mode_check;

alter table public.profiles
  add constraint profiles_presence_mode_check
  check (presence_mode in ('auto', 'online', 'offline', 'invisible'));

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  current_status text not null default 'offline'
    check (current_status in ('online', 'offline')),
  updated_at timestamptz not null default now()
);

create index if not exists user_presence_last_seen_idx
  on public.user_presence (last_seen_at desc);

-- RLS on: no authenticated policies — presence is read/written only via service-role API routes.
alter table public.user_presence enable row level security;

NOTIFY pgrst, 'reload schema';
