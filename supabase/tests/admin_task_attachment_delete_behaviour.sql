-- Run only in a disposable restored database. Real triggers remain enabled.
begin;
create function pg_temp.expect_state(p_sql text,p_state text) returns void language plpgsql as $$
begin
 begin execute p_sql; exception when others then if sqlstate=p_state then return; end if; raise; end;
 raise exception 'Expected SQLSTATE %',p_state;
end $$;
do $$
declare dept uuid; admin_id uuid; member_id uuid; fixture_manager uuid; p public.projects; t public.tasks; a public.task_attachments; suffix text:=replace(gen_random_uuid()::text,'-',''); n bigint;
begin
 insert into public.departments(code,name) values('zz_attachment_'||suffix,'Attachment fixture') returning id into dept;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Admin','zz_att_admin_'||suffix,'test-only',(select id from public.roles where code='admin'),dept) returning id into admin_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Member','zz_att_member_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept) returning id into member_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Manager','zz_att_manager_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept) returning id into fixture_manager;
 -- Staff insert triggers resynchronize managers, so assign after all inserts.
 update public.departments d set manager_id=fixture_manager where d.id=dept;
 p:=public.api_create_project(admin_id,'ZZ-ATT-'||suffix,'Attachment fixture',null,dept,array[fixture_manager]);
 perform public.api_set_project_member(admin_id,p.id,member_id,'member');
 t:=public.api_assign_project_task(admin_id,p.id,'Attachment fixture','Content',member_id,fixture_manager,current_date+1,'17:00','["requirement"]');
 a:=public.api_add_task_attachment(admin_id,t.id,t.id::text||'/'||gen_random_uuid()::text||'.pdf','fixture.pdf','application/pdf',10);
 set constraints all immediate;
 if not exists(select 1 from public.project_library_items where source_attachment_id=a.id and deleted_at is null) then raise exception 'Automatic library item missing'; end if;
 perform pg_temp.expect_state(format('select public.api_admin_delete_task_attachment(%L,%L,%L,%L)',member_id,t.id,a.id,'Denied'),'42501');
 perform pg_temp.expect_state(format('select public.api_admin_delete_task_attachment(%L,%L,%L,%L)',admin_id,t.id,a.id,''),'22023');
 perform pg_temp.expect_state(format('select public.api_admin_delete_task_attachment(%L,%L,%L,%L)',admin_id,gen_random_uuid(),a.id,'Wrong task'),'P0002');
 perform public.api_admin_delete_task_attachment(admin_id,t.id,a.id,'Fixture deletion');
 if not exists(select 1 from public.task_attachments where id=a.id and deleted_at is not null) or not exists(select 1 from public.project_library_items where source_attachment_id=a.id and deleted_at is not null) then raise exception 'Tombstones missing'; end if;
 select count(*) into n from public.audit_logs where entity_id=a.id and action='admin_delete';
 if n<>1 then raise exception 'Missing audit'; end if;
 perform public.api_admin_delete_task_attachment(admin_id,t.id,a.id,'Storage retry');
 if n<>(select count(*) from public.audit_logs where entity_id=a.id and action='admin_delete') then raise exception 'Duplicate retry audit'; end if;
end $$;
rollback;
