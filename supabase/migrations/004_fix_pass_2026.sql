-- ============================================================
-- DreamOS86 — Fix Pass Migration (2026-05-18)
-- Safe to run multiple times (idempotent).
-- ============================================================

-- Ensure free-plan credits are correct (100, not 25)
update public.profiles
set
  credits_remaining = 100,
  plan_id = coalesce(plan_id, 'free')
where
  plan_id = 'free'
  and (credits_remaining is null or credits_remaining < 1);

-- Ensure every profile has a referral_code
update public.profiles
set referral_code = upper(substring(md5(id::text) for 8))
where referral_code is null or referral_code = '';

-- Ensure onboarding_completed exists (boolean, default false)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'onboarding_completed'
  ) then
    alter table public.profiles add column onboarding_completed boolean not null default false;
  end if;
end $$;

-- Ensure username column exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'username'
  ) then
    alter table public.profiles add column username text;
  end if;
end $$;

-- Backfill missing usernames from email prefix
update public.profiles
set username = lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9]', '', 'g'))
where username is null and email is not null;

-- Ensure groups table has member_count column
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'groups'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'groups'
        and column_name = 'member_count'
    ) then
      alter table public.groups add column member_count integer not null default 0;
    end if;
  end if;
end $$;

-- Update handle_new_user trigger to set 100 credits
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_username  text;
  v_referral_code text;
begin
  -- Extract display name from OAuth metadata
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  -- Clean up username
  v_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]', '', 'g'));

  -- Generate referral code
  v_referral_code := upper(substring(md5(new.id::text) for 8));

  insert into public.profiles (
    id,
    email,
    full_name,
    username,
    avatar_url,
    plan_id,
    credits_remaining,
    credits_reset_at,
    referral_code,
    onboarding_completed
  )
  values (
    new.id,
    new.email,
    v_full_name,
    v_username,
    new.raw_user_meta_data->>'avatar_url',
    'free',
    100,
    now() + interval '30 days',
    v_referral_code,
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Re-attach trigger (idempotent)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
