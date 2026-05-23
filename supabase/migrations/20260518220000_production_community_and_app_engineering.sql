-- DreamOS86 — Community + app engineering tables (project ref: wciioegiczwqlmlroley)
-- Apply: supabase db push --linked   OR paste in SQL Editor.
-- Requires: public.set_updated_at() from foundational migrations (create if missing below).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles → auth.users ───────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'profiles' and c.conname = 'profiles_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users (id) on delete cascade;
  end if;
exception
  when duplicate_object then null;
end $$;

-- ── discussions ───────────────────────────────────────────────
create table if not exists public.discussions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'General'
    check (category in (
      'General', 'Tips', 'Guide', 'Feedback', 'Showcase', 'Question', 'Announcement'
    )),
  reply_count integer not null default 0,
  like_count integer not null default 0,
  is_pinned boolean not null default false,
  is_deleted boolean not null default false
);

create index if not exists discussions_created_idx on public.discussions (created_at desc);

drop trigger if exists discussions_updated_at on public.discussions;
create trigger discussions_updated_at
  before update on public.discussions
  for each row execute function public.set_updated_at();

alter table public.discussions enable row level security;

drop policy if exists "discussions: public read" on public.discussions;
create policy "discussions: public read"
  on public.discussions for select
  using (coalesce(is_deleted, false) = false);

drop policy if exists "discussions: insert own" on public.discussions;
create policy "discussions: insert own"
  on public.discussions for insert
  with check (auth.uid() = user_id);

drop policy if exists "discussions: update own" on public.discussions;
create policy "discussions: update own"
  on public.discussions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── discussion_replies ───────────────────────────────────────
create table if not exists public.discussion_replies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  discussion_id uuid not null references public.discussions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  like_count integer not null default 0,
  is_deleted boolean not null default false
);

create index if not exists discussion_replies_discussion_idx
  on public.discussion_replies (discussion_id, created_at);

drop trigger if exists discussion_replies_updated_at on public.discussion_replies;
create trigger discussion_replies_updated_at
  before update on public.discussion_replies
  for each row execute function public.set_updated_at();

alter table public.discussion_replies enable row level security;

drop policy if exists "discussion_replies: read" on public.discussion_replies;
create policy "discussion_replies: read"
  on public.discussion_replies for select
  using (coalesce(is_deleted, false) = false);

drop policy if exists "discussion_replies: insert" on public.discussion_replies;
create policy "discussion_replies: insert"
  on public.discussion_replies for insert
  with check (auth.uid() = user_id);

drop policy if exists "discussion_replies: update own" on public.discussion_replies;
create policy "discussion_replies: update own"
  on public.discussion_replies for update
  using (auth.uid() = user_id);

-- ── discussion_likes ─────────────────────────────────────────
create table if not exists public.discussion_likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  discussion_id uuid not null references public.discussions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, discussion_id)
);

alter table public.discussion_likes enable row level security;

drop policy if exists "discussion_likes: read" on public.discussion_likes;
create policy "discussion_likes: read"
  on public.discussion_likes for select
  using (true);

drop policy if exists "discussion_likes: insert own" on public.discussion_likes;
create policy "discussion_likes: insert own"
  on public.discussion_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "discussion_likes: delete own" on public.discussion_likes;
create policy "discussion_likes: delete own"
  on public.discussion_likes for delete
  using (auth.uid() = user_id);

-- ── groups (Community) ────────────────────────────────────────
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creator_id uuid references auth.users (id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  category text not null default 'General',
  icon_url text,
  banner_color text not null default '#4f7cff',
  is_public boolean not null default true,
  is_featured boolean not null default false,
  member_count integer not null default 0
);

create unique index if not exists groups_slug_unique on public.groups (slug);

drop trigger if exists groups_updated_at on public.groups;
create trigger groups_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

alter table public.groups enable row level security;

drop policy if exists "groups: read" on public.groups;
create policy "groups: read"
  on public.groups for select
  using (coalesce(is_public, true) = true or auth.uid() = creator_id);

drop policy if exists "groups: insert own" on public.groups;
create policy "groups: insert own"
  on public.groups for insert
  with check (auth.uid() = creator_id);

drop policy if exists "groups: update creator" on public.groups;
create policy "groups: update creator"
  on public.groups for update
  using (auth.uid() = creator_id);

-- ── group_members ───────────────────────────────────────────
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

alter table public.group_members enable row level security;

drop policy if exists "group_members: read" on public.group_members;
create policy "group_members: read"
  on public.group_members for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.creator_id = auth.uid())
  );

drop policy if exists "group_members: insert self" on public.group_members;
create policy "group_members: insert self"
  on public.group_members for insert
  with check (user_id = auth.uid());

drop policy if exists "group_members: delete self" on public.group_members;
create policy "group_members: delete self"
  on public.group_members for delete
  using (user_id = auth.uid());

-- ── app_files (generated / imported source) ───────────────────
create table if not exists public.app_files (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  path text not null,
  content text not null,
  mime_type text not null default 'text/plain',
  size_bytes integer not null default 0,
  unique (project_id, path)
);

create index if not exists app_files_project_idx on public.app_files (project_id);

drop trigger if exists app_files_updated_at on public.app_files;
create trigger app_files_updated_at
  before update on public.app_files
  for each row execute function public.set_updated_at();

alter table public.app_files enable row level security;

drop policy if exists "app_files: owner read" on public.app_files;
create policy "app_files: owner read"
  on public.app_files for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "app_files: owner write" on public.app_files;
create policy "app_files: owner write"
  on public.app_files for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

-- ── imported_projects ─────────────────────────────────────────
create table if not exists public.imported_projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  source_archive_path text,
  framework_detected text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists imported_projects_user_idx on public.imported_projects (user_id);

alter table public.imported_projects enable row level security;

drop policy if exists "imported_projects: own" on public.imported_projects;
create policy "imported_projects: own"
  on public.imported_projects for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── wrap_jobs ─────────────────────────────────────────────────
create table if not exists public.wrap_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('web_zip', 'web_deploy', 'android_apk', 'android_aab')),
  status text not null default 'queued'
    check (status in (
      'queued', 'running', 'succeeded', 'failed', 'requires_builder_config', 'cancelled'
    )),
  error_message text,
  artifact_url text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists wrap_jobs_project_idx on public.wrap_jobs (project_id, created_at desc);

drop trigger if exists wrap_jobs_updated_at on public.wrap_jobs;
create trigger wrap_jobs_updated_at
  before update on public.wrap_jobs
  for each row execute function public.set_updated_at();

alter table public.wrap_jobs enable row level security;

drop policy if exists "wrap_jobs: own" on public.wrap_jobs;
create policy "wrap_jobs: own"
  on public.wrap_jobs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── build_jobs ────────────────────────────────────────────────
create table if not exists public.build_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  status text not null default 'queued',
  prompt text,
  result_summary text,
  error_message text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists build_jobs_user_idx on public.build_jobs (user_id, created_at desc);

drop trigger if exists build_jobs_updated_at on public.build_jobs;
create trigger build_jobs_updated_at
  before update on public.build_jobs
  for each row execute function public.set_updated_at();

alter table public.build_jobs enable row level security;

drop policy if exists "build_jobs: own" on public.build_jobs;
create policy "build_jobs: own"
  on public.build_jobs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
