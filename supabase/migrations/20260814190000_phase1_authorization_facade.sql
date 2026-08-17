alter table public.role_permissions
  add column if not exists can_assign_task boolean not null default false,
  add column if not exists can_view_department_tasks boolean not null default false,
  add column if not exists can_evaluate_step1 boolean not null default false,
  add column if not exists can_evaluate_step2 boolean not null default false,
  add column if not exists can_manage_rubrics boolean not null default false;

alter table public.departments
  add column if not exists manager_id uuid
    references public.staff_users(id) on delete set null;

create index if not exists idx_departments_manager_id
  on public.departments(manager_id)
  where manager_id is not null;

create or replace function public.validate_department_manager()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $function$
begin
  if new.manager_id is not null and not exists (
    select 1
    from public.staff_users u
    where u.id=new.manager_id
      and u.department_id=new.id
      and u.active=true
  ) then
    raise exception 'Primary manager must be active and belong to the department.'
      using errcode='23514';
  end if;
  return new;
end
$function$;

drop trigger if exists validate_department_manager on public.departments;
create trigger validate_department_manager
before insert or update of manager_id on public.departments
for each row execute function public.validate_department_manager();

insert into public.role_permissions(role_id)
select id from public.roles
on conflict (role_id) do nothing;

update public.role_permissions rp
set can_comment = case
      when r.code='tong_bien_tap' then true
      when r.code='tbt_read_only' then false
      else rp.can_comment
    end,
    can_assign_task = r.code in (
      'admin','pho_tong_bien_tap','phu_trach_phong_tri_su',
      'phu_trach_phong_phong_vien','phu_trach_phong_bien_tap'
    ),
    can_view_department_tasks = r.code in (
      'admin','pho_tong_bien_tap','phu_trach_phong_tri_su',
      'phu_trach_phong_phong_vien','phu_trach_phong_bien_tap'
    ),
    can_evaluate_step1 = r.code in (
      'admin','pho_tong_bien_tap','phu_trach_phong_tri_su',
      'phu_trach_phong_phong_vien','phu_trach_phong_bien_tap'
    ),
    can_evaluate_step2 = r.code='tong_bien_tap',
    can_manage_rubrics = r.code='admin',
    updated_at=now()
from public.roles r
where r.id=rp.role_id;

with eligible as (
  select d.id as department_id,
         (array_agg(u.id order by u.id))[1] as manager_id
  from public.departments d
  join public.staff_users u on u.department_id=d.id and u.active=true
  join public.roles r on r.id=u.role_id
  where d.active=true
    and r.code in (
      'phu_trach_phong_tri_su',
      'phu_trach_phong_phong_vien',
      'phu_trach_phong_bien_tap'
    )
  group by d.id
  having count(*)=1
)
update public.departments d
set manager_id=e.manager_id
from eligible e
where d.id=e.department_id
  and d.manager_id is null;
