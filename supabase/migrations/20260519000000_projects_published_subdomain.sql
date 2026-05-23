-- Public app subdomain per project (e.g. {published_subdomain}.dreamos86.com)
-- Project ref: wciioegiczwqlmlroley

alter table public.projects add column if not exists published_subdomain text;

create unique index if not exists projects_published_subdomain_unique
  on public.projects (published_subdomain)
  where published_subdomain is not null and length(trim(published_subdomain)) > 0;

comment on column public.projects.published_subdomain is 'Stable public hostname label for DreamOS86-hosted web apps (no protocol).';

notify pgrst, 'reload schema';
