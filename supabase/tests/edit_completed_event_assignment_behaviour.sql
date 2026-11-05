begin;
do $test$
declare
  suffix text := replace(gen_random_uuid()::text,'-','');
  dept_a uuid; dept_b uuid; tbt_id uuid; head_id uuid; creator_id uuid; member_id uuid; outsider_id uuid;
  event_row public.work_schedules; changed public.work_schedules; denied boolean;
begin
  insert into public.departments(code,name) values('zz_event_a_'||suffix,'Fixture Event A') returning id into dept_a;
  insert into public.departments(code,name) values('zz_event_b_'||suffix,'Fixture Event B') returning id into dept_b;
  insert into public.staff_users(full_name,username,password,role_id,department_id) values
    ('Fixture Reporter','zz_event_creator_'||suffix,'test-only',(select id from public.roles where code='phong_vien'),dept_a) returning id into creator_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id) values
    ('Fixture TBT','zz_event_tbt_'||suffix,'test-only',(select id from public.roles where code='tong_bien_tap'),dept_b) returning id into tbt_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id,job_title_id) values
    ('Fixture Head','zz_event_head_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept_a,(select id from public.job_titles where lower(code)='truong_phong' and active=true limit 1)) returning id into head_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id) values
    ('Fixture Member','zz_event_member_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept_a) returning id into member_id;
  insert into public.staff_users(full_name,username,password,role_id,department_id) values
    ('Fixture Outsider','zz_event_out_'||suffix,'test-only',(select id from public.roles where code='nhan_vien'),dept_b) returning id into outsider_id;
  if (select manager_id from public.departments where id=dept_a) is distinct from head_id then raise exception 'Fixture manager sync failed'; end if;
  event_row := public.api_create_event_assignment(head_id,current_date,current_date,'09:00','10:00','fixture','Fixture Event',null,null,array[member_id]);
  event_row := public.api_set_event_assignment_status(head_id,event_row.id,event_row.workflow_revision,'complete');
  changed := public.api_update_event_assignment(tbt_id,event_row.id,event_row.workflow_revision,current_date,current_date,'09:00','11:00','fixture','Fixture Completed Edited','Fixture Place','Fixture Notes',array[head_id,outsider_id]);
  if changed.event_status is distinct from 'COMPLETED' or changed.participant_ids is distinct from array[head_id,outsider_id]
    or changed.workflow_revision <> event_row.workflow_revision+1 or changed.created_by <> head_id
    or changed.title <> 'Fixture Completed Edited' or changed.end_time <> '11:00'::time
    or changed.approval_status is distinct from event_row.approval_status then raise exception 'completed edit did not preserve status or members'; end if;
  if (select count(*) from public.work_schedule_event_assignments where event_id=changed.id) <> 2
    or (select count(*) from public.work_schedule_event_assignments where event_id=changed.id and staff_id in (head_id,outsider_id) and assigned_by=tbt_id) <> 2
    or exists(select 1 from public.work_schedule_event_assignments where event_id=changed.id and staff_id=member_id) then raise exception 'assignment rows are incoherent'; end if;
  if not exists(select 1 from public.audit_logs where entity_id=changed.id and action='complete_event')
    or not exists(select 1 from public.audit_logs where entity_id=changed.id and action='update_event' and actor_id=tbt_id and old_data->>'event_status'='COMPLETED' and new_data->>'event_status'='COMPLETED')
    or not exists(select 1 from public.audit_logs where entity_id=changed.id and action='unassign_reporter' and old_data->>'staff_id'=member_id::text)
    or not exists(select 1 from public.audit_logs where entity_id=changed.id and action='assign_reporter' and actor_id=tbt_id and new_data->>'staff_id'=outsider_id::text) then raise exception 'audit history missing'; end if;
  denied := false;
  begin perform public.api_update_event_assignment(creator_id,changed.id,changed.workflow_revision,current_date,current_date,'09:00','11:00','fixture','Forbidden',null,null,array[member_id]);
  exception when insufficient_privilege then
    if sqlerrm <> 'forbidden' then raise; end if;
    denied := true;
  end;
  if not denied then raise exception 'phong_vien was editable'; end if;
  denied := false;
  begin perform public.api_update_event_assignment(tbt_id,changed.id,changed.workflow_revision-1,current_date,current_date,'09:00','11:00','fixture','Stale',null,null,array[member_id]); exception when serialization_failure then denied := true; end;
  if not denied then raise exception 'stale revision was allowed'; end if;
  changed := public.api_update_event_assignment(head_id,changed.id,changed.workflow_revision,current_date,current_date,'09:00','11:00','fixture','Fixture Head Edit',null,null,array[head_id,member_id]);
  if changed.event_status <> 'COMPLETED' then raise exception 'Head edit reset status'; end if;
  update public.work_schedules set event_status='CANCELLED' where id=changed.id;
  denied := false;
  begin perform public.api_update_event_assignment(tbt_id,changed.id,changed.workflow_revision,current_date,current_date,'09:00','11:00','fixture','Cancelled',null,null,array[member_id]);
  exception when insufficient_privilege then
    if sqlerrm <> 'event is terminal' then raise; end if;
    denied := true;
  end;
  if not denied then raise exception 'cancelled event was editable'; end if;
end $test$;
rollback;
