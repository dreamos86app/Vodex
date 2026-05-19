-- DreamOS86 — Admin billing, token_ledger, admin_audit_logs, plan tiers, owner RPCs

-- ── Plan enum: starter + infinity ───────────────────────────────────────────
do $$ begin
  alter type public.plan_id add value if not exists 'starter';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.plan_id add value if not exists 'infinity';
exception when duplicate_object then null;
end $$;

-- ── profiles: last active ───────────────────────────────────────────────────
alter table public.profiles add column if not exists last_active_at timestamptz;

-- ── subscriptions: pending downgrade ──────────────────────────────────────────
alter table public.subscriptions add column if not exists pending_downgrade_plan public.plan_id;

-- ── token_ledger (append-only) ────────────────────────────────────────────────
create table if not exists public.token_ledger (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null,
  reason text,
  source text not null check (
    source in (
      'admin_grant',
      'monthly_reset',
      'purchase',
      'ai_usage',
      'refund',
      'adjustment'
    )
  ),
  admin_user_id uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists token_ledger_user_created_idx
  on public.token_ledger (user_id, created_at desc);

alter table public.token_ledger enable row level security;

drop policy if exists "token_ledger: own read" on public.token_ledger;
create policy "token_ledger: own read"
  on public.token_ledger for select
  using (user_id = auth.uid());

-- ── admin_audit_logs ──────────────────────────────────────────────────────────
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  target_user_id uuid references public.profiles (id) on delete set null,
  before_state jsonb,
  after_state jsonb,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs (created_at desc);

alter table public.admin_audit_logs enable row level security;

-- No client policies — service role / security definer only

-- ── credit_events: extend event types ─────────────────────────────────────────
alter table public.credit_events drop constraint if exists credit_events_event_type_check;
alter table public.credit_events add constraint credit_events_event_type_check check (
  event_type in (
    'generation',
    'upload',
    'deploy',
    'grant',
    'reset',
    'refund',
    'adjustment',
    'admin_set'
  )
);

-- ── Owner check helper ────────────────────────────────────────────────────────
create or replace function public.is_dreamos_owner(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (
      select lower(trim(u.email::text)) = 'dreamos86app@gmail.com'
      from auth.users u
      where u.id = p_user_id
    ),
    false
  );
$$;

-- ── Insert token ledger + mirror credit_events ────────────────────────────────
create or replace function public.record_token_ledger(
  p_user_id uuid,
  p_amount int,
  p_source text,
  p_reason text default null,
  p_admin_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_type text;
begin
  insert into public.token_ledger (user_id, amount, reason, source, admin_user_id, metadata)
  values (p_user_id, p_amount, p_reason, p_source, p_admin_user_id, coalesce(p_metadata, '{}'::jsonb));

  v_event_type := case p_source
    when 'admin_grant' then 'grant'
    when 'monthly_reset' then 'reset'
    when 'purchase' then 'grant'
    when 'refund' then 'refund'
    when 'adjustment' then 'adjustment'
    when 'ai_usage' then 'generation'
    else 'adjustment'
  end;

  insert into public.credit_events (
    user_id,
    operation_id,
    model_id,
    credits_consumed,
    event_type,
    metadata
  )
  values (
    p_user_id,
    'ledger_' || gen_random_uuid()::text,
    coalesce(p_metadata->>'model_id', 'system'),
    p_amount,
    v_event_type,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- ── Admin: add tokens ─────────────────────────────────────────────────────────
create or replace function public.admin_add_tokens(
  p_admin_id uuid,
  p_user_id uuid,
  p_amount int,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_dreamos_owner(p_admin_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;
  if p_amount < 1 then
    return jsonb_build_object('success', false, 'error', 'invalid_amount');
  end if;

  update public.profiles
  set credits_remaining = credits_remaining + p_amount
  where id = p_user_id;

  perform public.record_token_ledger(
    p_user_id,
    -p_amount,
    'admin_grant',
    p_reason,
    p_admin_id,
    jsonb_build_object('delta', p_amount)
  );

  return jsonb_build_object('success', true);
end;
$$;

-- ── Admin: set exact balance ──────────────────────────────────────────────────
create or replace function public.admin_set_token_balance(
  p_admin_id uuid,
  p_user_id uuid,
  p_balance int,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_before int;
  v_delta int;
begin
  if not public.is_dreamos_owner(p_admin_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;
  if p_balance < 0 then
    return jsonb_build_object('success', false, 'error', 'invalid_balance');
  end if;

  select credits_remaining into v_before from public.profiles where id = p_user_id;
  if v_before is null then
    return jsonb_build_object('success', false, 'error', 'user_not_found');
  end if;

  v_delta := p_balance - v_before;

  update public.profiles set credits_remaining = p_balance where id = p_user_id;

  if v_delta <> 0 then
    perform public.record_token_ledger(
      p_user_id,
      v_delta,
      'adjustment',
      p_reason,
      p_admin_id,
      jsonb_build_object('before', v_before, 'after', p_balance)
    );
  end if;

  return jsonb_build_object('success', true, 'before', v_before, 'after', p_balance);
end;
$$;

-- ── Admin: reset monthly tokens to plan quota ───────────────────────────────────
create or replace function public.admin_reset_monthly_tokens(
  p_admin_id uuid,
  p_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_plan public.plan_id;
  v_quota int;
begin
  if not public.is_dreamos_owner(p_admin_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select plan_id into v_plan from public.profiles where id = p_user_id;
  if v_plan is null then
    return jsonb_build_object('success', false, 'error', 'user_not_found');
  end if;

  v_quota := case v_plan
    when 'free' then 100
    when 'starter' then 1000
    when 'pro' then 2500
    when 'business' then 2500
    when 'infinity' then 5000
    when 'enterprise' then 5000
    else 100
  end;

  update public.profiles
  set
    credits_remaining = v_quota,
    credits_reset_at = now() + interval '1 month'
  where id = p_user_id;

  perform public.record_token_ledger(
    p_user_id,
    -v_quota,
    'monthly_reset',
    p_reason,
    p_admin_id,
    jsonb_build_object('plan', v_plan, 'quota', v_quota)
  );

  return jsonb_build_object('success', true, 'quota', v_quota);
end;
$$;

-- ── Admin: set plan (manual override) ─────────────────────────────────────────
create or replace function public.admin_set_plan(
  p_admin_id uuid,
  p_user_id uuid,
  p_plan public.plan_id,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_before public.plan_id;
  v_quota int;
begin
  if not public.is_dreamos_owner(p_admin_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select plan_id into v_before from public.profiles where id = p_user_id;
  if v_before is null then
    return jsonb_build_object('success', false, 'error', 'user_not_found');
  end if;

  v_quota := case p_plan
    when 'free' then 100
    when 'starter' then 1000
    when 'pro' then 2500
    when 'business' then 2500
    when 'infinity' then 5000
    when 'enterprise' then 5000
    else 100
  end;

  update public.profiles
  set plan_id = p_plan, credits_remaining = v_quota, credits_reset_at = now() + interval '1 month'
  where id = p_user_id;

  return jsonb_build_object('success', true, 'before', v_before, 'after', p_plan, 'tokens', v_quota);
end;
$$;

-- ── Admin: suspend / unsuspend ──────────────────────────────────────────────────
create or replace function public.admin_set_suspended(
  p_admin_id uuid,
  p_user_id uuid,
  p_suspended boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_dreamos_owner(p_admin_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  update public.profiles
  set
    suspended_at = case when p_suspended then now() else null end,
    suspended_reason = case when p_suspended then p_reason else null end
  where id = p_user_id;

  return jsonb_build_object('success', true, 'suspended', p_suspended);
end;
$$;

-- Update grant_credits to also write token_ledger
create or replace function public.grant_credits(
  p_admin_id uuid,
  p_user_id uuid,
  p_amount int,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_is_admin boolean;
begin
  select coalesce(p.is_admin, false)
  into v_is_admin
  from public.profiles p
  where p.id = p_admin_id;

  if not coalesce(v_is_admin, false) and not public.is_dreamos_owner(p_admin_id) then
    return jsonb_build_object('success', false, 'error', 'not_admin');
  end if;

  update public.profiles
  set credits_remaining = credits_remaining + p_amount
  where id = p_user_id;

  perform public.record_token_ledger(
    p_user_id,
    -p_amount,
    'admin_grant',
    p_reason,
    p_admin_id,
    jsonb_build_object('via', 'grant_credits')
  );

  insert into public.audit_logs (actor_id, target_id, action, details)
  values (p_admin_id, p_user_id, 'credit_grant', jsonb_build_object('amount', p_amount, 'reason', p_reason));

  return jsonb_build_object('success', true, 'error', null);
end;
$$;

grant execute on function public.admin_add_tokens(uuid, uuid, int, text) to authenticated;
grant execute on function public.admin_set_token_balance(uuid, uuid, int, text) to authenticated;
grant execute on function public.admin_reset_monthly_tokens(uuid, uuid, text) to authenticated;
grant execute on function public.admin_set_plan(uuid, uuid, public.plan_id, text) to authenticated;
grant execute on function public.admin_set_suspended(uuid, uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';
