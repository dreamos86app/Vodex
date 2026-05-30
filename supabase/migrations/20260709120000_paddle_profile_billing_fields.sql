-- DreamOS86 platform billing: Paddle-only columns on profiles.
-- No Stripe backfill — production may not have stripe_* on profiles.

alter table public.profiles add column if not exists paddle_customer_id text;
alter table public.profiles add column if not exists paddle_subscription_id text;
alter table public.profiles add column if not exists paddle_price_id text;
alter table public.profiles add column if not exists billing_provider text default 'paddle';

comment on column public.profiles.paddle_customer_id is
  'Paddle customer id (ctm_*) for DreamOS86 platform subscription billing.';
comment on column public.profiles.paddle_subscription_id is
  'Paddle subscription id (sub_*) for DreamOS86 platform subscription billing.';
comment on column public.profiles.paddle_price_id is
  'Paddle price id (pri_*) for the active DreamOS86 platform plan.';
comment on column public.profiles.billing_provider is
  'DreamOS86 platform billing provider. Production value: paddle.';

update public.profiles
set billing_provider = 'paddle'
where billing_provider is null or trim(billing_provider) = '';

create index if not exists idx_profiles_paddle_customer_id
  on public.profiles (paddle_customer_id)
  where paddle_customer_id is not null;

create index if not exists idx_profiles_paddle_subscription_id
  on public.profiles (paddle_subscription_id)
  where paddle_subscription_id is not null;
