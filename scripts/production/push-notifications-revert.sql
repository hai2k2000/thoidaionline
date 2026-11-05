-- Stop PUSH_DISPATCH_ENABLED before this separately approved rollback.
-- Preserve device registrations, queue history and C-01 lockdown. Restoring the
-- previous application and removing this trigger stops new notification rows.
begin;
drop trigger if exists trg_enqueue_task_assignment_notification on public.task_assignees;
revoke all on function public.claim_push_notifications(text[]) from public,anon,authenticated,service_role;
revoke all on function public.enqueue_task_assignment_notification() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
