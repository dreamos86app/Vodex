-- DreamOS86 — Create/Build product columns (idempotent)
alter table public.projects add column if not exists short_description text;
alter table public.projects add column if not exists category text;
alter table public.conversations add column if not exists project_id uuid references public.projects (id) on delete set null;
alter table public.conversations add column if not exists mode text;

create index if not exists conversations_project_user_idx
  on public.conversations (user_id, project_id, updated_at desc);

NOTIFY pgrst, 'reload schema';
