-- Vodex — workspace / team schema diagnostic (safe on partial schemas)
-- Run in Supabase SQL Editor. Does NOT fail when optional legacy tables are missing.

-- ── 1) Required + optional table presence ───────────────────────────────────
with expected(name) as (
  values
    ('profiles'),
    ('projects'),
    ('workspaces'),
    ('workspace_members'),
    ('workspace_invitations'),
    ('team_members'),
    ('accounts'),
    ('organizations'),
    ('teams'),
    ('project_members')
),
required(name) as (
  values
    ('profiles'),
    ('projects'),
    ('workspaces'),
    ('workspace_members'),
    ('workspace_invitations')
)
select
  e.name as table_name,
  to_regclass('public.' || e.name) is not null as present,
  case when r.name is not null then 'required' else 'optional' end as kind
from expected e
left join required r on r.name = e.name
order by kind, e.name;

-- Fail fast if any REQUIRED table is missing (run as separate check)
do $$
declare
  missing text[];
begin
  select array_agg(r.name order by r.name)
  into missing
  from (values
    ('profiles'),
    ('projects'),
    ('workspaces'),
    ('workspace_members'),
    ('workspace_invitations')
  ) as r(name)
  where to_regclass('public.' || r.name) is null;

  if missing is not null and array_length(missing, 1) > 0 then
    raise exception 'REQUIRED tables missing: %', array_to_string(missing, ', ');
  end if;
end $$;

-- ── 2) Optional legacy tables (informational only) ─────────────────────────
do $$
begin
  if to_regclass('public.team_members') is null then
    raise notice 'team_members missing: OK — this schema does not use legacy team_members';
  else
    raise notice 'team_members present (legacy table)';
  end if;

  if to_regclass('public.accounts') is null then
    raise notice 'accounts missing: OK — Vodex uses workspaces, not accounts';
  end if;

  if to_regclass('public.organizations') is null then
    raise notice 'organizations missing: OK';
  end if;

  if to_regclass('public.teams') is null then
    raise notice 'teams missing: OK';
  end if;

  if to_regclass('public.project_members') is null then
    raise notice 'project_members missing: OK — access via workspace_members';
  end if;
end $$;

-- ── 3) Column inventory (existing tables only) ─────────────────────────────
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    select name from (
      values
        ('workspaces'),
        ('workspace_members'),
        ('workspace_invitations'),
        ('team_members'),
        ('profiles'),
        ('projects')
    ) as t(name)
    where to_regclass('public.' || t.name) is not null
  )
order by c.table_name, c.ordinal_position;

-- ── 4) Foreign keys involving workspace (if workspaces exists) ─────────────
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as references_table
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
  and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'foreign key'
  and tc.table_schema = 'public'
  and to_regclass('public.workspaces') is not null
  and (
    kcu.column_name like '%workspace%'
    or ccu.table_name = 'workspaces'
  )
order by tc.table_name;

-- ── 5) Row counts (required tables only) ─────────────────────────────────────
select 'profiles' as tbl, count(*)::bigint as rows from public.profiles
union all
select 'projects', count(*) from public.projects
union all
select 'workspaces', count(*) from public.workspaces
union all
select 'workspace_members', count(*) from public.workspace_members
union all
select 'workspace_invitations', count(*) from public.workspace_invitations;

-- Optional: team_members row count (only when table exists)
do $$
begin
  if to_regclass('public.team_members') is not null then
    raise notice 'team_members rows: %', (select count(*) from public.team_members);
  end if;
end $$;

-- ── 6) Workspace billing mode column (post migration) ────────────────────────
do $$
begin
  if to_regclass('public.workspaces') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'workspaces'
        and column_name = 'billing_mode'
    ) then
      raise notice 'workspaces.billing_mode: present';
    else
      raise notice 'workspaces.billing_mode: missing — apply workspace billing migration';
    end if;
  end if;
end $$;
