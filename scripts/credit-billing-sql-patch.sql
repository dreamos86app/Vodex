-- DreamOS86 credit billing repair patch (idempotent — paste entire file in Supabase SQL Editor)

create extension if not exists "pgcrypto";

do $$
declare
  r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'charge_tokens',
        'ensure_user_profile',
        'dreamos_debug_credit_rpc',
        'dreamos_reload_pgrst_schema'
      )
  loop
    execute format(
      'drop function if exists %I.%I(%s) cascade',
      r.nspname,
      r.proname,
      r.args
    );
  end loop;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text default '',
  workspace_name text default 'My Workspace',
  plan_id text default 'free',
  plan_interval text default 'monthly',
  credits_remaining integer default 100,
  credits_limit integer default 100,
  credits_used integer default 0,
  onboarding_completed boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  operation_id text,
  amount integer default 0,
  balance_after integer,
  reason text,
  project_id uuid,
  conversation_id uuid,
  model_id text,
  provider text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.token_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  amount integer default 0,
  reason text,
  source text default 'ai_usage',
  idempotency_key text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  user_email text,
  project_id uuid,
  conversation_id uuid,
  message_id uuid,
  operation_id text,
  mode text,
  model_id text,
  provider text,
  route_reason text,
  tokens_input integer default 0,
  tokens_output integer default 0,
  tokens_charged integer default 0,
  credits_charged integer default 0,
  estimated_provider_cost numeric default 0,
  charged_after_success boolean default false,
  status text default 'pending',
  error_message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text default '';
alter table public.profiles add column if not exists workspace_name text default 'My Workspace';
alter table public.profiles add column if not exists plan_id text default 'free';
alter table public.profiles add column if not exists plan_interval text default 'monthly';
alter table public.profiles add column if not exists credits_remaining integer default 100;
alter table public.profiles add column if not exists credits_limit integer default 100;
alter table public.profiles add column if not exists credits_used integer default 0;
alter table public.profiles add column if not exists onboarding_completed boolean default false;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

alter table public.credit_events add column if not exists user_id uuid;
alter table public.credit_events add column if not exists operation_id text;
alter table public.credit_events add column if not exists amount integer default 0;
alter table public.credit_events add column if not exists balance_after integer;
alter table public.credit_events add column if not exists reason text;
alter table public.credit_events add column if not exists project_id uuid;
alter table public.credit_events add column if not exists conversation_id uuid;
alter table public.credit_events add column if not exists model_id text;
alter table public.credit_events add column if not exists provider text;
alter table public.credit_events add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.credit_events add column if not exists created_at timestamptz default now();

alter table public.token_ledger add column if not exists user_id uuid;
alter table public.token_ledger add column if not exists amount integer default 0;
alter table public.token_ledger add column if not exists reason text;
alter table public.token_ledger add column if not exists source text default 'ai_usage';
alter table public.token_ledger add column if not exists idempotency_key text;
alter table public.token_ledger add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.token_ledger add column if not exists created_at timestamptz default now();

alter table public.ai_usage_logs add column if not exists user_email text;
alter table public.ai_usage_logs add column if not exists project_id uuid;
alter table public.ai_usage_logs add column if not exists conversation_id uuid;
alter table public.ai_usage_logs add column if not exists message_id uuid;
alter table public.ai_usage_logs add column if not exists operation_id text;
alter table public.ai_usage_logs add column if not exists mode text;
alter table public.ai_usage_logs add column if not exists model_id text;
alter table public.ai_usage_logs add column if not exists provider text;
alter table public.ai_usage_logs add column if not exists route_reason text;
alter table public.ai_usage_logs add column if not exists tokens_input integer default 0;
alter table public.ai_usage_logs add column if not exists tokens_output integer default 0;
alter table public.ai_usage_logs add column if not exists tokens_charged integer default 0;
alter table public.ai_usage_logs add column if not exists credits_charged integer default 0;
alter table public.ai_usage_logs add column if not exists estimated_provider_cost numeric default 0;
alter table public.ai_usage_logs add column if not exists charged_after_success boolean default false;
alter table public.ai_usage_logs add column if not exists status text default 'pending';
alter table public.ai_usage_logs add column if not exists error_message text;
alter table public.ai_usage_logs add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.ai_usage_logs add column if not exists created_at timestamptz default now();

create unique index if not exists credit_events_operation_id_unique
  on public.credit_events (operation_id)
  where operation_id is not null;

create or replace function public.ensure_user_profile(
  p_user_id uuid,
  p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'user_id_required');
  end if;

  v_email := coalesce(nullif(trim(p_email), ''), '');

  insert into public.profiles (
    id, email, workspace_name, plan_id, plan_interval,
    credits_remaining, credits_limit, credits_used, onboarding_completed
  )
  values (
    p_user_id, v_email, 'My Workspace', 'free', 'monthly', 100, 100, 0, false
  )
  on conflict (id) do nothing;

  update public.profiles set
    email = case when (email is null or email = '') and v_email <> '' then v_email else email end,
    workspace_name = coalesce(nullif(workspace_name, ''), 'My Workspace'),
    plan_id = coalesce(plan_id, 'free'),
    plan_interval = coalesce(plan_interval, 'monthly'),
    credits_remaining = coalesce(credits_remaining, 100),
    credits_limit = coalesce(credits_limit, 100),
    credits_used = coalesce(credits_used, 0),
    onboarding_completed = coalesce(onboarding_completed, false),
    updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('ok', true, 'user_id', p_user_id);
