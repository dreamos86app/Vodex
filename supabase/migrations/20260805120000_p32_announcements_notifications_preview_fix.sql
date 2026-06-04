-- P3.2 — Announcements RLS, notification read path, preview worker heartbeat
-- After apply: NOTIFY pgrst, 'reload schema';

-- Preview worker heartbeat (UI: worker connected / not connected)
create table if not exists public.preview_worker_heartbeats (
  worker_id text primary key,
  last_seen_at timestamptz not null default now(),
  jobs_claimed int not null default 0,
  last_job_id uuid,
  updated_at timestamptz not null default now()
);

create index if not exists preview_worker_heartbeats_last_seen_idx
  on public.preview_worker_heartbeats (last_seen_at desc);

alter table public.preview_worker_heartbeats enable row level security;

-- No client policies — service role only via worker

-- platform_announcements: authenticated may read active public banners only
drop policy if exists platform_announcements_public_read on public.platform_announcements;
create policy platform_announcements_public_read on public.platform_announcements
  for select to authenticated, anon
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

-- notifications: explicit read/update for own rows (repair ambiguous FOR ALL policies)
drop policy if exists "Users access own notifications" on public.notifications;
drop policy if exists "notifications: own only" on public.notifications;
drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_delete_own on public.notifications;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (auth.uid() = user_id);

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (auth.uid() = user_id);

-- Inserts for users' own rows (welcome route uses service role; this allows safe server routes)
create policy notifications_insert_own on public.notifications
  for insert to authenticated
  with check (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
