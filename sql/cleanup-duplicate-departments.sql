-- Dọn phòng ban trùng theo tên (không phân biệt hoa thường/khoảng trắng)
-- Mục tiêu: gom mọi bản ghi trùng về 1 department chuẩn, cập nhật khóa ngoại rồi xóa bản dư.

begin;

create temp table tmp_department_map (
  old_id uuid primary key,
  keep_id uuid not null
) on commit drop;

with normalized as (
  select
    id,
    code,
    lower(regexp_replace(trim(name), '\s+', ' ', 'g')) as norm_name
  from public.departments
), ranked as (
  select
    id,
    norm_name,
    row_number() over (
      partition by norm_name
      order by
        case
          when code = 'admin' then 1
          when code = 'leadership' then 2
          when code = 'editorial' then 3
          when code = 'reporter' then 4
          when code = 'general' then 5
          when code = 'finance' then 6
          when code = 'it' then 7
          else 99
        end,
        id
    ) as rn
  from normalized
), canon as (
  select norm_name, id as keep_id
  from ranked
  where rn = 1
)
insert into tmp_department_map (old_id, keep_id)
select r.id as old_id, c.keep_id
from ranked r
join canon c using (norm_name)
where r.id <> c.keep_id;

-- cập nhật staff_users
update public.staff_users u
set department_id = m.keep_id
from tmp_department_map m
where u.department_id = m.old_id;

-- cập nhật tasks
update public.tasks t
set department_id = m.keep_id
from tmp_department_map m
where t.department_id = m.old_id;

-- xóa departments dư
delete from public.departments d
using tmp_department_map m
where d.id = m.old_id;

commit;
