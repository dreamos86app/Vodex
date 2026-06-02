-- P1.7.1: schema-adaptive discussions + replies + likes (idempotent)
-- Production legacy uses user_id; adds author_id and keeps both in sync.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public._p171_column_exists(p_table text, p_column text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = p_table
      and c.column_name = p_column
  );
$$;

-- Build coalesce(author_id, user_id, ...) only for columns that exist
create or replace function public._p171_owner_coalesce_expr(p_table text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[] := array[]::text[];
  col text;
begin
  foreach col in array array['author_id', 'user_id', 'owner_id', 'created_by'] loop
    if public._p171_column_exists(p_table, col) then
      parts := array_append(parts, col);
    end if;
  end loop;

  if array_length(parts, 1) is null then
    return 'null::uuid';
  end if;

  return 'coalesce(' || array_to_string(parts, ', ') || ')';
end;
$$;

-- ── discussions ───────────────────────────────────────────────────────────────
create table if not exists public.discussions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'General',
  reply_count integer not null default 0,
  like_count integer not null default 0,
  is_pinned boolean not null default false,
  is_deleted boolean not null default false
);

alter table public.discussions
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists user_id uuid,
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists category text default 'General',
  add column if not exists reply_count integer default 0,
  add column if not exists like_count integer default 0,
  add column if not exists is_pinned boolean default false,
  add column if not exists is_deleted boolean default false,
  add column if not exists author_id uuid;

do $$
begin
  if public._p171_column_exists('discussions', 'author_id')
     and not exists (
       select 1 from pg_constraint
       where conname = 'discussions_author_id_fkey'
         and conrelid = 'public.discussions'::regclass
     ) then
    alter table public.discussions
      add constraint discussions_author_id_fkey
      foreign key (author_id) references auth.users (id) on delete set null;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if not public._p171_column_exists('discussions', 'author_id') then
    return;
  end if;

  if public._p171_column_exists('discussions', 'user_id') then
    update public.discussions
    set author_id = user_id
    where author_id is null and user_id is not null;
  end if;

  if public._p171_column_exists('discussions', 'owner_id') then
    execute $sql$
      update public.discussions
      set author_id = owner_id
      where author_id is null and owner_id is not null
    $sql$;
  end if;

  if public._p171_column_exists('discussions', 'created_by') then
    execute $sql$
      update public.discussions
      set author_id = created_by
      where author_id is null and created_by is not null
    $sql$;
  end if;
end $$;

create index if not exists discussions_created_idx on public.discussions (created_at desc);

drop trigger if exists discussions_updated_at on public.discussions;
create trigger discussions_updated_at
  before update on public.discussions
  for each row execute function public.set_updated_at();

create or replace function public.discussions_sync_owner_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  j jsonb;
begin
  j := to_jsonb(new);

  if public._p171_column_exists('discussions', 'author_id')
     and (j->>'author_id') is null then
    new.author_id := coalesce(
      case when public._p171_column_exists('discussions', 'user_id') then (j->>'user_id')::uuid end,
      case when public._p171_column_exists('discussions', 'owner_id') then (j->>'owner_id')::uuid end,
      case when public._p171_column_exists('discussions', 'created_by') then (j->>'created_by')::uuid end
    );
  end if;

  if public._p171_column_exists('discussions', 'user_id')
     and new.user_id is null
     and public._p171_column_exists('discussions', 'author_id')
     and new.author_id is not null then
    new.user_id := new.author_id;
  end if;

  return new;
end;
$$;

drop trigger if exists discussions_sync_owner_columns on public.discussions;
create trigger discussions_sync_owner_columns
  before insert or update on public.discussions
  for each row execute function public.discussions_sync_owner_columns();

-- ── discussion_replies ────────────────────────────────────────────────────────
create table if not exists public.discussion_replies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  discussion_id uuid not null references public.discussions (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  body text not null,
  like_count integer not null default 0,
  is_deleted boolean not null default false
);

alter table public.discussion_replies
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists discussion_id uuid,
  add column if not exists user_id uuid,
  add column if not exists body text,
  add column if not exists like_count integer default 0,
  add column if not exists is_deleted boolean default false,
  add column if not exists author_id uuid;

do $$
begin
  if public._p171_column_exists('discussion_replies', 'author_id')
     and not exists (
       select 1 from pg_constraint
       where conname = 'discussion_replies_author_id_fkey'
         and conrelid = 'public.discussion_replies'::regclass
     ) then
    alter table public.discussion_replies
      add constraint discussion_replies_author_id_fkey
      foreign key (author_id) references auth.users (id) on delete set null;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if not public._p171_column_exists('discussion_replies', 'author_id') then
    return;
  end if;

  if public._p171_column_exists('discussion_replies', 'user_id') then
    update public.discussion_replies
    set author_id = user_id
    where author_id is null and user_id is not null;
  end if;

  if public._p171_column_exists('discussion_replies', 'owner_id') then
    execute $sql$
      update public.discussion_replies
      set author_id = owner_id
      where author_id is null and owner_id is not null
    $sql$;
  end if;

  if public._p171_column_exists('discussion_replies', 'created_by') then
    execute $sql$
      update public.discussion_replies
      set author_id = created_by
      where author_id is null and created_by is not null
    $sql$;
  end if;
end $$;

create index if not exists discussion_replies_discussion_idx
  on public.discussion_replies (discussion_id, created_at);

