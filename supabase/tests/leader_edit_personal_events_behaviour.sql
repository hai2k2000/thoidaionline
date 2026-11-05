begin;
do $test$
declare
  suffix text := replace(gen_random_uuid()::text,'-','');
  dept_a uuid; dept_b uuid; creator_id uuid; tbt_id uuid; head_id uuid; other_head uuid;
  member_id uuid; outsider_id uuid; ctv_id uuid; admin_id uuid; inactive_id uuid;
  plan public.work_schedules; changed public.work_schedules;
  denied boolean;
begin
  insert into public.departments(code,name) values('zz_leader_a_'||suffix,'Fixture Department A') returning id into dept_a;
  insert into public.departments(code,name) values('zz_leader_b_'||suffix,'Fixture Department B') returning id into dept_b;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Fixture Creator','zz_creator_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept_a) returning id into creator_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Fixture Editor','zz_editor_'||suffix,'test-only',(select id from public.roles where code='tong_bien_tap'),dept_b) returning id into tbt_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id,job_title_id)
  values('Fixture Head A','zz_head_a_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept_a,(select id from public.job_titles where lower(code)='truong_phong' and active=true limit 1)) returning id into head_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id,job_title_id)
  values('Fixture Head B','zz_head_b_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept_b,(select id from public.job_titles where lower(code)='truong_phong' and active=true limit 1)) returning id into other_head;
  -- departments.manager_id is synced from the truong_phong job title by trigger.
  if (select manager_id from public.departments where id=dept_a) is distinct from head_id then raise exception 'Fixture manager sync failed'; end if;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Fixture Member','zz_member_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept_a) returning id into member_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Fixture Outsider','zz_out_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept_b) returning id into outsider_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Fixture Collaborator','zz_ctv_'||suffix,'test-only',(select id from public.roles where code='cong_tac_vien'),dept_a) returning id into ctv_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id)
  values('Fixture Admin','zz_admin_'||suffix,'test-only',(select id from public.roles where code='admin'),dept_a) returning id into admin_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id,active)
  values('Fixture Inactive','zz_inactive_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept_a,false) returning id into inactive_id;

  plan := public.api_create_personal_work_schedule(creator_id,null,current_date,current_date,'event','09:00','10:00','Fixture Original',null,null,array[creator_id],null);
  update public.work_schedules set approval_status='APPROVED', reviewed_by=tbt_id, reviewed_at=now(), review_note='Fixture approval',participant_ids=array[creator_id,member_id] where id=plan.id returning * into plan;
  changed := public.api_create_personal_work_schedule(tbt_id,plan.id,plan.work_date,plan.end_date,'event','09:00','11:00','Fixture Edited','Fixture Place','Fixture Notes',array[creator_id,member_id,outsider_id],plan.workflow_revision);
  if changed.approval_status <> 'APPROVED' or changed.created_by <> creator_id
    or changed.participant_ids <> array[creator_id,member_id,outsider_id]
    or changed.reviewed_by is distinct from plan.reviewed_by or changed.reviewed_at is distinct from plan.reviewed_at
    or changed.workflow_revision <> plan.workflow_revision+1 then raise exception 'Leader edit did not preserve approval and members'; end if;
  if not exists(select 1 from public.audit_logs where entity_id=plan.id and actor_id=tbt_id
    and action='edit_personal_plan' and old_data->>'title'='Fixture Original' and new_data->>'title'='Fixture Edited') then raise exception 'Leader audit missing'; end if;
  plan := changed;

  denied := false;
  begin
    perform public.api_create_personal_work_schedule(other_head,plan.id,plan.work_date,plan.end_date,'event','09:00','11:00','Forbidden',null,null,array[outsider_id],plan.workflow_revision);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Other department head was allowed'; end if;
  denied := false;
  begin
    perform public.api_create_personal_work_schedule(creator_id,plan.id,plan.work_date,plan.end_date,'event','09:00','11:00','Forbidden',null,null,array[creator_id],plan.workflow_revision);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Approved creator was allowed'; end if;

  denied := false;
  begin
    perform public.api_create_personal_work_schedule(head_id,plan.id,plan.work_date,plan.end_date,'event','09:00','11:00','Forbidden',null,null,array[creator_id,outsider_id],plan.workflow_revision);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Cross-department participant was allowed'; end if;
  foreach outsider_id in array array[ctv_id,admin_id,inactive_id] loop
    denied := false;
    begin
      perform public.api_create_personal_work_schedule(tbt_id,plan.id,plan.work_date,plan.end_date,'event','09:00','11:00','Forbidden',null,null,array[creator_id,outsider_id],plan.workflow_revision);
    exception when insufficient_privilege then denied := true; end;
    if not denied then raise exception 'Ineligible participant was allowed'; end if;
  end loop;
  changed := public.api_create_personal_work_schedule(head_id,plan.id,plan.work_date,plan.end_date,'event','09:00','11:00','Fixture Head Edit',null,null,array[creator_id,member_id],plan.workflow_revision);
  if changed.approval_status <> 'APPROVED' then raise exception 'Head edit reset approval'; end if;
  denied := false;
  begin
    perform public.api_create_personal_work_schedule(tbt_id,plan.id,plan.work_date,plan.end_date,'event','09:00','11:00','Stale',null,null,array[creator_id],plan.workflow_revision);
  exception when serialization_failure then denied := true; end;
  if not denied then raise exception 'Stale revision was allowed'; end if;
  update public.work_schedules set approval_status='PENDING_APPROVAL' where id=plan.id returning * into plan;
  changed := public.api_create_personal_work_schedule(tbt_id,plan.id,plan.work_date,plan.end_date,'event','09:00','11:00','Fixture Pending',null,null,array[creator_id,member_id],plan.workflow_revision);
  if changed.approval_status <> 'PENDING_APPROVAL' then raise exception 'Pending leader edit changed status'; end if;
  changed := public.api_create_personal_work_schedule(creator_id,changed.id,changed.work_date,changed.end_date,'event','09:00','11:00','Fixture Creator Edit',null,null,changed.participant_ids,changed.workflow_revision);
  if changed.participant_ids <> array[creator_id,member_id] then raise exception 'Creator edit lost members'; end if;
  update public.work_schedules set approval_status='CANCELLED' where id=plan.id returning * into plan;
  denied := false;
  begin
    perform public.api_create_personal_work_schedule(tbt_id,plan.id,plan.work_date,plan.end_date,'event','09:00','11:00','Forbidden',null,null,array[creator_id],plan.workflow_revision);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Cancelled plan was editable'; end if;
end $test$;
rollback;
