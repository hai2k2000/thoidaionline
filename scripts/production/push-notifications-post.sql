select case when
  to_regclass('public.push_subscriptions') is not null
  and to_regclass('public.notifications_unsent_idx') is not null
  and exists(select 1 from pg_trigger where tgname='trg_enqueue_task_assignment_notification' and not tgisinternal)
  and exists(select 1 from pg_class where oid='public.push_subscriptions'::regclass and relrowsecurity)
  and exists(select 1 from pg_class where oid='public.notifications'::regclass and relrowsecurity)
  and not has_table_privilege('anon','public.push_subscriptions','select')
  and not has_table_privilege('authenticated','public.push_subscriptions','insert')
  and not has_table_privilege('anon','public.notifications','select')
  and not has_function_privilege('authenticated','public.claim_push_notifications(text[])','execute')
  and has_function_privilege('service_role','public.claim_push_notifications(text[])','execute')
then 'pass' else 'fail' end;
