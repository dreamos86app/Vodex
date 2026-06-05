-- P4.6: Auth diagnostics + custom OAuth credential metadata

alter table public.app_auth_provider_settings
  add column if not exists last_auth_error text,
  add column if not exists last_auth_error_at timestamptz,
  add column if not exists custom_oauth_meta jsonb not null default '{}'::jsonb;

comment on column public.app_auth_provider_settings.last_auth_error is 'Last published auth error (safe message for owner UI)';
comment on column public.app_auth_provider_settings.custom_oauth_meta is 'Non-secret custom OAuth status (configured providers, updated_at)';

notify pgrst, 'reload schema';