drop trigger if exists discussion_replies_updated_at on public.discussion_replies;
create trigger discussion_replies_updated_at
  before update on public.discussion_replies
  for each row execute function public.set_updated_at();

create or replace function public.discussion_replies_sync_owner_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  j jsonb;
begin
  j := to_jsonb(new);

  if public._p171_column_exists('discussion_replies', 'author_id')
     and (j->>'author_id') is null then
    new.author_id := coalesce(
      case when public._p171_column_exists('discussion_replies', 'user_id') then (j->>'user_id')::uuid end,
      case when public._p171_column_exists('discussion_replies', 'owner_id') then (j->>'owner_id')::uuid end,
      case when public._p171_column_exists('discussion_replies', 'created_by') then (j->>'created_by')::uuid end
    );
  end if;

  if public._p171_column_exists('discussion_replies', 'user_id')
     and new.user_id is null
     and public._p171_column_exists('discussion_replies', 'author_id')
     and new.author_id is not null then
    new.user_id := new.author_id;
  end if;

  return new;
end;
$$;

drop trigger if exists discussion_replies_sync_owner_columns on public.discussion_replies;
create trigger discussion_replies_sync_owner_columns
  before insert or update on public.discussion_replies
  for each row execute function public.discussion_replies_sync_owner_columns();

-- ── discussion_likes ──────────────────────────────────────────────────────────
create table if not exists public.discussion_likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  discussion_id uuid not null references public.discussions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, discussion_id)
);

alter table public.discussion_likes
  add column if not exists user_id uuid,
  add column if not exists discussion_id uuid,
  add column if not exists created_at timestamptz default now();

-- ── RLS + grants ───────────────────────────────────────────────────────────────
alter table public.discussions enable row level security;
alter table public.discussion_replies enable row level security;
alter table public.discussion_likes enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.discussions to anon, authenticated;
grant insert, update, delete on public.discussions to authenticated;
grant select on public.discussion_replies to anon, authenticated;
grant insert, update, delete on public.discussion_replies to authenticated;
grant select, insert, delete on public.discussion_likes to authenticated;

drop policy if exists "discussions: public read" on public.discussions;
drop policy if exists "discussions: authenticated read" on public.discussions;
drop policy if exists "discussions: insert own" on public.discussions;
drop policy if exists "discussions: update own" on public.discussions;
drop policy if exists "discussions: delete own" on public.discussions;

create policy "discussions: authenticated read"
  on public.discussions for select to authenticated, anon
  using (coalesce(is_deleted, false) = false);

do $$
declare
  owner_expr text;
begin
  owner_expr := public._p171_owner_coalesce_expr('discussions');
  if owner_expr = 'null::uuid' then
    return;
  end if;

  execute format(
    $policy$
      create policy "discussions: insert own"
        on public.discussions for insert to authenticated
        with check (auth.uid() = %s)
    $policy$,
    owner_expr
  );

  execute format(
    $policy$
      create policy "discussions: update own"
        on public.discussions for update to authenticated
        using (auth.uid() = %s)
        with check (auth.uid() = %s)
    $policy$,
    owner_expr,
    owner_expr
  );

  execute format(
    $policy$
      create policy "discussions: delete own"
        on public.discussions for delete to authenticated
        using (auth.uid() = %s)
    $policy$,
    owner_expr
  );
end $$;

drop policy if exists "discussion_replies: read" on public.discussion_replies;
drop policy if exists "discussion_replies: insert" on public.discussion_replies;
drop policy if exists "discussion_replies: update own" on public.discussion_replies;
drop policy if exists "discussion_replies: delete own" on public.discussion_replies;

create policy "discussion_replies: read"
  on public.discussion_replies for select to authenticated, anon
  using (coalesce(is_deleted, false) = false);

do $$
declare
  owner_expr text;
begin
  owner_expr := public._p171_owner_coalesce_expr('discussion_replies');
  if owner_expr = 'null::uuid' then
    return;
  end if;

  execute format(
    $policy$
      create policy "discussion_replies: insert"
        on public.discussion_replies for insert to authenticated
        with check (auth.uid() = %s)
    $policy$,
    owner_expr
  );

  execute format(
    $policy$
      create policy "discussion_replies: update own"
        on public.discussion_replies for update to authenticated
        using (auth.uid() = %s)
    $policy$,
    owner_expr
  );

  execute format(
    $policy$
      create policy "discussion_replies: delete own"
        on public.discussion_replies for delete to authenticated
        using (auth.uid() = %s)
    $policy$,
    owner_expr
  );
end $$;

drop policy if exists "discussion_likes: read" on public.discussion_likes;
drop policy if exists "discussion_likes: insert own" on public.discussion_likes;
drop policy if exists "discussion_likes: delete own" on public.discussion_likes;

create policy "discussion_likes: read"
  on public.discussion_likes for select to authenticated, anon
  using (true);

do $$
begin
  if public._p171_column_exists('discussion_likes', 'user_id') then
    execute $sql$
      create policy "discussion_likes: insert own"
        on public.discussion_likes for insert to authenticated
        with check (auth.uid() = user_id)
    $sql$;

    execute $sql$
      create policy "discussion_likes: delete own"
        on public.discussion_likes for delete to authenticated
        using (auth.uid() = user_id)
    $sql$;
  end if;
end $$;

notify pgrst, 'reload schema';
