-- P5.4.4: Frozen credit ladder + margin optimization (provider/consumption tuning).
-- Canonical allowances: src/lib/billing/credit-formula.ts (FIXED_PLAN_CREDITS).
-- Production stores per-user balances on profiles + action_credit_balances;
-- plan_monthly_credits / plan_monthly_action_credits mirror app code for admin RPCs.

-- ── Build Credit allowances (monthly) ───────────────────────────────────────
create or replace function public.plan_monthly_credits(p_plan text)
returns integer
language sql
immutable
as $$
  select case coalesce(p_plan, 'free')
    when 'free' then 20
    when 'starter' then 150
    when 'pro' then 375
    when 'business' then 375
    when 'infinity' then 750
    when 'infinity_i' then 750
    when 'infinity_ii' then 1500
    when 'infinity_iii' then 2250
    when 'infinity_iv' then 2850
    when 'infinity_v' then 4250
    when 'infinity_vi' then 6500
    when 'infinity_vii' then 9300
    when 'enterprise' then 9300
    else 20
  end;
$$;

create or replace function public._plan_monthly_quota(p_plan text)
returns integer
language sql
immutable
as $$
  select public.plan_monthly_credits(p_plan);
$$;

-- ── Action Credit allowances (monthly) ──────────────────────────────────────
create or replace function public.plan_monthly_action_credits(p_plan text)
returns integer
language sql
immutable
as $$
  select case coalesce(p_plan, 'free')
    when 'free' then 20
    when 'starter' then 400
    when 'pro' then 1000
    when 'business' then 1000
    when 'infinity' then 2000
    when 'infinity_i' then 2000
    when 'infinity_ii' then 4000
    when 'infinity_iii' then 6000
    when 'infinity_iv' then 7600
    when 'infinity_v' then 11400
    when 'infinity_vi' then 17100
    when 'infinity_vii' then 25000
    when 'enterprise' then 25000
    else 20
  end;
$$;

-- ── Admin monthly action reset uses frozen ladder ─────────────────────────────
create or replace function public.admin_reset_action_credits_monthly(
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
  v_plan text;
  v_quota numeric;
begin
  perform public.require_dreamos_owner_session(p_admin_id);
  select plan_id into v_plan from public.profiles where id = p_user_id;
  if v_plan is null then
    return jsonb_build_object('success', false, 'error', 'user_not_found');
  end if;
  v_quota := public.plan_monthly_action_credits(v_plan);
  if to_regprocedure('public.ensure_action_credit_balance(uuid,uuid,numeric)') is not null then
    perform public.ensure_action_credit_balance(p_user_id, null, v_quota);
  end if;
  if to_regclass('public.action_credit_balances') is not null then
    update public.action_credit_balances
    set balance = v_quota, updated_at = now()
    where owner_user_id = p_user_id and project_id is null;
  end if;
  return jsonb_build_object('success', true, 'quota', v_quota, 'plan', v_plan);
end;
$$;

-- ── Clamp free-tier rows that exceed 20 BC / 20 AC ───────────────────────────
do $p544$
begin
  if to_regclass('public.profiles') is not null then
    update public.profiles
    set
      credits_remaining = least(credits_remaining, 20),
      credits_limit = least(coalesce(credits_limit, 20), 20),
      monthly_token_limit = least(coalesce(monthly_token_limit, 20), 20),
      monthly_credit_limit = least(coalesce(monthly_credit_limit, 20), 20),
      updated_at = now()
    where plan_id = 'free'
      and (
        credits_remaining > 20
        or coalesce(credits_limit, 0) > 20
        or coalesce(monthly_token_limit, 0) > 20
        or coalesce(monthly_credit_limit, 0) > 20
      );
  else
    raise notice 'P5.4.4: skipped profiles free-tier clamp (table missing)';
  end if;

  if to_regclass('public.action_credit_balances') is not null
     and to_regclass('public.profiles') is not null then
    update public.action_credit_balances acb
    set balance = least(acb.balance, 20), updated_at = now()
    from public.profiles p
    where acb.owner_user_id = p.id
      and acb.project_id is null
      and p.plan_id = 'free'
      and acb.balance > 20;
  else
    raise notice 'P5.4.4: skipped action_credit_balances free-tier clamp';
  end if;
end;
$p544$;

comment on function public.plan_monthly_credits(text) is
  'P5.4.4 frozen monthly Build Credits — mirrors FIXED_PLAN_CREDITS in app code.';

comment on function public.plan_monthly_action_credits(text) is
  'P5.4.4 frozen monthly Action Credits — mirrors FIXED_PLAN_CREDITS in app code.';
