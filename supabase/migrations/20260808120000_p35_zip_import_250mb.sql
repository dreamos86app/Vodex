-- P3.5 — raise ZIP import storage limit to 250 MB
update storage.buckets
set file_size_limit = 262144000 -- 250 MB
where id = 'zip-imports';
