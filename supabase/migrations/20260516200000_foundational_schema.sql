-- ─────────────────────────────────────────────────────────────────────────────
-- DreamOS86 — Foundational schema (Phase 2 enabling)
--
-- This migration establishes every table the application code already
-- references. Without it, /api/chat, credit accounting, projects,
-- deployments, and notifications all fall through to errors at runtime.
--
-- Idempotent: safe to re-run. Only creates objects that don't yet exist.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── Helper: updated_at trigger function ─────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text not null,
  full_name text,
  avatar_url text,
  plan_id text not null default 'free',
  plan_interval text not null default 'monthly' check (plan_interval in ('monthly', 'yearly')),
  credits_remaining integer not null default 0,
  credits_reset_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  role text not null default 'user' check (role in ('user', 'admin')),
  onboarding_complete boolean not null default false
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Bootstrap profile on auth.user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, credits_remaining, credits_reset_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    25, -- free plan starter credits
    now() + interval '30 days'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- conversations + messages
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New conversation',
  model_id text not null default 'claude-3-5-sonnet',
  pinned boolean not null default false,
  archived boolean not null default false,
  message_count integer not null default 0,
  last_message_at timestamptz
);

create index if not exists conversations_user_id_idx on public.conversations (user_id, updated_at desc);

drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

alter table public.conversations enable row level security;

drop policy if exists "Users access own conversations" on public.conversations;
create policy "Users access own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model_id text,
  credits_used integer not null default 0,
  finish_reason text,
  tokens_input integer,
  tokens_output integer,
  attachments jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists messages_conversation_id_idx on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "Users access own messages" on public.messages;
create policy "Users access own messages" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Bump conversation message_count + last_message_at on insert
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
    set message_count = message_count + 1,
        last_message_at = new.created_at,
        updated_at = now()
    where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- ─────────────────────────────────────────────────────────────────────────────
-- projects + deployments
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid,
  name text not null,
  description text,
  slug text not null,
  status text not null default 'draft' check (status in ('live', 'staging', 'draft', 'building', 'error')),
  framework text not null default 'nextjs',
  template_id uuid,
  gradient text not null default 'from-blue-500/20 via-indigo-500/10 to-violet-500/15',
  icon_url text,
  preview_url text,
  custom_domain text,
  is_public boolean not null default false,
  is_favorite boolean not null default false,
  category text,
  remix_of uuid references public.projects (id) on delete set null,
  remix_count integer not null default 0,
  launch_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique (owner_id, slug)
);

create index if not exists projects_owner_idx on public.projects (owner_id, updated_at desc);

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

drop policy if exists "Owners full access to projects" on public.projects;
create policy "Owners full access to projects" on public.projects
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Public projects are readable" on public.projects;
create policy "Public projects are readable" on public.projects
  for select using (is_public = true);

create table if not exists public.deployments (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'building', 'deployed', 'failed', 'cancelled')),
  environment text not null default 'production' check (environment in ('production', 'staging', 'preview')),
  url text,
  build_duration_ms integer,
  commit_message text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists deployments_project_idx on public.deployments (project_id, created_at desc);
create index if not exists deployments_user_idx on public.deployments (user_id, created_at desc);

alter table public.deployments enable row level security;

drop policy if exists "Users access own deployments" on public.deployments;
create policy "Users access own deployments" on public.deployments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- credit_events + consume_credits RPC
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.credit_events (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  operation_id text not null unique,
  model_id text not null,
  credits_consumed integer not null,
  event_type text not null check (event_type in ('generation', 'grant', 'reset', 'adjustment', 'refund'))
);

create index if not exists credit_events_user_idx on public.credit_events (user_id, created_at desc);

alter table public.credit_events enable row level security;

drop policy if exists "Users read own credit events" on public.credit_events;
create policy "Users read own credit events" on public.credit_events
  for select using (auth.uid() = user_id);

