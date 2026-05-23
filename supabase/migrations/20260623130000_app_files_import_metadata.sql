-- ============================================================
-- DreamOS86 — app_files import metadata columns (mime_type, etc.)
-- Aligns remote schema with builder/ZIP import code expectations.
-- ============================================================

alter table public.app_files add column if not exists mime_type text default 'text/plain';
alter table public.app_files add column if not exists size_bytes bigint default 0;
alter table public.app_files add column if not exists source text default 'generated';

update public.app_files
set mime_type = coalesce(nullif(trim(mime_type), ''), 'text/plain')
where mime_type is null;

update public.app_files
set size_bytes = coalesce(octet_length(content), 0)
where size_bytes is null or size_bytes = 0;

update public.app_files
set source = coalesce(nullif(trim(source), ''), 'generated')
where source is null;

create index if not exists app_files_project_path_idx
  on public.app_files (project_id, path);

create index if not exists app_files_project_source_idx
  on public.app_files (project_id, source);

notify pgrst, 'reload schema';
