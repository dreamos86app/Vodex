-- DreamOS86 credit economy: quotes, reservations, audits, provider usage
-- Project: wciioegiczwqlmlroley

create table if not exists public.credit_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  generation_id text not null,
  mode text not null,
  quoted_user_credits integer not null default 0,
  internal_cost_credits integer not null default 0,
  provider_cost_usd numeric(12, 6) default 0,
  markup_multiplier numeric(8, 3) default 3,
  gross_margin_estimate numeric(8, 4) default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_quotes_user_idx on public.credit_quotes (user_id, created_at desc);
create index if not exists credit_quotes_generation_idx on public.credit_quotes (generation_id);

create table if not exists public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  generation_id text not null,
  mode text not null,
  quoted_user_credits integer not null default 0,
  reserved_user_credits integer not null default 0,
  final_user_credits integer,
  internal_cost_credits integer not null default 0,
  provider_cost_usd numeric(12, 6) default 0,
  markup_multiplier numeric(8, 3) default 3,
  gross_margin_estimate numeric(8, 4) default 0,
  status text not null default 'reserved'
    check (status in ('reserved', 'reconciled', 'refunded', 'failed')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists credit_reservations_generation_unique
  on public.credit_reservations (user_id, generation_id);

create table if not exists public.generation_cost_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  generation_id text not null,
  mode text not null,
  quoted_user_credits integer default 0,
  reserved_user_credits integer default 0,
  final_user_credits integer,
  internal_cost_credits integer default 0,
  provider_cost_usd numeric(12, 6) default 0,
  markup_multiplier numeric(8, 3),
  gross_margin_estimate numeric(8, 4),
  status text not null default 'quoted',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists generation_cost_audits_user_idx
  on public.generation_cost_audits (user_id, created_at desc);

create table if not exists public.provider_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  generation_id text,
  operation_type text,
  model_id text,
  provider text,
  input_tokens integer default 0,
  output_tokens integer default 0,
  provider_cost_usd numeric(12, 6) default 0,
  capped boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists provider_usage_logs_user_idx
  on public.provider_usage_logs (user_id, created_at desc);

alter table public.credit_quotes enable row level security;
alter table public.credit_reservations enable row level security;
alter table public.generation_cost_audits enable row level security;
alter table public.provider_usage_logs enable row level security;

drop policy if exists "Users read own credit quotes" on public.credit_quotes;
create policy "Users read own credit quotes"
  on public.credit_quotes for select using (auth.uid() = user_id);

drop policy if exists "Users read own credit reservations" on public.credit_reservations;
create policy "Users read own credit reservations"
  on public.credit_reservations for select using (auth.uid() = user_id);

drop policy if exists "Users read own generation audits" on public.generation_cost_audits;
create policy "Users read own generation audits"
  on public.generation_cost_audits for select using (auth.uid() = user_id);

drop policy if exists "Users read own provider usage" on public.provider_usage_logs;
create policy "Users read own provider usage"
  on public.provider_usage_logs for select using (auth.uid() = user_id);
