begin;
create function pg_temp.expect_state(p_sql text,p_state text) returns void language plpgsql as $$
begin
 begin execute p_sql; exception when others then if sqlstate=p_state then return; end if; raise; end;
 raise exception 'Expected SQLSTATE %',p_state;
end $$;
do $$ declare p public.projects; host_id uuid; admin_id uuid; lead_id uuid; deputy_id uuid; member_id uuid; outsider uuid; ctv_id uuid; t public.tasks; suffix text:=replace(gen_random_uuid()::text,'-',''); begin
 insert into public.departments(code,name) values('zz_reopen_'||suffix,'Reopen host') returning id into host_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Reopen admin','zz_admin_'||suffix,'test-only',(select id from public.roles where code='admin'),host_id) returning id into admin_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Reopen lead','zz_lead_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),host_id) returning id into lead_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Reopen deputy','zz_deputy_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),host_id) returning id into deputy_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Reopen member','zz_member_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),host_id) returning id into member_id;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Reopen outsider','zz_out_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),host_id) returning id into outsider;
 insert into public.staff_users(full_name,username,password,role_id,department_id) values('Reopen ctv','zz_ctv_'||suffix,'test-only',(select id from public.roles where code='cong_tac_vien'),host_id) returning id into ctv_id;
 perform public.api_set_user_permission_override(admin_id,lead_id,'project.create','allow','all');
 p:=public.api_create_project(lead_id,'ZZ-REOPEN-'||suffix,'Reopen fixture',null,host_id,array[lead_id]);
 perform public.api_set_project_member(admin_id,p.id,deputy_id,'deputy'); perform public.api_set_project_member(admin_id,p.id,member_id,'member');
 perform public.api_close_project(lead_id,p.id); p:=public.api_reopen_project(lead_id,p.id); if p.status<>'active' or p.closed_at is not null then raise exception 'lead reopen failed'; end if;
 if exists(select 1 from public.project_members where project_id=p.id and user_id=admin_id) then raise exception 'Admin must be nonmember'; end if;
 perform public.api_close_project(lead_id,p.id); p:=public.api_reopen_project(admin_id,p.id); if p.status<>'active' then raise exception 'admin reopen failed'; end if;
 if not exists(select 1 from public.audit_logs where actor_id=lead_id and module='project' and entity_type='projects' and entity_id=p.id and action='reopen' and new_data->>'status'='active' and new_data->'closed_at'='null'::jsonb) then raise exception 'lead reopen audit missing'; end if;
 if not exists(select 1 from public.audit_logs where actor_id=admin_id and module='project' and entity_type='projects' and entity_id=p.id and action='reopen') then raise exception 'admin reopen audit missing'; end if;
 perform public.api_set_project_member(admin_id,p.id,ctv_id,'member');
 perform public.api_close_project(lead_id,p.id);
 perform pg_temp.expect_state(format('select public.api_assign_project_task(%L,%L,''Closed assignment'',''Requirements'',%L,%L,current_date,''17:00'')',lead_id,p.id,member_id,lead_id),'42501');
 foreach outsider in array array[deputy_id,member_id,outsider,ctv_id] loop
  perform pg_temp.expect_state(format('select public.api_reopen_project(%L,%L)',outsider,p.id),'42501');
 end loop;
 perform pg_temp.expect_state(format('select public.api_reopen_project(%L,%L)',lead_id,gen_random_uuid()),'P0002');
 p:=public.api_reopen_project(lead_id,p.id);
 begin perform public.api_reopen_project(admin_id,p.id); raise exception 'active reopen should fail'; exception when sqlstate '55000' then null; end;
 t:=public.api_assign_project_task(lead_id,p.id,'Reopen assignment','Requirements',member_id,lead_id,current_date,'17:00'); if t.project_id<>p.id then raise exception 'assignment after reopen failed'; end if;
end $$;
rollback;
