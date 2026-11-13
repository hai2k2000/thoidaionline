-- Append only missing legacy MIME types; preserve unrestricted buckets and all other fields.
begin;
set local lock_timeout = '5s';
update storage.buckets b
set allowed_mime_types = b.allowed_mime_types || array(
  select mime from unnest(array[
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint'
  ]) as additions(mime)
  where not (mime = any(b.allowed_mime_types))
)
where b.id in ('task-private','task-files')
  and b.allowed_mime_types is not null
  and not (b.allowed_mime_types @> array[
    'application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint'
  ]);
commit;
