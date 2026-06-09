-- P1.3.28b — Groups INSERT grants, multi-category, member policies

alter table public.groups add column if not exists categories text[] not null default array['General']::text[];

update public.groups
set categories = array[category]
where (categories is null or cardinality(categories) = 0)
  and category is not null;

-- Full table grants (fixes "permission denied for table groups")
grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, update, delete on public.group_members to authenticated;
grant select, insert, update, delete on public.group_messages to authenticated;
grant select, insert, update, delete on public.discussion_reply_likes to authenticated;
grant select, insert on public.user_follows to authenticated;
grant delete on public.user_follows to authenticated;
grant select, insert on public.profile_visits to authenticated;

-- Allow creators to delete their groups
drop policy if exists "groups: delete creator" on public.groups;
create policy "groups: delete creator"
  on public.groups for delete
  using (auth.uid() = creator_id);

-- Admins can remove members (creator or admin role)
drop policy if exists "group_members: delete admin" on public.group_members;
create policy "group_members: delete admin"
  on public.group_members for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
        and gm.role in ('admin', 'owner')
    )
    or exists (
      select 1 from public.groups g
      where g.id = group_members.group_id and g.creator_id = auth.uid()
    )
  );

drop policy if exists "group_members: update admin" on public.group_members;
create policy "group_members: update admin"
  on public.group_members for update
  using (
    exists (
      select 1 from public.groups g
      where g.id = group_members.group_id and g.creator_id = auth.uid()
    )
  );

-- Public read for public groups' members (member count display)
drop policy if exists "group_members: read public group" on public.group_members;
create policy "group_members: read public group"
  on public.group_members for select
  using (
    exists (
      select 1 from public.groups g
      where g.id = group_members.group_id and coalesce(g.is_public, true) = true
    )
  );
