begin;

alter table public.task_completion_scores enable row level security;
revoke all on public.task_completion_scores from public, anon, authenticated;
grant select on public.task_completion_scores to service_role;

notify pgrst,'reload schema';
commit;
