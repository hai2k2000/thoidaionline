begin;

-- The browser must not call these SECURITY DEFINER functions directly. The
-- application server authenticates its HttpOnly signed session, supplies the
-- actor ID, and invokes these functions with service_role only.
revoke all on function public.claim_task_plan(uuid, uuid) from public;
revoke all on function public.claim_task_plan(uuid, uuid) from anon;
revoke all on function public.claim_task_plan(uuid, uuid) from authenticated;
grant execute on function public.claim_task_plan(uuid, uuid) to service_role;

revoke all on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) from public;
revoke all on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) from anon;
revoke all on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) from authenticated;
grant execute on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) to service_role;

alter function public.claim_task_plan(uuid, uuid) owner to postgres;
alter function public.claim_task_plan(uuid, uuid) set search_path = public, pg_temp;
alter function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) owner to postgres;
alter function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) set search_path = public, pg_temp;

commit;
