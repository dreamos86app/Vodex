-- Align ensure_user_profile + stale free-plan balances with 30-credit free tier.
-- Referral default: 5 credits (app passes p_credits explicitly).

create or replace function public.ensure_user_profile(
  p_user_id uuid,
  p_email text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_free integer := public.plan_monthly_credits('free');
begin
  v_email := coalesce(nullif(trim(p_email), ''), '');
  insert into public.profiles (id, email, plan_id, plan_interval, credits_remaining, credits_limit, credits_used, onboarding_completed, experience_level)
  values (p_user_id, v_email, 'free', 'monthly', v_free, v_free, 0, false, 'beginner')
  on conflict (id) do nothing;

  update public.profiles set
    email = case when (email is null or email = '') and v_email <> '' then v_email else email end,
    plan_id = coalesce(plan_id, 'free'),
    plan_interval = coalesce(plan_interval, 'monthly'),
    credits_remaining = coalesce(credits_remaining, v_free),
    credits_limit = coalesce(credits_limit, v_free),
    credits_used = coalesce(credits_used, 0),
    onboarding_completed = coalesce(onboarding_completed, false),
    onboarding_step = coalesce(onboarding_step, 0),
    experience_level = coalesce(experience_level, 'beginner'),
    onboarding_answers = coalesce(onboarding_answers, '{}'::jsonb),
    credits_period_start = coalesce(credits_period_start, now()),
    credits_period_end = coalesce(credits_period_end, now() + interval '1 month'),
    updated_at = now()
  where id = p_user_id;
end;
$$;

update public.profiles
set
  credits_remaining = 30,
  credits_limit = 30,
  monthly_token_limit = coalesce(monthly_token_limit, 30),
  monthly_credit_limit = coalesce(monthly_credit_limit, 30),
  updated_at = now()
where plan_id = 'free'
  and coalesce(credits_used, 0) = 0
  and credits_remaining = 100
  and coalesce(credits_limit, 100) = 100;

-- Default parameter only — body unchanged from runtime repair migration
create or replace function public.claim_referral_reward(p_referred_id uuid, p_credits integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral record;
  v_key_referrer text;
  v_key_referred text;
begin
  if auth.uid() is not null and auth.uid() <> p_referred_id then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select * into v_referral from public.referrals
  where referred_id = p_referred_id
  order by created_at desc
  limit 1
  for update;

  if v_referral is null then
    return jsonb_build_object('success', false, 'error', 'no_pending_referral');
  end if;

  if v_referral.status = 'rewarded' then
    return jsonb_build_object('success', true, 'already_rewarded', true);
  end if;

  if v_referral.referrer_id = p_referred_id then
    return jsonb_build_object('success', false, 'error', 'self_referral');
  end if;

  v_key_referrer := 'referral:' || v_referral.referrer_id::text || ':' || p_referred_id::text || ':referrer';
  v_key_referred := 'referral:' || v_referral.referrer_id::text || ':' || p_referred_id::text || ':referred';

  update public.referrals
  set status = 'rewarded',
      rewarded_at = now(),
      reward_kind = 'credits',
      reward_amount = p_credits
  where id = v_referral.id and status <> 'rewarded';

  update public.profiles
  set credits_remaining = credits_remaining + p_credits
  where id in (v_referral.referrer_id, p_referred_id);

  insert into public.token_ledger (user_id, amount, reason, source, idempotency_key, metadata)
  values
    (v_referral.referrer_id, -p_credits, 'Referral reward (inviter)', 'referral', v_key_referrer,
      jsonb_build_object('referral_id', v_referral.id, 'role', 'referrer')),
    (p_referred_id, -p_credits, 'Referral welcome bonus', 'referral', v_key_referred,
      jsonb_build_object('referral_id', v_referral.id, 'role', 'referred'))
  on conflict do nothing;

  insert into public.credit_events (user_id, operation_id, model_id, credits_consumed, event_type, metadata)
  values
    (v_referral.referrer_id, v_key_referrer, 'system', -p_credits, 'grant',
      jsonb_build_object('referral_id', v_referral.id)),
    (p_referred_id, v_key_referred, 'system', -p_credits, 'grant',
      jsonb_build_object('referral_id', v_referral.id))
  on conflict do nothing;

  insert into public.referral_rewards (referral_id, user_id, role, credits, idempotency_key)
  values
    (v_referral.id, v_referral.referrer_id, 'referrer', p_credits, v_key_referrer),
    (v_referral.id, p_referred_id, 'referred', p_credits, v_key_referred)
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('success', true, 'credits_granted', p_credits);
exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.claim_referral_reward(uuid, integer) to authenticated, service_role;
