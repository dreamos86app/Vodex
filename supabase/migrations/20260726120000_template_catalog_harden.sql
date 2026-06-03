-- P1.8.2 — Community templates: likes, usage events, source files, visibility
-- Safe on DBs that never ran 001_initial_schema.sql (templates table missing).

create table if not exists public.templates (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  name              text not null,
  description       text not null,
  category          text not null,
  gradient          text not null default 'from-sky-500/15 via-indigo-500/10 to-violet-500/15',
  accent            text not null default '#6366f1',
  tags              text[] not null default '{}',
  complexity        text not null default 'medium'
    check (complexity in ('simple', 'medium', 'advanced')),
  popular           boolean not null default false,
  is_new            boolean not null default false,
  prompt            text not null default '',
  preview_url       text,
  preview_image_url text,
  uses_count        int not null default 0,
  like_count        int not null default 0,
  plan_required     text,
  owner_id          uuid references public.profiles(id) on delete cascade,
  creator_id        uuid references public.profiles(id) on delete set null,
  visibility        text not null default 'public'
    check (visibility in ('public', 'unlisted', 'private')),
  is_official       boolean not null default false,
  source_project_id uuid references public.projects(id) on delete set null,
  slug              text
);

-- Upgrade legacy templates table (from 001_initial_schema) if it already existed
alter table public.templates
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists preview_image_url text,
  add column if not exists like_count int not null default 0,
  add column if not exists owner_id uuid references public.profiles(id) on delete cascade,
  add column if not exists creator_id uuid references public.profiles(id) on delete set null,
  add column if not exists visibility text not null default 'public',
  add column if not exists is_official boolean not null default false,
  add column if not exists source_project_id uuid references public.projects(id) on delete set null,
  add column if not exists slug text;

-- Ensure visibility check exists (ignore if already present)
do $$
begin
  alter table public.templates
    add constraint templates_visibility_check
    check (visibility in ('public', 'unlisted', 'private'));
exception
  when duplicate_object then null;
end $$;

alter table public.templates enable row level security;

create index if not exists templates_owner_id_idx on public.templates (owner_id);
create index if not exists templates_visibility_public_idx on public.templates (visibility)
  where visibility = 'public' and is_official = false;
create unique index if not exists templates_slug_unique_idx on public.templates (slug)
  where slug is not null;

create table if not exists public.template_likes (
  template_id uuid not null references public.templates(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (template_id, user_id)
);

create index if not exists template_likes_user_id_idx on public.template_likes (user_id);

create table if not exists public.template_usage_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  template_id uuid not null references public.templates(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null
);

create index if not exists template_usage_events_template_id_idx
  on public.template_usage_events (template_id);

create table if not exists public.template_files (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  template_id uuid not null references public.templates(id) on delete cascade,
  path text not null,
  content text not null,
  mime_type text,
  size_bytes int not null default 0,
  unique (template_id, path)
);

create index if not exists template_files_template_id_idx on public.template_files (template_id);

-- Sync like_count from template_likes
create or replace function public.sync_template_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.templates set like_count = like_count + 1 where id = new.template_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.templates
    set like_count = greatest(0, like_count - 1)
    where id = old.template_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists template_likes_count_sync on public.template_likes;
create trigger template_likes_count_sync
  after insert or delete on public.template_likes
  for each row execute function public.sync_template_like_count();

-- Sync uses_count from usage events (one increment per use)
create or replace function public.sync_template_use_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.templates set uses_count = uses_count + 1 where id = new.template_id;
  return new;
end;
$$;

drop trigger if exists template_usage_count_sync on public.template_usage_events;
create trigger template_usage_count_sync
  after insert on public.template_usage_events
  for each row execute function public.sync_template_use_count();

alter table public.template_likes enable row level security;
alter table public.template_usage_events enable row level security;
alter table public.template_files enable row level security;

-- Public read for published community templates
drop policy if exists "templates: public read" on public.templates;
drop policy if exists "templates: admin write" on public.templates;
drop policy if exists templates_public_read on public.templates;
create policy templates_public_read on public.templates
  for select using (
    is_official = true
    or (visibility = 'public' and owner_id is not null)
  );

drop policy if exists templates_owner_write on public.templates;
create policy templates_owner_write on public.templates
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id and is_official = false);

drop policy if exists template_likes_select on public.template_likes;
create policy template_likes_select on public.template_likes
  for select using (true);

drop policy if exists template_likes_insert on public.template_likes;
create policy template_likes_insert on public.template_likes
  for insert with check (auth.uid() = user_id);

drop policy if exists template_likes_delete on public.template_likes;
create policy template_likes_delete on public.template_likes
  for delete using (auth.uid() = user_id);

drop policy if exists template_usage_events_insert on public.template_usage_events;
create policy template_usage_events_insert on public.template_usage_events
  for insert with check (auth.uid() = user_id);

drop policy if exists template_usage_events_select on public.template_usage_events;
create policy template_usage_events_select on public.template_usage_events
  for select using (auth.uid() = user_id);

drop policy if exists template_files_public_read on public.template_files;
create policy template_files_public_read on public.template_files
  for select using (
    exists (
      select 1 from public.templates t
      where t.id = template_id
        and (t.visibility = 'public' or t.owner_id = auth.uid())
    )
  );

drop policy if exists template_files_owner_write on public.template_files;
create policy template_files_owner_write on public.template_files
  for all using (
    exists (
      select 1 from public.templates t
      where t.id = template_id and t.owner_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
