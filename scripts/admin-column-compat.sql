-- DreamOS86 — Admin + credits + usage column compatibility (idempotent)
-- Run once in Supabase SQL Editor, then: NOTIFY pgrst, 'reload schema';
-- Kept in sync with: supabase/migrations/20260531120000_admin_full_compat.sql

-- ══════════════════════════════════════════════════════════════════════════════
-- subscriptions
-- ══════════════════════════════════════════════════════════════════════════════
alter table public.subscriptions add column if not exists stripe_price_id text;
alter table public.subscriptions add column if not exists stripe_subscription_id text;
alter table public.subscriptions add column if not exists stripe_customer_id text;
alter table public.subscriptions add column if not exists current_period_end timestamptz;
alter table public.subscriptions add column if not exists current_period_start timestamptz;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean default false;
alter table public.subscriptions add column if not exists pending_downgrade_plan text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'pending_downgrade'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'pending_downgrade_plan'
  ) then
    alter table public.subscriptions rename column pending_downgrade to pending_downgrade_plan;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'pending_downgrade'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'pending_downgrade_plan'
  ) then
    update public.subscriptions
    set pending_downgrade_plan = coalesce(pending_downgrade_plan, pending_downgrade::text)
    where pending_downgrade is not null;
  end if;
exception when others then null;
end $$;

grant select on public.subscriptions to service_role;
grant all on public.subscriptions to service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- admin_actions (legacy renames + compat columns)
-- ══════════════════════════════════════════════════════════════════════════════
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_actions' and column_name = 'actor_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_actions' and column_name = 'admin_id'
  ) then
    alter table public.admin_actions rename column actor_id to admin_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_actions' and column_name = 'target_user_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_actions' and column_name = 'target_id'
  ) then
    alter table public.admin_actions rename column target_user_id to target_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_actions' and column_name = 'action'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_actions' and column_name = 'action_type'
  ) then
    alter table public.admin_actions rename column action to action_type;
  end if;
exception when others then null;
end $$;

alter table public.admin_actions add column if not exists admin_id uuid references public.profiles (id) on delete cascade;
alter table public.admin_actions add column if not exists target_id uuid references public.profiles (id) on delete cascade;
alter table public.admin_actions add column if not exists action_type text;
alter table public.admin_actions add column if not exists admin_email text;
alter table public.admin_actions add column if not exists amount int;
alter table public.admin_actions add column if not exists credits_delta integer;
alter table public.admin_actions add column if not exists operation_id text;
alter table public.admin_actions add column if not exists reason text;
alter table public.admin_actions add column if not exists otp_verified boolean default false;
alter table public.admin_actions add column if not exists metadata jsonb default '{}'::jsonb;

-- ══════════════════════════════════════════════════════════════════════════════
-- credit_events
-- ══════════════════════════════════════════════════════════════════════════════
alter table public.credit_events add column if not exists operation_id text;
alter table public.credit_events add column if not exists credits_consumed integer default 0;
alter table public.credit_events add column if not exists amount integer;
alter table public.credit_events add column if not exists credits_delta integer;
alter table public.credit_events add column if not exists credits_charged integer;

do $$
begin
  update public.credit_events
  set credits_consumed = coalesce(credits_consumed, credits_charged, amount, 0)
  where credits_consumed is null or credits_consumed = 0;
exception when others then null;
end $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- ai_usage_logs
-- ══════════════════════════════════════════════════════════════════════════════
alter table public.ai_usage_logs add column if not exists user_email text default '';
alter table public.ai_usage_logs add column if not exists error_message text;
alter table public.ai_usage_logs add column if not exists tokens_input integer;
alter table public.ai_usage_logs add column if not exists tokens_output integer;
alter table public.ai_usage_logs add column if not exists tokens_charged integer default 0;
alter table public.ai_usage_logs add column if not exists credits_charged integer default 0;
alter table public.ai_usage_logs add column if not exists credits_consumed integer;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_usage_logs' and column_name = 'credits_charged'
  ) then
    update public.ai_usage_logs
    set tokens_charged = coalesce(nullif(tokens_charged, 0), credits_charged, tokens_charged, 0),
        credits_consumed = coalesce(credits_consumed, credits_charged, tokens_charged, 0)
    where tokens_charged is null or tokens_charged = 0 or credits_consumed is null;
  end if;
exception when others then null;
end $$;

create or replace function public.sync_ai_usage_credits_columns()
returns trigger
language plpgsql
as $$
begin
  if new.tokens_charged is not null and new.tokens_charged > 0 then
    new.credits_charged := coalesce(new.credits_charged, new.tokens_charged);
    new.credits_consumed := coalesce(new.credits_consumed, new.tokens_charged);
  elsif new.credits_charged is not null and new.credits_charged > 0 then
    new.tokens_charged := coalesce(new.tokens_charged, new.credits_charged);
    new.credits_consumed := coalesce(new.credits_consumed, new.credits_charged);
  elsif new.credits_consumed is not null and new.credits_consumed > 0 then
    new.tokens_charged := coalesce(new.tokens_charged, new.credits_consumed);
    new.credits_charged := coalesce(new.credits_charged, new.credits_consumed);
  end if;
  return new;
end;
$$;

drop trigger if exists ai_usage_logs_sync_credit_columns on public.ai_usage_logs;
create trigger ai_usage_logs_sync_credit_columns
  before insert or update on public.ai_usage_logs
  for each row execute function public.sync_ai_usage_credits_columns();

NOTIFY pgrst, 'reload schema';
