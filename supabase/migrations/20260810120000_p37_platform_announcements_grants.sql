-- P3.7 — platform_announcements table + RLS + service_role grants (fix permission denied)

create table if not exists public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  severity text not null default 'info',
  banner_type text not null default 'info',
  link_label text,
  link_url text,
  gradient_from text,
  gradient_to text,
  text_color text,
  icon_type text,
  effect_key text default 'none',
  background_preset text,
  effect_preset text,
  icon_preset text,
  animated_icon_enabled boolean not null default false,
  accent_color text,
  outline_color text,
  button_color text,
  target_scope text not null default 'all',
  target_plan text,
  target_email text,
  target_user_id uuid references auth.users (id) on delete set null,
  priority integer not null default 100,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_announcements enable row level security;

drop policy if exists platform_announcements_public_read on public.platform_announcements;
drop policy if exists "platform_announcements_public_read" on public.platform_announcements;

create policy "platform_announcements_public_read"
  on public.platform_announcements for select
  using (is_active = true);

grant select on public.platform_announcements to anon, authenticated;
grant all on public.platform_announcements to service_role;

create index if not exists platform_announcements_active_priority_idx
  on public.platform_announcements (is_active, priority asc, starts_at desc nulls last);

notify pgrst, 'reload schema';
