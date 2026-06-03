-- P1.8 — project secrets metadata (app-scoped encrypted secrets)

alter table public.project_secrets
  add column if not exists provider text,
  add column if not exists status text not null default 'configured'
    check (status in ('configured', 'incomplete', 'invalid', 'missing')),
  add column if not exists last_four text,
  add column if not exists fingerprint text,
  add column if not exists last_tested_at timestamptz;

create index if not exists project_secrets_project_provider_idx
  on public.project_secrets (project_id, provider);

comment on table public.project_secrets is 'Per-app encrypted integration secrets (never plaintext at rest).';
