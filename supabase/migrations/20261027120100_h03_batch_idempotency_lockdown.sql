-- H-03: 20260925110000 creates task_assignment_batch_idempotency without RLS or revokes.
-- Lock it down like the other private tables (C-01): RLS on, no anon/authenticated/PUBLIC access,
-- service_role only. api_assign_task_batch_v1 is SECURITY DEFINER, so it keeps working.
begin;
alter table public.task_assignment_batch_idempotency enable row level security;
revoke all on table public.task_assignment_batch_idempotency from public, anon, authenticated;
grant select, insert, update, delete on table public.task_assignment_batch_idempotency to service_role;
commit;
