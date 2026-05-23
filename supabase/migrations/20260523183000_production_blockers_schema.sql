-- ============================================================
-- DreamOS86 — Production blockers (profiles cache, chat, workspaces)
-- Apply to project ref: wciioegiczwqlmlroley (via Supabase SQL or `db push`).
-- Idempotent. Reloads PostgREST schema cache at end.
-- ============================================================

-- ── profiles: display name + align with app types ───────────
alter table public.profiles add column if not exists display_name text;

update public.profiles
set display_name = coalesce(nullif(trim(display_name), ''), full_name, split_part(email, '@', 1))
where display_name is null or trim(display_name) = '';

-- tokens are stored as credits_remaining (app UI: "tokens")
comment on column public.profiles.credits_remaining is 'User token balance (DreamOS86 UI: tokens)';

-- ── message_attachments: column expected by /api/chat ─────
alter table public.message_attachments add column if not exists file_name text;

-- ── workspace_members (app + docs) — distinct from team invites ──
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'editor', 'viewer')),
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
  );

drop policy if exists "workspace_members: owner manage" on public.workspace_members;
create policy "workspace_members: owner manage"
  on public.workspace_members for all
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

-- Backfill owners where missing (idempotent)
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
where not exists (
  select 1 from public.workspace_members m
  where m.workspace_id = w.id and m.user_id = w.owner_id
)
on conflict (workspace_id, user_id) do nothing;

-- Mirror active team members when team_members exists (invites / collaboration)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'team_members'
  ) then
    insert into public.workspace_members (workspace_id, user_id, role)
    select tm.workspace_id, tm.user_id,
      case tm.role::text
        when 'owner' then 'owner'
        when 'admin' then 'admin'
        when 'editor' then 'editor'
        else 'viewer'
      end
    from public.team_members tm
    where tm.user_id is not null
      and tm.status = 'active'
    on conflict (workspace_id, user_id) do update set
      role = excluded.role;
  end if;
end $$;

notify pgrst, 'reload schema';
