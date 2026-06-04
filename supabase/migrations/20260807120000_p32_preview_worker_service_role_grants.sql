-- P3.2 — Ensure preview worker tables are writable by service_role (RLS bypass does not grant table privileges)
-- Worker uses SUPABASE_SERVICE_ROLE_KEY only; no anon/authenticated policies for job mutation.

grant select, insert, update, delete on table public.preview_build_jobs to service_role;
grant select, insert, update, delete on table public.preview_worker_heartbeats to service_role;

grant select, insert, update, delete on table public.zip_preview_action_holds to service_role;

NOTIFY pgrst, 'reload schema';
