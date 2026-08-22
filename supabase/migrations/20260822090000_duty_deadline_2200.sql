begin;

drop index if exists public.tasks_duty_date_position_uidx;
create unique index tasks_duty_date_position_uidx
  on public.tasks(due_date,duty_position)
  where task_category='duty' and duty_position is not null and status <> 'cancelled';

create or replace function public.api_save_monthly_duty_roster(
  p_actor uuid,
  p_duty_month date,
  p_department_id uuid,
  p_reviewer_id uuid,
  p_days jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_month date := date_trunc('month',p_duty_month)::date;
  v_month_end date := (date_trunc('month',p_duty_month)+interval '1 month' - interval '1 day')::date;
  v_day jsonb;
  v_assignment jsonb;
  v_date date;
  v_position text;
  v_assignee uuid;
  v_task public.tasks;
  v_existing public.tasks;
  v_department_manager uuid;
  v_reviewer_role text;
  v_reviewer_job text;
  v_reviewer_department uuid;
  v_assignee_job text;
  v_assignee_department uuid;
  v_created int := 0;
  v_updated int := 0;
  v_cancelled int := 0;
  v_unchanged int := 0;
begin
  if not public.phase7_is_admin(p_actor) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_duty_month is null or p_duty_month<>v_month or p_department_id is null or p_reviewer_id is null
     or jsonb_typeof(p_days)<>'array' or jsonb_array_length(p_days)>31 then
    raise exception 'invalid duty roster' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('monthly-duty-roster:'||v_month::text));

  select d.manager_id into v_department_manager
  from public.departments d where d.id=p_department_id and d.active=true and d.code <> 'general';
  if not found then raise exception 'selected duty department is excluded' using errcode='22023'; end if;

  select r.code,jt.code,su.department_id
    into v_reviewer_role,v_reviewer_job,v_reviewer_department
  from public.staff_users su join public.roles r on r.id=su.role_id and r.active=true
  left join public.job_titles jt on jt.id=su.job_title_id
  where su.id=p_reviewer_id and su.active=true;
  if not found or not (
    lower(coalesce(v_reviewer_role,'')) in ('tong_bien_tap','pho_tong_bien_tap','truong_phong','pho_truong_phong','phu_trach_phong_bien_tap','phu_trach_phong_phong_vien','phu_trach_phong_tri_su')
    or p_reviewer_id=v_department_manager
    or lower(coalesce(v_reviewer_job,'')) in ('truong_phong','pho_truong_phong')
  ) or (
    lower(coalesce(v_reviewer_role,'')) not in ('tong_bien_tap','pho_tong_bien_tap')
    and v_reviewer_department is distinct from p_department_id
  ) then raise exception 'ineligible duty reviewer' using errcode='22023'; end if;

  create temporary table pg_temp.requested_duty(
    due_date date not null,
    duty_position text not null,
    assignee_id uuid not null,
    primary key(due_date,duty_position)
  ) on commit drop;

  for v_day in select value from jsonb_array_elements(p_days) loop
    if jsonb_typeof(v_day)<>'object' or jsonb_typeof(v_day->'assignments')<>'array'
       or jsonb_array_length(v_day->'assignments')<>4 then
      raise exception 'each duty day requires four positions' using errcode='22023';
    end if;
    begin v_date := (v_day->>'date')::date;
    exception when others then raise exception 'invalid duty date' using errcode='22023'; end;
    if v_date<v_month or v_date>v_month_end then raise exception 'duty date outside month' using errcode='22023'; end if;
    for v_assignment in select value from jsonb_array_elements(v_day->'assignments') loop
      v_position := v_assignment->>'position';
      begin v_assignee := (v_assignment->>'assigneeId')::uuid;
      exception when others then raise exception 'invalid duty assignee' using errcode='22023'; end;
      if v_position not in ('Biên tập và xuất bản','Biên tập bước 2','Biên tập bước 1','Phóng viên') then
        raise exception 'invalid duty position' using errcode='22023';
      end if;
      select jt.code,su.department_id into v_assignee_job,v_assignee_department
      from public.staff_users su left join public.job_titles jt on jt.id=su.job_title_id
      where su.id=v_assignee and su.active=true;
      if not found
         or (v_position='Biên tập và xuất bản' and lower(coalesce(v_assignee_job,'')) not in ('tong_bien_tap','pho_tong_bien_tap'))
         or (v_position<>'Biên tập và xuất bản' and (v_assignee_department is distinct from p_department_id or exists(select 1 from public.departments d where d.id=v_assignee_department and d.code='general') or lower(coalesce(v_assignee_job,'')) not in ('phong_vien','truong_phong'))) then
        if v_position<>'Biên tập và xuất bản' and exists(select 1 from public.departments d where d.id=v_assignee_department and d.code='general') then
          raise exception 'assignee department is excluded' using errcode='22023';
        end if;
        raise exception 'ineligible duty assignee' using errcode='22023';
      end if;
      begin
        insert into pg_temp.requested_duty values(v_date,v_position,v_assignee);
      exception when unique_violation then
        raise exception 'duplicate duty assignment' using errcode='22023';
      end;
    end loop;
    if (select count(*) from pg_temp.requested_duty where due_date=v_date)<>4 then
      raise exception 'each duty day requires exact four positions' using errcode='22023';
    end if;
  end loop;

  for v_existing in
    select * from public.tasks
    where task_category='duty' and duty_month=v_month and status<>'cancelled'
    order by id for update
  loop
    select * into v_task from public.tasks t
    where false;
    if exists(select 1 from pg_temp.requested_duty r where r.due_date=v_existing.due_date and r.duty_position=v_existing.duty_position) then
      select r.assignee_id into v_assignee from pg_temp.requested_duty r
      where r.due_date=v_existing.due_date and r.duty_position=v_existing.duty_position;
      if v_existing.department_id=p_department_id and v_existing.reviewer_id=p_reviewer_id and v_existing.assignee_id=v_assignee and (v_existing.status<>'new' or v_existing.due_time=time '22:00') then
        v_unchanged:=v_unchanged+1;
      else
        if v_existing.status<>'new' then raise exception 'active duty task cannot be reassigned' using errcode='40001'; end if;
        update public.tasks set department_id=p_department_id,reviewer_id=p_reviewer_id,
          assignee_id=v_assignee,owner_id=v_assignee,due_time=time '22:00',updated_at=now()
        where id=v_existing.id returning * into v_task;
        delete from public.task_assignees where task_id=v_existing.id and assignment_role='owner';
        insert into public.task_assignees(task_id,user_id,assignment_role,status)
        values(v_existing.id,v_assignee,'owner','todo');
        insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
        values(p_actor,'tasks','tasks',v_existing.id,'update_duty',to_jsonb(v_existing),to_jsonb(v_task));
        v_updated:=v_updated+1;
      end if;
      delete from pg_temp.requested_duty where due_date=v_existing.due_date and duty_position=v_existing.duty_position;
    else
      if v_existing.status<>'new' then raise exception 'active duty task cannot be cancelled' using errcode='40001'; end if;
      update public.tasks set status='cancelled',cancelled_at=now(),cancelled_by=p_actor,
        cancel_reason='Cập nhật bảng lịch trực tháng',updated_at=now()
      where id=v_existing.id returning * into v_task;
      insert into public.task_status_events(task_id,from_status,to_status,reason,actor_id)
      values(v_existing.id,v_existing.status,'cancelled','Cập nhật bảng lịch trực tháng',p_actor);
      insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
      values(p_actor,'tasks','tasks',v_existing.id,'cancel_duty',to_jsonb(v_existing),to_jsonb(v_task));
      v_cancelled:=v_cancelled+1;
    end if;
  end loop;

  for v_date,v_position,v_assignee in select due_date,duty_position,assignee_id from pg_temp.requested_duty order by due_date,duty_position loop
    insert into public.tasks(title,description,department_id,assignee_id,owner_id,reviewer_id,created_by,
      assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,task_type,start_date,
      evaluation_criteria,priority,task_category,duty_month,duty_position)
    values('Trực '||v_position||' ngày '||v_date,'Lịch trực tháng '||to_char(v_month,'YYYY-MM')||' · Vị trí: '||v_position,
      p_department_id,v_assignee,v_assignee,p_reviewer_id,p_actor,'individual',v_date,'22:00','new',0,'ad_hoc',false,
      'assigned',v_date,'Lịch trực được tính trong kỳ đánh giá tháng.','normal','duty',v_month,v_position)
    returning * into v_task;
    insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v_task.id,v_assignee,'owner','todo');
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
    values(p_actor,'tasks','tasks',v_task.id,'create_duty',to_jsonb(v_task));
    v_created:=v_created+1;
  end loop;
  return jsonb_build_object('created',v_created,'updated',v_updated,'cancelled',v_cancelled,'unchanged',v_unchanged);
end
$function$;

revoke all on function public.api_save_monthly_duty_roster(uuid,date,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.api_save_monthly_duty_roster(uuid,date,uuid,uuid,jsonb) to service_role;
alter function public.api_save_monthly_duty_roster(uuid,date,uuid,uuid,jsonb) owner to postgres;
notify pgrst,'reload schema';
commit;
