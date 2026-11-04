begin transaction read only;

\echo '=== MIGRATION LEDGER ==='
-- Ledger timestamps are not a portable deployment-time source.
select version
from supabase_migrations.schema_migrations
where version in ('20261103150000','20261103160000','20261103180000','20261103200000')
order by version;

\echo '=== KEY FUNCTIONS: SECURITY DEFINER AND ACL ==='
-- Each expected name appears even when missing; all overloads are shown.
select expected.function_name, p.oid is not null as present,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
       p.prosecdef, p.proacl
from (values ('api_create_project'),('api_project_actor_can_create'),('api_transfer_project_lead'),
    ('api_project_can_assign'),('api_assign_project_task'),('api_review_assigned_task_completion'),
    ('validate_task_report_recipient'),('api_score_task_completion'),('guard_project_task_score_row'),
    ('guard_project_task_evaluation_row')) expected(function_name)
left join pg_catalog.pg_namespace n on n.nspname='public'
left join pg_catalog.pg_proc p on p.pronamespace=n.oid and p.proname=expected.function_name
order by expected.function_name, identity_arguments;

\echo '=== GUARD TRIGGERS ==='
-- tgenabled: O=normal, D=disabled, R=replica only, A=always.
select expected.table_name, expected.trigger_name, t.oid is not null as present,
       t.tgenabled, pg_catalog.pg_get_triggerdef(t.oid) as trigger_definition
from (values ('task_completion_scores','guard_project_task_score_row'),
    ('task_evaluation_checkpoints','guard_project_task_evaluation_row'),
    ('task_qualitative_evaluations','guard_project_task_evaluation_row'),
    ('tasks','validate_task_report_recipient'),
    ('project_members','guard_project_lead_role'),
    ('staff_users','guard_project_staff_role')) expected(table_name,trigger_name)
left join pg_catalog.pg_namespace n on n.nspname='public'
left join pg_catalog.pg_class c on c.relnamespace=n.oid and c.relname=expected.table_name
left join pg_catalog.pg_trigger t on t.tgrelid=c.oid and t.tgname=expected.trigger_name and not t.tgisinternal
order by expected.table_name, expected.trigger_name;

\echo '=== PROJECTS AND MEMBER ROLE COUNTS ==='
select p.code, p.name, p.status, d.name as host_department,
       count(pm.user_id) filter (where pm.role='lead') as lead_count,
       count(pm.user_id) filter (where pm.role='deputy') as deputy_count,
       count(pm.user_id) filter (where pm.role='member') as member_count
from public.projects p
join public.departments d on d.id=p.host_department_id
left join public.project_members pm on pm.project_id=p.id
group by p.id, p.code, p.name, p.status, d.name
order by p.code;

\echo '=== MEMBERS BY USERNAME ==='
select p.code, u.username, u.full_name, pm.role
from public.project_members pm
join public.projects p on p.id=pm.project_id
join public.staff_users u on u.id=pm.user_id
order by p.code, pm.role, u.username, u.full_name;

\echo '=== PROJECT.CREATE USER OVERRIDES ==='
select u.username, u.full_name, g.effect, g.scope, gb.username as granted_by_username
from public.user_permission_grants g
join public.permissions p on p.id=g.permission_id and p.code='project.create'
join public.staff_users u on u.id=g.user_id
left join public.staff_users gb on gb.id=g.created_by
order by u.username;

\echo '=== PROJECT TASK STATUS SUMMARY ==='
select p.code, t.status, count(*) as task_count
from public.tasks t
join public.projects p on p.id=t.project_id
group by p.code, t.status
order by p.code, t.status;

\echo '=== PROJECT TASKS WITH EVALUATION/SCORING ROWS ==='
-- Expected: zero for tasks created after the actual V1.2 activation time.
-- Older rows are preserved by V1.2. Compare created_at with operator deployment
-- evidence, NOT the migration filename date. No cutoff is guessed here.
select p.code, t.id as task_id, t.status, t.created_at,
       (select count(*) from public.task_completion_scores s where s.task_id=t.id) as score_rows,
       (select count(*) from public.task_evaluation_checkpoints e where e.task_id=t.id) as checkpoint_rows,
       (select count(*) from public.task_qualitative_evaluations q where q.task_id=t.id) as qualitative_rows
from public.tasks t
join public.projects p on p.id=t.project_id
where exists (select 1 from public.task_completion_scores s where s.task_id=t.id)
   or exists (select 1 from public.task_evaluation_checkpoints e where e.task_id=t.id)
   or exists (select 1 from public.task_qualitative_evaluations q where q.task_id=t.id)
order by p.code, t.created_at, t.id;

\echo '=== CONG_TAC_VIEN STAFF ==='
select u.username, u.full_name, u.active
from public.staff_users u
join public.roles r on r.id=u.role_id
where r.code='cong_tac_vien'
order by u.username;

rollback;
