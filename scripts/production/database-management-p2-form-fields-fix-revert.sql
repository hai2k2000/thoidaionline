-- Revert only the form versions created by 20261102160000.
-- Không revert nếu db_records đã tham chiếu form mới; khi đó cần xử lý dữ liệu phụ thuộc trước.
begin;

create temporary table p2_form_fix_revert_targets (
  record_type_id uuid primary key,
  new_form_id uuid not null,
  old_form_id uuid not null
) on commit drop;

insert into p2_form_fix_revert_targets(record_type_id, new_form_id, old_form_id)
select
  type.id,
  new_form.id,
  old_form.id
from public.db_record_types type
join public.db_categories category on category.id = type.category_id
join lateral (
  select form.id, form.version
  from public.db_form_definitions form
  where form.record_type_id = type.id
    and form.status = 'published'
  order by form.version desc
  limit 1
) new_form on true
join lateral (
  select form.id
  from public.db_form_definitions form
  where form.record_type_id = type.id
    and form.version < new_form.version
  order by form.version desc
  limit 1
) old_form on true
where type.active
  and category.code in ('cong_tac_dang', 'cong_doan', 'lien_hiep', 'phap_ly_dieu_hanh');

do $guard$
begin
  if exists (
    select 1
    from public.db_records record
    join p2_form_fix_revert_targets target on target.new_form_id = record.form_definition_id
  ) then
    raise exception 'Revert blocked: db_records use the new form version.';
  end if;
end
$guard$;

update public.db_form_definitions new_form
set status = 'retired'
from p2_form_fix_revert_targets target
where new_form.id = target.new_form_id;

update public.db_form_definitions previous_form
set status = 'published'
from p2_form_fix_revert_targets target
where previous_form.id = target.old_form_id;

delete from public.db_form_definitions form
using p2_form_fix_revert_targets target
where form.id = target.new_form_id;

commit;
