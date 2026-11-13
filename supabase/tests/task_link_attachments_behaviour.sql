-- Run only in a disposable restored database. Real triggers remain enabled.
begin;
create function pg_temp.expect_state(p_sql text,p_state text) returns void language plpgsql as $$
begin
 begin execute p_sql; exception when others then if sqlstate=p_state then return; end if; raise; end;
 raise exception 'Expected SQLSTATE %',p_state;
end $$;
do $$
declare dept uuid; admin_id uuid; member_id uuid; fixture_manager uuid; p public.projects; t public.tasks; a public.task_links; eval_role uuid; suffix text:=replace(gen_random_uuid()::text,'-',''); n bigint;
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
 a:=public.api_add_task_link(member_id,t.id,' https://example.com/resource ',null);
 if a.url<>'https://example.com/resource' or a.title<>'example.com' then raise exception 'Normalization failed'; end if;
 set constraints all immediate;
 if not exists(select 1 from public.project_library_items where source_link_id=a.id and deleted_at is null) then raise exception 'Automatic library item missing'; end if;
 perform pg_temp.expect_state(format('select public.api_add_task_link(%L,%L,%L,null)',fixture_manager,t.id,'https://example.com'),'42501');
 perform public.api_add_task_link(member_id,t.id,'https://foo_bar/resource','Underscore host');
 perform public.api_add_task_link(member_id,t.id,'https://ví-dụ.vn/resource','Unicode host');
 perform public.api_add_task_link(member_id,t.id,'https://example.com/path@name','Path at sign');
 perform pg_temp.expect_state(format('select public.api_add_task_link(%L,%L,%L,null)',member_id,t.id,'https:///path'),'22023');
 perform pg_temp.expect_state(format('select public.api_add_task_link(%L,%L,%L,null)',member_id,t.id,'https://?query'),'22023');
 perform pg_temp.expect_state(format('select public.api_add_task_link(%L,%L,%L,null)',member_id,t.id,'https://#fragment'),'22023');
 perform pg_temp.expect_state(format('select public.api_add_task_link(%L,%L,%L,null)',member_id,t.id,'https://example.com\path'),'22023');
 perform pg_temp.expect_state(format('select public.api_add_task_link(%L,%L,%L,null)',member_id,t.id,'http://example.com'),'22023');
 perform pg_temp.expect_state(format('select public.api_add_task_link(%L,%L,%L,null)',member_id,t.id,'https://user:pass@example.com'),'22023');
 perform pg_temp.expect_state(format('select public.api_add_task_link(%L,%L,%L,null)',member_id,t.id,'https://example.com/a b'),'22023');
 perform pg_temp.expect_state(format('select public.api_delete_task_link(%L,%L,%L)',fixture_manager,t.id,a.id),'42501');
 -- Personnel detail deliberately excludes project tasks. Reuse this fixture as a
 -- personal task briefly to verify the shared JSON reader, then restore linkage.
 update public.tasks set project_id=null where id=t.id;
 -- Only a step-1 department manager (or step-2 TBT) may read personnel detail; give the
 -- fixture manager a temporary step-1 role for this read, then restore it.
 insert into public.roles(code,name,level) values('zz_eval_'||suffix,'Eval fixture',1) returning id into eval_role;
 insert into public.role_permissions(role_id,can_evaluate_step1) values(eval_role,true);
 update public.staff_users set role_id=eval_role where id=fixture_manager;
 if not exists(select 1 from jsonb_array_elements(public.api_get_personnel_evaluation_detail(fixture_manager,member_id,current_date,current_date+2)->'tasks') detail where detail->>'id'=t.id::text and detail->'links' @> jsonb_build_array(jsonb_build_object('id',a.id))) then raise exception 'Detail link missing'; end if;
 update public.staff_users set role_id=(select id from public.roles where code='nhan_vien') where id=fixture_manager;
 update public.tasks set project_id=p.id where id=t.id;
 perform public.api_delete_task_link(member_id,t.id,a.id);
 if (select count(*) from public.audit_logs where entity_id=a.id and module='task' and entity_type='task_links' and action='delete')<>1 then raise exception 'Delete audit missing'; end if;
 if not exists(select 1 from public.task_links where id=a.id and deleted_at is not null) or exists(select 1 from public.project_library_items where source_link_id=a.id and deleted_at is null) then raise exception 'Tombstones missing'; end if;
 perform pg_temp.expect_state(format('select public.api_delete_task_link(%L,%L,%L)',member_id,t.id,a.id),'P0002');
 a:=public.api_add_task_link(member_id,t.id,'https://example.com/admin','Admin deletion');
 perform public.api_delete_task_link(admin_id,t.id,a.id);
 a:=public.api_add_task_link(member_id,t.id,'https://example.com/retained',repeat('x',201));
 if length(a.title)<>200 then raise exception 'Title not bounded'; end if;
 a:=public.api_add_task_link(member_id,t.id,'https://example.com/title-boundary',repeat('a',199)||' b');
 if length(a.title)<>200 or length(btrim(a.title))<>199 then raise exception 'Truncated title boundary failed'; end if;
 update public.tasks set status='cancelled',cancelled_at=now() where id=t.id;
 perform pg_temp.expect_state(format('select public.api_add_task_link(%L,%L,%L,null)',admin_id,t.id,'https://example.com'),'42501');
 perform public.api_delete_cancelled_project_tasks(admin_id,p.id,array[t.id]);
 if exists(select 1 from public.task_links where task_id=t.id) or exists(select 1 from public.project_library_items where source_task_id=t.id) then raise exception 'Hard delete children remain'; end if;
end $$;
rollback;