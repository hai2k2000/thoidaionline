begin;

create or replace function public.require_task_score_before_done()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
begin
  if new.status='done'
     and old.status is distinct from 'done'
     and new.task_type='assigned'
     and coalesce(new.task_category,'regular')<>'duty'
     and not exists (
       select 1 from public.task_completion_scores s where s.task_id=new.id
     ) then
    raise exception 'Công việc phải được chấm điểm trước khi hoàn thành.' using errcode='22023';
  end if;
  return new;
end
$function$;

drop trigger if exists require_task_score_before_done on public.tasks;
create trigger require_task_score_before_done
before update of status on public.tasks
for each row execute function public.require_task_score_before_done();

commit;
