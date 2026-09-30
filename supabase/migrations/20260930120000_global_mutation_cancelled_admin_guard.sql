begin;

do $rename$
begin
  if to_regprocedure('public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text)') is not null
     and to_regprocedure('public.api_admin_edit_task_unchecked(uuid,uuid,text,text,date,date,time,text,text,text,text)') is null then
    alter function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text)
      rename to api_admin_edit_task_unchecked;
  end if;
end
$rename$;

create or replace function public.api_admin_edit_task(
  p_actor_id uuid,p_task_id uuid,p_title text,p_description text,
  p_start_date date,p_due_date date,p_due_time time,p_priority text,
  p_status text,p_evaluation_criteria text,p_reason text
) returns public.tasks
language plpgsql security definer set search_path=public,pg_temp
as $function$
begin
  perform public.api_assert_task_creator_mutation(p_actor_id,p_task_id,'edit');
  return public.api_admin_edit_task_unchecked(
    p_actor_id,p_task_id,p_title,p_description,p_start_date,p_due_date,
    p_due_time,p_priority,p_status,p_evaluation_criteria,p_reason
  );
end
$function$;

revoke all on function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text) from public,anon,authenticated;
grant execute on function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text) to service_role;
revoke all on function public.api_admin_edit_task_unchecked(uuid,uuid,text,text,date,date,time,text,text,text,text) from public,anon,authenticated,service_role;
alter function public.api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text) owner to postgres;
notify pgrst,'reload schema';
commit;
