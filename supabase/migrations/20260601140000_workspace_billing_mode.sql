-- Workspace billing mode + AI usage attribution (actor vs billed user)
-- Idempotent. Apply after 20260601120000_workspace_invitations.sql

alter table public.workspaces
  add column if not exists billing_mode text not null default 'personal_credits';

alter table public.workspaces
  drop constraint if exists workspaces_billing_mode_check;

alter table public.workspaces
  add constraint workspaces_billing_mode_check
  check (billing_mode in ('personal_credits', 'workspace_sponsored', 'hybrid'));

comment on column public.workspaces.billing_mode is
  'personal_credits: members pay with own credits; workspace_sponsored: owner pool; hybrid: personal first then owner';

-- Future enterprise pool columns (optional placeholders)
alter table public.workspaces add column if not exists workspace_build_credits integer;
alter table public.workspaces add column if not exists workspace_action_credits integer;

alter table public.ai_usage_logs add column if not exists actor_user_id uuid references auth.users (id) on delete set null;
alter table public.ai_usage_logs add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.ai_usage_logs add column if not exists billed_to_type text;
alter table public.ai_usage_logs add column if not exists billed_to_user_id uuid references auth.users (id) on delete set null;
alter table public.ai_usage_logs add column if not exists action_type text;

create index if not exists ai_usage_logs_actor_idx on public.ai_usage_logs (actor_user_id, created_at desc);
create index if not exists ai_usage_logs_billed_to_idx on public.ai_usage_logs (billed_to_user_id, created_at desc);
create index if not exists ai_usage_logs_workspace_idx on public.ai_usage_logs (workspace_id, created_at desc);

notify pgrst, 'reload schema';
