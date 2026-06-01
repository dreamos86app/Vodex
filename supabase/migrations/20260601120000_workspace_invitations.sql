-- Vodex — workspaces bootstrap + workspace_members + workspace_invitations
-- Production (foundational schema) has profiles/projects but often NO public.workspaces.
-- This migration is idempotent and safe to re-run.
-- Apply to: wciioegiczwqlmlroley

-- ── 1. workspaces (canonical collaboration container) ─────────────────────
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  slug text not null,
  avatar_url text
);

create unique index if not exists workspaces_slug_unique_idx
  on public.workspaces (slug);

create unique index if not exists workspaces_owner_unique_idx
  on public.workspaces (owner_id);

create index if not exists workspaces_owner_id_idx
  on public.workspaces (owner_id);

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    drop trigger if exists workspaces_updated_at on public.workspaces;
    create trigger workspaces_updated_at
      before update on public.workspaces
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.workspaces enable row level security;

drop policy if exists "workspaces: owner read" on public.workspaces;
create policy "workspaces: owner read"
  on public.workspaces for select
  using (owner_id = auth.uid());

drop policy if exists "workspaces: owner write" on public.workspaces;
create policy "workspaces: owner write"
  on public.workspaces for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Backfill one workspace per profile (idempotent)
insert into public.workspaces (owner_id, name, slug)
select
  p.id,
  coalesce(nullif(trim(p.full_name), ''), split_part(p.email, '@', 1)) || '''s Workspace',
  lower(
    regexp_replace(
      coalesce(nullif(trim(p.full_name), ''), split_part(p.email, '@', 1)),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  ) || '-' || substring(p.id::text, 1, 8)
from public.profiles p
where not exists (
  select 1 from public.workspaces w where w.owner_id = p.id
)
on conflict (owner_id) do nothing;

-- Attach projects to owner workspace when workspace_id is null or legacy profile-id fallback
update public.projects pr
set workspace_id = w.id
from public.workspaces w
where w.owner_id = pr.owner_id
  and (
    pr.workspace_id is null
    or pr.workspace_id = pr.owner_id
  );

-- ── 2. workspace_members ────────────────────────────────────────────────────
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'admin', 'editor', 'viewer')),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx
  on public.workspace_members (user_id);

create index if not exists workspace_members_workspace_idx
  on public.workspace_members (workspace_id);

alter table public.workspace_members enable row level security;

drop policy if exists "workspace_members: members read" on public.workspace_members;
create policy "workspace_members: members read"
  on public.workspace_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "workspace_members: owner manage" on public.workspace_members;
create policy "workspace_members: owner manage"
  on public.workspace_members for all
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
where not exists (
  select 1 from public.workspace_members m
  where m.workspace_id = w.id and m.user_id = w.owner_id
)
on conflict (workspace_id, user_id) do update set role = 'owner';

-- Mirror legacy team_members when present
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'team_members'
  ) then
    insert into public.workspace_members (workspace_id, user_id, role)
    select
      tm.workspace_id,
      tm.user_id,
      case tm.role::text
        when 'owner' then 'owner'
        when 'admin' then 'admin'
        when 'editor' then 'editor'
        else 'viewer'
      end
    from public.team_members tm
    where tm.user_id is not null
      and tm.status = 'active'
      and exists (select 1 from public.workspaces w where w.id = tm.workspace_id)
    on conflict (workspace_id, user_id) do update set role = excluded.role;
  end if;
end $$;

-- ── 3. workspace_invitations ───────────────────────────────────────────────
create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  token_hash text not null,
  invited_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists workspace_invitations_token_hash_idx
  on public.workspace_invitations (token_hash);

create index if not exists workspace_invitations_workspace_idx
  on public.workspace_invitations (workspace_id);

create index if not exists workspace_invitations_email_idx
  on public.workspace_invitations (lower(email));

drop index if exists workspace_invitations_pending_email_idx;
create unique index workspace_invitations_pending_email_idx
  on public.workspace_invitations (workspace_id, lower(email))
  where accepted_at is null and revoked_at is null;

alter table public.workspace_invitations enable row level security;

drop policy if exists "workspace_invitations: workspace managers read" on public.workspace_invitations;
create policy "workspace_invitations: workspace managers read"
  on public.workspace_invitations for select
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_invitations.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

drop policy if exists "workspace_invitations: workspace managers write" on public.workspace_invitations;
create policy "workspace_invitations: workspace managers write"
  on public.workspace_invitations for all
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_invitations.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_invitations.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

notify pgrst, 'reload schema';
