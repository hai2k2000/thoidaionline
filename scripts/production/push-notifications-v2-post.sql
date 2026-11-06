select case when
  to_regclass('public.notification_deliveries') is not null
  and (select count(*) from pg_trigger where not tgisinternal and tgname in (
    'trg_capture_task_assignment_actor','trg_enqueue_task_assignment_notification',
    'trg_enqueue_task_comment_notification','trg_enqueue_task_status_notification',
    'trg_enqueue_department_collaboration_notification'))=5
  and not exists(select 1 from pg_class c where c.oid in (
    'public.notifications'::regclass,'public.push_subscriptions'::regclass,'public.notification_deliveries'::regclass)
    and not c.relrowsecurity)
  and not exists(select 1 from unnest(array['public.notifications','public.push_subscriptions','public.notification_deliveries']) obj
    cross join unnest(array['anon','authenticated']) role_name
    cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name
    where has_table_privilege(role_name,obj,privilege_name))
  and not exists(select 1 from pg_proc p where p.pronamespace='public'::regnamespace
    and p.proname in ('push_mutation_actor','capture_task_assignment_actor','push_task_recipients',
      'push_notification_visible','enqueue_task_assignment_notification','enqueue_task_comment_notification',
      'enqueue_task_status_notification','enqueue_department_collaboration_notification','claim_push_notifications')
    and (not p.prosecdef or pg_get_userbyid(p.proowner)<>'postgres'
      or has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute')))
  and has_function_privilege('service_role','public.claim_push_notifications(text[])','execute')
  and has_table_privilege('service_role','public.notification_deliveries','SELECT,INSERT,UPDATE')
  and exists(select 1 from pg_constraint where conrelid='public.notification_deliveries'::regclass and contype='p')
then 'pass' else 'fail' end;
