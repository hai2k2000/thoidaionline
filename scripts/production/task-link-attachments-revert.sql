begin;
-- Disable the write endpoints only. Preserve task_links, library provenance,
-- tombstones, detail visibility and hard-delete cleanup to avoid losing data or
-- resurrecting deleted links. No storage objects need restoration.
drop function if exists public.api_add_task_link(uuid,uuid,text,text);
drop function if exists public.api_delete_task_link(uuid,uuid,uuid);
notify pgrst,'reload schema';
commit;