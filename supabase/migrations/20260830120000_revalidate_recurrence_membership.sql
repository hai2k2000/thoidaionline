begin;

-- Recurrence rules retain a participant snapshot, but future occurrences must
-- fail closed when the assignee/reviewer is no longer eligible. Other
-- participants are filtered to currently active staff at materialization time.
create or replace function public.api_run_task_recurrence(p_run_on date default null)
returns integer
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_run_on date := coalesce(p_run_on,timezone('Asia/Ho_Chi_Minh',now())::date);
  v_rule public.task_recurrence_rules;
  v_scheduled date;
  v_task public.tasks;
  v_manager uuid;
  v_user uuid;
  v_created integer := 0;
begin
  for v_rule in
    select * from public.task_recurrence_rules
    where active=true and next_scheduled_for<=v_run_on
    order by next_scheduled_for,id for update skip locked
  loop
    select manager_id into v_manager
    from public.departments where id=v_rule.department_id and active=true;

    if v_manager is null
       or not exists (select 1 from public.staff_users a where a.id=v_rule.assignee_id and a.active=true
         and (a.department_id=v_rule.department_id or exists (
           select 1 from public.departments ld
           join public.roles rr on rr.id=a.role_id
           left join public.job_titles jt on jt.id=a.job_title_id
           where ld.id=v_rule.department_id and ld.code='leadership' and ld.active=true
             and (lower(rr.code)='pho_tong_bien_tap' or lower(jt.code)='truong_phong')
         )))
       or not exists (select 1 from public.staff_users u
         left join public.job_titles jt on jt.id=u.job_title_id
         left join public.roles rr on rr.id=u.role_id
         where u.id=v_rule.reviewer_id and u.active=true
           and ((u.department_id=v_rule.department_id and
                 (u.id=v_manager or (jt.active=true and lower(jt.code) in ('truong_phong','pho_truong_phong'))))
                or lower(rr.code) in ('tong_bien_tap','pho_tong_bien_tap'))) then
      update public.task_recurrence_rules set active=false,updated_at=now() where id=v_rule.id;
      insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
      values(v_rule.created_by,'task','task_recurrence_rules',v_rule.id,
        'deactivate_invalid_participants',jsonb_build_object('reason','department, assignee or reviewer is no longer active/eligible'));
      continue;
    end if;

    v_scheduled := v_rule.next_scheduled_for;
    while v_scheduled<=v_run_on and (v_rule.ends_on is null or v_scheduled<=v_rule.ends_on) loop
      if not exists(select 1 from public.task_recurrence_occurrences where rule_id=v_rule.id and scheduled_for=v_scheduled) then
        insert into public.tasks(
          title,description,department_id,assignee_id,owner_id,reviewer_id,created_by,
          assignment_mode,due_date,due_time,status,progress_percent,plan_period,self_claimable,
          task_type,start_date,evaluation_criteria,recurrence_rule_id,priority
        ) values(
          v_rule.title,v_rule.description,v_rule.department_id,v_rule.assignee_id,
          v_rule.assignee_id,v_rule.reviewer_id,v_rule.created_by,
          case when cardinality(v_rule.collaborator_ids)>0 then 'multi_user' else 'individual' end,
          v_scheduled,v_rule.due_time,'new',0,'ad_hoc',false,'assigned',v_scheduled,
          v_rule.evaluation_criteria,v_rule.id,v_rule.priority
        ) returning * into v_task;
        insert into public.task_assignees(task_id,user_id,assignment_role,status)
        values(v_task.id,v_rule.assignee_id,'owner','todo');
        foreach v_user in array coalesce(v_rule.collaborator_ids,'{}'::uuid[]) loop
          if v_user<>v_rule.assignee_id and exists(select 1 from public.staff_users where id=v_user and active=true) then
            insert into public.task_assignees(task_id,user_id,assignment_role,status)
            values(v_task.id,v_user,'assignee','todo') on conflict(task_id,user_id) do nothing;
          end if;
        end loop;
        if v_manager<>v_rule.assignee_id and not (v_manager=any(v_rule.collaborator_ids)) then
          insert into public.task_assignees(task_id,user_id,assignment_role,status)
          values(v_task.id,v_manager,'watcher','todo') on conflict(task_id,user_id) do nothing;
        end if;
        foreach v_user in array coalesce(v_rule.watcher_ids,'{}'::uuid[]) loop
          if v_user<>v_rule.assignee_id and not (v_user=any(v_rule.collaborator_ids))
             and exists(select 1 from public.staff_users where id=v_user and active=true) then
            insert into public.task_assignees(task_id,user_id,assignment_role,status)
            values(v_task.id,v_user,'watcher','todo') on conflict(task_id,user_id) do nothing;
          end if;
        end loop;
        insert into public.task_recurrence_occurrences(rule_id,scheduled_for,task_id)
        values(v_rule.id,v_scheduled,v_task.id);
        insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
        values(v_rule.created_by,'task','tasks',v_task.id,'create',jsonb_build_object('recurrence_rule_id',v_rule.id,'scheduled_for',v_scheduled,'due_time',v_rule.due_time));
        v_created := v_created+1;
      end if;
      v_scheduled := public.task_recurrence_next_date(v_rule.frequency,v_rule.weekday,v_rule.day_of_month,v_rule.month_end,v_scheduled);
    end loop;
    update public.task_recurrence_rules set
      next_scheduled_for=v_scheduled,
      active=case when ends_on is not null and v_scheduled>ends_on then false else active end,
      updated_at=now()
    where id=v_rule.id;
  end loop;
  return v_created;
end
$function$;

commit;
