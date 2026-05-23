-- Rebalance plan monthly credits ($1 = 10 user credits)
-- free: 30 | starter: 200 | pro: 500 | infinity: 1000

create or replace function public.plan_monthly_credits(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan
    when 'free' then 30
    when 'starter' then 200
    when 'pro' then 500
    when 'business' then 500
    when 'infinity' then 1000
    when 'enterprise' then 1000
    else 30
  end;
$$;

-- New users start with 30 free credits
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    plan_id,
    billing_interval,
    credits_remaining,
    credits_limit,
    monthly_token_limit,
    monthly_credit_limit,
    onboarding_complete
  )
  values (
    new.id,
    coalesce(new.email, ''),
    'free',
    'monthly',
    30,
    30,
    30,
    30,
    false
  )
  on conflict (id) do update set
    email = excluded.email,
    credits_remaining = coalesce(public.profiles.credits_remaining, 30),
    credits_limit = coalesce(public.profiles.credits_limit, 30),
    monthly_token_limit = coalesce(public.profiles.monthly_token_limit, 30),
    monthly_credit_limit = coalesce(public.profiles.monthly_credit_limit, 30);
  return new;
end;
$$;
