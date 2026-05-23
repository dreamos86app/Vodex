-- ============================================================
-- DreamOS86 — Private ZIP import storage bucket + RLS
-- Bucket: zip-imports (private; owner-scoped paths)
-- Path pattern: {user_id}/{import_id}/source.zip
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'zip-imports',
  'zip-imports',
  false,
  26214400, -- 25 MB
  array['application/zip', 'application/x-zip-compressed']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "zip-imports: owner insert" on storage.objects;
drop policy if exists "zip-imports: owner select" on storage.objects;
drop policy if exists "zip-imports: owner update" on storage.objects;
drop policy if exists "zip-imports: owner delete" on storage.objects;

create policy "zip-imports: owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'zip-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "zip-imports: owner select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'zip-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "zip-imports: owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'zip-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'zip-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "zip-imports: owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'zip-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
