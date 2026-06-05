-- P4.5: Published app user profile sync columns

alter table public.app_user_profiles
  add column if not exists auth_user_id uuid,
  add column if not exists published_app_id uuid references public.published_apps (id) on delete set null,
  add column if not exists first_seen_at timestamptz;

alter table public.app_user_profiles
  drop constraint if exists app_user_profiles_project_auth_user_unique;

alter table public.app_user_profiles
  add constraint app_user_profiles_project_auth_user_unique unique (project_id, auth_user_id);

create index if not exists app_user_profiles_auth_user_idx
  on public.app_user_profiles (auth_user_id);

create index if not exists app_user_profiles_last_seen_idx
  on public.app_user_profiles (project_id, last_seen_at desc);

comment on column public.app_user_profiles.auth_user_id is 'Supabase auth.users id for published app end user';
comment on column public.app_user_profiles.published_app_id is 'Published app row when user signed up';
comment on column public.app_user_profiles.first_seen_at is 'First login/signup timestamp';

notify pgrst, 'reload schema';
