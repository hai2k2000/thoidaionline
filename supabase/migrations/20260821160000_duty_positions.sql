begin;
alter table public.tasks add column if not exists duty_position text;
alter table public.tasks drop constraint if exists tasks_duty_position_check;
alter table public.tasks add constraint tasks_duty_position_check check (duty_position is null or duty_position in ('Biên tập và xuất bản','Biên tập bước 2','Biên tập bước 1','Phóng viên'));
create unique index if not exists tasks_duty_date_position_uidx on public.tasks(due_date,duty_position) where task_category='duty' and duty_position is not null;
drop function if exists public.api_create_duty_task(uuid,text,text,uuid,uuid,uuid,date,time,date);
create or replace function public.api_create_duty_task(
  p_actor uuid,p_title text,p_description text,p_department_id uuid,p_assignee_id uuid,p_reviewer_id uuid,p_due_date date,p_due_time time,p_duty_month date,p_duty_position text
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_id uuid; v_job_title text;
begin
  if not public.phase7_is_admin(p_actor) then raise exception 'forbidden' using errcode='42501'; end if;
  if nullif(btrim(p_title),'') is null or p_department_id is null or p_assignee_id is null or p_reviewer_id is null or p_due_date is null or p_duty_month is null or date_trunc('month',p_due_date)<>date_trunc('month',p_duty_month) or p_duty_position not in ('Biên tập và xuất bản','Biên tập bước 2','Biên tập bước 1','Phóng viên') then raise exception 'invalid duty task' using errcode='22023'; end if;
  select jt.code into v_job_title from public.staff_users su left join public.job_titles jt on jt.id=su.job_title_id where su.id=p_assignee_id and su.active=true;
  if (p_duty_position='Biên tập và xuất bản' and v_job_title not in ('tong_bien_tap','pho_tong_bien_tap')) or (p_duty_position<>'Biên tập và xuất bản' and v_job_title not in ('phong_vien','truong_phong')) then raise exception 'ineligible duty assignee' using errcode='22023'; end if;
  insert into public.tasks(title,description,department_id,assignee_id,owner_id,reviewer_id,created_by,assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,task_type,start_date,evaluation_criteria,priority,task_category,duty_month,duty_position)
  values(btrim(p_title),coalesce(nullif(btrim(p_description),''),'Lịch trực tháng '||to_char(p_duty_month,'MM/YYYY')),p_department_id,p_assignee_id,p_assignee_id,p_reviewer_id,p_actor,'individual',p_due_date,p_due_time,'new',0,'ad_hoc',false,'assigned',p_due_date,'Lịch trực được tính trong kỳ đánh giá tháng.', 'normal','duty',date_trunc('month',p_duty_month)::date,p_duty_position) returning id into v_id;
  insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v_id,p_assignee_id,'owner','todo');
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor,'tasks','tasks',v_id,'create_duty',jsonb_build_object('duty_month',p_duty_month,'due_date',p_due_date,'duty_position',p_duty_position,'assignee_id',p_assignee_id));
  return v_id;
end $function$;
revoke all on function public.api_create_duty_task(uuid,text,text,uuid,uuid,uuid,date,time,date,text) from public,anon,authenticated;
grant execute on function public.api_create_duty_task(uuid,text,text,uuid,uuid,uuid,date,time,date,text) to service_role;
commit;
