begin;
-- Roll back the endpoint only. Keep deleted_at and read filters so removed files
-- are not resurrected. Storage deletion is irreversible without a storage backup.
drop function if exists public.api_admin_delete_task_attachment(uuid,uuid,uuid,text);
notify pgrst,'reload schema';
commit;
