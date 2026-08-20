begin;

-- Chức vụ nhân sự là nguồn cấu hình duy nhất. manager_id được giữ như một
-- trường tương thích cho các luồng cũ và luôn được đồng bộ từ "Trưởng phòng".
create or replace function public.sync_department_managers_from_job_titles()
returns void
language sql
security definer
set search_path=public,pg_temp
as $function$
  update public.departments d
  set manager_id=chosen.manager_id
  from (
    select department.id as department_id,
      (
        select u.id
        from public.staff_users u
        join public.job_titles jt on jt.id=u.job_title_id
        where u.active=true
          and u.department_id=department.id
          and jt.active=true
          and lower(jt.code)='truong_phong'
        order by u.list_order nulls last,lower(u.full_name),u.id
        limit 1
      ) as manager_id
    from public.departments department
  ) chosen
  where d.id=chosen.department_id
    and d.manager_id is distinct from chosen.manager_id
$function$;

create or replace function public.sync_department_managers_after_staff_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
begin
  perform public.sync_department_managers_from_job_titles();
  return null;
end
$function$;

drop trigger if exists staff_users_sync_department_manager on public.staff_users;
create trigger staff_users_sync_department_manager
after insert or delete or update of active,department_id,job_title_id,list_order
on public.staff_users
for each statement execute function public.sync_department_managers_after_staff_change();

drop trigger if exists job_titles_sync_department_manager on public.job_titles;
create trigger job_titles_sync_department_manager
after update of code,active on public.job_titles
for each statement execute function public.sync_department_managers_after_staff_change();

select public.sync_department_managers_from_job_titles();

-- Sửa các hồ sơ tháng đang mở nhưng chưa có điểm, vốn được tạo theo cấu hình
-- thủ công cũ. Hồ sơ đã được chấm được giữ nguyên để bảo toàn lịch sử.
update public.performance_reviews review
set reviewer_id=null,status='awaiting_tbt',updated_at=now()
from public.performance_cycles cycle,
  public.staff_users employee,
  public.job_titles title
where review.cycle_id=cycle.id
  and review.employee_id=employee.id
  and employee.job_title_id=title.id
  and cycle.status='open'
  and employee.active=true
  and title.active=true
  and lower(title.code)='truong_phong'
  and review.status in ('self_draft','awaiting_manager')
  and review.self_score is null
  and review.reviewer_score is null
  and review.final_score is null
  and not exists(
    select 1 from public.performance_review_scores score
    where score.review_id=review.id
  );

update public.performance_reviews review
set reviewer_id=department.manager_id,status='awaiting_manager',updated_at=now()
from public.performance_cycles cycle,
  public.staff_users employee
join public.departments department on department.id=employee.department_id
left join public.job_titles title on title.id=employee.job_title_id
where review.cycle_id=cycle.id
  and review.employee_id=employee.id
  and cycle.status='open'
  and employee.active=true
  and coalesce(lower(title.code),'')<>'truong_phong'
  and review.workflow_type='manager'
  and review.status='awaiting_tbt'
  and review.self_score is null
  and review.reviewer_score is null
  and review.final_score is null
  and not exists(
    select 1 from public.performance_review_scores score
    where score.review_id=review.id
  );

revoke all on function public.sync_department_managers_from_job_titles(),
  public.sync_department_managers_after_staff_change()
from public,anon,authenticated;
grant execute on function public.sync_department_managers_from_job_titles()
to service_role;

commit;