end;
$$;

create or replace function public.charge_tokens(
  p_amount integer,
  p_conversation_id uuid default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_project_id uuid default null,
  p_reason text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
  v_op text;
  v_balance_after integer;
  v_provider text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'success', false, 'error', 'user_id_required');
  end if;

  v_op := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_provider := nullif(trim(coalesce(p_metadata->>'provider', '')), '');

  perform public.ensure_user_profile(p_user_id, null);

  if v_op is not null and exists (
    select 1 from public.credit_events where operation_id = v_op
  ) then
    select credits_remaining into v_remaining from public.profiles where id = p_user_id;
    return jsonb_build_object(
      'ok', true,
      'success', true,
      'charged', false,
      'balance_after', coalesce(v_remaining, 0),
      'remaining', coalesce(v_remaining, 0),
      'operation_id', v_op,
      'idempotent', true
    );
  end if;

  if p_amount < 1 then
    select credits_remaining into v_remaining from public.profiles where id = p_user_id;
    return jsonb_build_object(
      'ok', false,
      'success', false,
      'error', 'invalid_amount',
      'balance_after', coalesce(v_remaining, 0),
      'remaining', coalesce(v_remaining, 0)
    );
  end if;

  select credits_remaining into v_remaining
    from public.profiles
    where id = p_user_id
    for update;

  if v_remaining is null then
    return jsonb_build_object('ok', false, 'success', false, 'error', 'profile_missing', 'remaining', 0);
  end if;

  if v_remaining < p_amount then
    return jsonb_build_object(
      'ok', false,
      'success', false,
      'error', 'insufficient_credits',
      'remaining', v_remaining,
      'balance_after', v_remaining
    );
  end if;

  v_balance_after := v_remaining - p_amount;

  update public.profiles
    set credits_remaining = v_balance_after,
        credits_used = coalesce(credits_used, 0) + p_amount,
        updated_at = now()
    where id = p_user_id;

  insert into public.credit_events (
    user_id, operation_id, amount, balance_after, reason,
    project_id, conversation_id, model_id, credits_consumed, event_type, provider_cost_usd, status, metadata
  )
  values (
    p_user_id,
    v_op,
    p_amount,
    v_balance_after,
    coalesce(p_reason, 'AI usage'),
    p_project_id,
    p_conversation_id,
    coalesce(p_metadata->>'model_id', 'unknown'),
    p_amount,
    'generation',
    coalesce((p_metadata->>'provider_cost_usd')::numeric, 0),
    'finalized',
    coalesce(p_metadata, '{}'::jsonb)
  );

  insert into public.token_ledger (
    user_id, amount, reason, source, metadata, idempotency_key
  )
  values (
    p_user_id,
    p_amount,
    coalesce(p_reason, 'Token charge'),
    'ai_usage',
    coalesce(p_metadata, '{}'::jsonb),
    v_op
  );

  return jsonb_build_object(
    'ok', true,
    'success', true,
    'charged', true,
    'operation_id', v_op,
    'remaining', v_balance_after,
    'balance_after', v_balance_after
  );
exception
  when unique_violation then
    select credits_remaining into v_remaining from public.profiles where id = p_user_id;
    return jsonb_build_object(
      'ok', true,
      'success', true,
      'charged', false,
      'balance_after', coalesce(v_remaining, 0),
      'remaining', coalesce(v_remaining, 0),
      'idempotent', true
    );
end;
$$;

revoke execute on function public.ensure_user_profile(uuid, text) from public, anon;
grant execute on function public.ensure_user_profile(uuid, text) to service_role;

revoke execute on function public.charge_tokens(integer, uuid, text, jsonb, uuid, text, uuid) from public, anon;
grant execute on function public.charge_tokens(integer, uuid, text, jsonb, uuid, text, uuid) to service_role;

create or replace function public.dreamos_reload_pgrst_schema()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_notify('pgrst', 'reload schema');
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.dreamos_reload_pgrst_schema() from public, anon;
grant execute on function public.dreamos_reload_pgrst_schema() to service_role;

create or replace function public.dreamos_debug_credit_rpc()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  return jsonb_build_object(
    'profiles_exists', exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'profiles'
    ),
    'credit_events_exists', exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'credit_events'
    ),
    'token_ledger_exists', exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'token_ledger'
    ),
    'ai_usage_logs_exists', exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'ai_usage_logs'
    ),
    'charge_tokens_signatures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'args', pg_get_function_identity_arguments(p.oid),
        'returns', pg_get_function_result(p.oid),
        'arg_names', to_jsonb(p.proargnames)
      ) order by pg_get_function_identity_arguments(p.oid))
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'charge_tokens'
    ), '[]'::jsonb),
    'ensure_user_profile_signatures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'args', pg_get_function_identity_arguments(p.oid),
        'returns', pg_get_function_result(p.oid),
        'arg_names', to_jsonb(p.proargnames)
      ) order by pg_get_function_identity_arguments(p.oid))
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'ensure_user_profile'
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.dreamos_debug_credit_rpc() from public, anon;
grant execute on function public.dreamos_debug_credit_rpc() to service_role;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  pg_get_function_result(p.oid) as returns
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('charge_tokens', 'ensure_user_profile')
order by p.proname, args;
