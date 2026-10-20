begin;

alter table public.db_records add column if not exists client_request_id text;
alter table public.db_record_files add column if not exists upload_request_id text;

create unique index if not exists db_records_creator_request_idx
  on public.db_records (created_by, client_request_id)
  where client_request_id is not null;

create unique index if not exists db_record_files_upload_request_idx
  on public.db_record_files (record_id, upload_request_id)
  where upload_request_id is not null;

commit;