-- consume_credits: atomic deduction + ledger insert.
-- Self-check: callers can only operate on their own UUID. Service role
-- (auth.uid() = null) bypasses for server contexts.
create or replace function public.consume_credits(
  p_user_id uuid,
  p_amount integer,
  p_operation_id text,
  p_model_id text,
  p_conversation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_remaining integer;
  caller uuid;
begin
  caller := auth.uid();
  if caller is not null and caller <> p_user_id then
    return jsonb_build_object('success', false, 'error', 'forbidden', 'remaining', 0);
  end if;

  -- Lock the row to avoid double-spend
  select credits_remaining into current_remaining
    from public.profiles
    where id = p_user_id
    for update;

  if current_remaining is null then
    return jsonb_build_object('success', false, 'error', 'profile_missing', 'remaining', 0);
  end if;

  if current_remaining < p_amount then
    return jsonb_build_object('success', false, 'error', 'insufficient_credits', 'remaining', current_remaining);
  end if;

  update public.profiles
    set credits_remaining = current_remaining - p_amount
    where id = p_user_id;

  insert into public.credit_events (user_id, operation_id, model_id, credits_consumed, event_type, conversation_id)
  values (p_user_id, p_operation_id, p_model_id, p_amount, 'generation', p_conversation_id)
  on conflict (operation_id) do nothing;

  return jsonb_build_object('success', true, 'remaining', current_remaining - p_amount);
end;
$$;

revoke execute on function public.consume_credits(uuid, integer, text, text, uuid) from public, anon;
grant execute on function public.consume_credits(uuid, integer, text, text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- billing_events
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.billing_events (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_event_id text unique,
  event_type text not null,
  amount_usd numeric(10, 2),
  stripe_customer_id text,
  stripe_subscription_id text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists billing_events_user_idx on public.billing_events (user_id, created_at desc);

alter table public.billing_events enable row level security;

drop policy if exists "Users read own billing events" on public.billing_events;
create policy "Users read own billing events" on public.billing_events
  for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- notifications
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('deploy', 'build', 'invite', 'credit', 'system', 'ai', 'referral')),
  title text not null,
  body text not null,
  read boolean not null default false,
  action_url text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users access own notifications" on public.notifications;
create policy "Users access own notifications" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- analytics_events
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.analytics_events (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  properties jsonb not null default '{}'::jsonb
);

create index if not exists analytics_user_idx on public.analytics_events (user_id, created_at desc);
create index if not exists analytics_type_idx on public.analytics_events (event_type, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "Users read own analytics" on public.analytics_events;
create policy "Users read own analytics" on public.analytics_events
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert own analytics" on public.analytics_events;
create policy "Users insert own analytics" on public.analytics_events
  for insert with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- support_tickets + ticket_replies
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.support_tickets (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null,
  body text not null,
  category text not null default 'general',
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'closed'))
);

drop trigger if exists support_tickets_updated_at on public.support_tickets;
create trigger support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;

drop policy if exists "Users access own tickets" on public.support_tickets;
create policy "Users access own tickets" on public.support_tickets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ticket_replies (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  is_staff boolean not null default false,
  body text not null
);

alter table public.ticket_replies enable row level security;

drop policy if exists "Authors and ticket owners read replies" on public.ticket_replies;
create policy "Authors and ticket owners read replies" on public.ticket_replies
  for select using (
    auth.uid() = author_id or
    auth.uid() = (select user_id from public.support_tickets where id = ticket_id)
  );

drop policy if exists "Authors insert their replies" on public.ticket_replies;
create policy "Authors insert their replies" on public.ticket_replies
  for insert with check (auth.uid() = author_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- onboarding
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.onboarding (
  user_id uuid primary key references auth.users (id) on delete cascade,
  completed boolean not null default false,
  current_step integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists onboarding_updated_at on public.onboarding;
create trigger onboarding_updated_at
  before update on public.onboarding
  for each row execute function public.set_updated_at();

alter table public.onboarding enable row level security;

drop policy if exists "Users access own onboarding" on public.onboarding;
create policy "Users access own onboarding" on public.onboarding
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- api_keys
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.api_keys (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  hashed_key text not null,
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists api_keys_user_idx on public.api_keys (user_id);

alter table public.api_keys enable row level security;

drop policy if exists "Users access own api keys" on public.api_keys;
create policy "Users access own api keys" on public.api_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- media_assets
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.media_assets (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  filename text not null,
  storage_path text not null,
  public_url text,
  mime_type text not null,
  size_bytes bigint not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists media_assets_user_idx on public.media_assets (user_id, created_at desc);

alter table public.media_assets enable row level security;

drop policy if exists "Users access own media" on public.media_assets;
create policy "Users access own media" on public.media_assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2: REFERRAL SYSTEM (real, no fakery)
-- ─────────────────────────────────────────────────────────────────────────────

-- One referral code per user. Auto-generated short slug.
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

-- Each successful referral attribution
create table if not exists public.referrals (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referred_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  status text not null default 'pending' check (status in ('pending', 'qualified', 'rewarded', 'fraud')),
  rewarded_at timestamptz,
  reward_kind text check (reward_kind in ('credits', 'plan_days', 'feature_unlock')),
  reward_amount integer,
  attribution jsonb not null default '{}'::jsonb,
  unique (referred_id) -- a user can be referred only once
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_id, created_at desc);
create index if not exists referrals_status_idx on public.referrals (status);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

drop policy if exists "Users read own referral code" on public.referral_codes;
create policy "Users read own referral code" on public.referral_codes
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert own referral code" on public.referral_codes;
create policy "Users insert own referral code" on public.referral_codes
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users read own referrals" on public.referrals;
create policy "Users read own referrals" on public.referrals
  for select using (auth.uid() = referrer_id or auth.uid() = referred_id);

-- Generate unique 8-char base32-ish referral code
create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- Idempotent: returns the user's existing code or creates one
create or replace function public.ensure_referral_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_code text;
  new_code text;
  attempts integer := 0;
begin
  select code into existing_code from public.referral_codes where user_id = p_user_id;
  if existing_code is not null then
    return existing_code;
  end if;

  -- Try up to 5 times to avoid the (rare) collision
  loop
    new_code := public.generate_referral_code();
    attempts := attempts + 1;
    begin
      insert into public.referral_codes (user_id, code) values (p_user_id, new_code);
      return new_code;
    exception when unique_violation then
      if attempts >= 5 then raise; end if;
      continue;
    end;
  end loop;
end;
$$;

grant execute on function public.ensure_referral_code(uuid) to authenticated;

-- Atomic claim: when a referred user qualifies (e.g. completes onboarding),
-- mark the referral and grant rewards to BOTH parties exactly once.
create or replace function public.claim_referral_reward(p_referred_id uuid, p_credits integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral record;
begin
  select * into v_referral from public.referrals
    where referred_id = p_referred_id and status = 'pending'
    for update;

  if v_referral is null then
    return jsonb_build_object('success', false, 'error', 'no_pending_referral');
  end if;

  -- Mark rewarded
  update public.referrals
    set status = 'rewarded',
        rewarded_at = now(),
        reward_kind = 'credits',
        reward_amount = p_credits
    where id = v_referral.id;

  -- Grant credits to BOTH users
  update public.profiles set credits_remaining = credits_remaining + p_credits
    where id in (v_referral.referrer_id, v_referral.referred_id);

  -- Ledger entries
  insert into public.credit_events (user_id, operation_id, model_id, credits_consumed, event_type)
  values
    (v_referral.referrer_id, 'referral_reward_referrer_' || v_referral.id, 'system', -p_credits, 'grant'),
    (v_referral.referred_id, 'referral_reward_referred_' || v_referral.id, 'system', -p_credits, 'grant')
  on conflict (operation_id) do nothing;

  -- Notify both parties
  insert into public.notifications (user_id, type, title, body, action_url)
  values
    (v_referral.referrer_id, 'referral', 'Your invite paid off!',
      'Someone you invited just qualified. +' || p_credits || ' credits.',
      '/settings/account#referrals'),
    (v_referral.referred_id, 'referral', 'Welcome bonus',
      'You joined via a referral. +' || p_credits || ' credits.',
      '/credits');

  return jsonb_build_object('success', true, 'credits_granted', p_credits);
end;
$$;

grant execute on function public.claim_referral_reward(uuid, integer) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2: PROJECT MEMORY (real persistent AI context)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.project_memory (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in (
    'architecture', 'visual_identity', 'code_evolution', 'deployment',
    'preferences', 'workflow', 'components', 'design_system', 'intent', 'file_relationships'
  )),
  key text not null,
  value jsonb not null,
  importance integer not null default 5 check (importance between 1 and 10),
  unique (project_id, category, key)
);

create index if not exists project_memory_project_idx on public.project_memory (project_id, importance desc);

drop trigger if exists project_memory_updated_at on public.project_memory;
create trigger project_memory_updated_at
  before update on public.project_memory
  for each row execute function public.set_updated_at();

alter table public.project_memory enable row level security;

drop policy if exists "Users access own project memory" on public.project_memory;
create policy "Users access own project memory" on public.project_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- user_settings
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  timezone text not null default 'UTC',
  notifications jsonb not null default '{}'::jsonb,
  branding_watermark boolean not null default true,
  default_model_id text not null default 'claude-3-5-sonnet',
  updated_at timestamptz not null default now()
);

drop trigger if exists user_settings_updated_at on public.user_settings;
create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

drop policy if exists "Users access own settings" on public.user_settings;
create policy "Users access own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
