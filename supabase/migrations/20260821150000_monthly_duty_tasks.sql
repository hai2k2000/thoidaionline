begin;
alter table public.tasks add column if not exists task_category text not null default 'regular';
alter table public.tasks drop constraint if exists tasks_task_category_check;
alter table public.tasks add constraint tasks_task_category_check check (task_category in ('regular','duty'));
alter table public.tasks add column if not exists duty_month date;
create index if not exists tasks_category_due_idx on public.tasks(task_category,duty_month,due_date);
create or replace function public.api_create_duty_task(
  p_actor uuid,p_title text,p_description text,p_department_id uuid,p_assignee_id uuid,p_reviewer_id uuid,p_due_date date,p_due_time time,p_duty_month date
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_id uuid;
begin
  if not public.phase7_is_admin(p_actor) then raise exception 'forbidden' using errcode='42501'; end if;
  if nullif(btrim(p_title),'') is null or p_department_id is null or p_assignee_id is null or p_reviewer_id is null or p_due_date is null or p_duty_month is null or date_trunc('month',p_due_date)<>date_trunc('month',p_duty_month) then raise exception 'invalid duty task' using errcode='22023'; end if;
  insert into public.tasks(title,description,department_id,assignee_id,owner_id,reviewer_id,created_by,assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,task_type,start_date,evaluation_criteria,priority,task_category,duty_month)
  values(btrim(p_title),coalesce(nullif(btrim(p_description),''),'Lịch trực tháng '||to_char(p_duty_month,'MM/YYYY')),p_department_id,p_assignee_id,p_assignee_id,p_reviewer_id,p_actor,'individual',p_due_date,p_due_time,'new',0,'ad_hoc',false,'assigned',p_due_date,'Lịch trực được tính trong kỳ đánh giá tháng.', 'normal','duty',date_trunc('month',p_duty_month)::date) returning id into v_id;
  insert into public.task_assignees(task_id,user_id,assignment_role,status) values(v_id,p_assignee_id,'owner','todo');
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor,'tasks','tasks',v_id,'create_duty',jsonb_build_object('duty_month',p_duty_month,'due_date',p_due_date,'assignee_id',p_assignee_id));
  return v_id;
end $function$;
revoke all on function public.api_create_duty_task(uuid,text,text,uuid,uuid,uuid,date,time,date) from public,anon,authenticated;
grant execute on function public.api_create_duty_task(uuid,text,text,uuid,uuid,uuid,date,time,date) to service_role;
commit;
