-- P3.1 — Dedicated preview worker: job locking, source snapshots, RLS
-- After apply: NOTIFY pgrst, 'reload schema';

alter table public.preview_build_jobs
  drop constraint if exists preview_build_jobs_status_check;

alter table public.preview_build_jobs
  add column if not exists source_snapshot_path text,
  add column if not exists runtime_mode text,
  add column if not exists logs text,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists attempts int not null default 0;

alter table public.preview_build_jobs
  add constraint preview_build_jobs_status_check
  check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled'));

create index if not exists preview_build_jobs_status_created_idx
  on public.preview_build_jobs (status, created_at asc);

create index if not exists preview_build_jobs_locked_at_idx
  on public.preview_build_jobs (locked_at)
  where status in ('queued', 'running');

create index if not exists preview_build_jobs_project_id_idx
  on public.preview_build_jobs (project_id);

-- Owner can read jobs for owned projects (in addition to owner_id match)
drop policy if exists preview_build_jobs_project_owner_read on public.preview_build_jobs;
create policy preview_build_jobs_project_owner_read on public.preview_build_jobs
  for select using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.projects p
      where p.id = preview_build_jobs.project_id
        and p.owner_id = auth.uid()
    )
  );

-- Atomic job claim for preview worker (service role only)
create or replace function public.claim_preview_build_job(
  p_worker_id text,
  p_stale_lock_minutes int default 30
)
returns public.preview_build_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.preview_build_jobs;
  v_stale interval;
begin
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'worker_id required';
  end if;

  v_stale := make_interval(mins => greatest(p_stale_lock_minutes, 5));

  with candidate as (
    select id
    from public.preview_build_jobs
    where status = 'queued'
      and (
        locked_at is null
        or locked_at < now() - v_stale
      )
    order by created_at asc
    limit 1
    for update skip locked
  )
  update public.preview_build_jobs j
  set
    status = 'running',
    locked_at = now(),
    locked_by = p_worker_id,
    started_at = coalesce(j.started_at, now()),
    updated_at = now(),
    attempts = j.attempts + 1
  from candidate c
  where j.id = c.id
  returning j.* into v_job;

  return v_job;
end;
$$;

revoke all on function public.claim_preview_build_job(text, int) from public;
grant execute on function public.claim_preview_build_job(text, int) to service_role;

NOTIFY pgrst, 'reload schema';
