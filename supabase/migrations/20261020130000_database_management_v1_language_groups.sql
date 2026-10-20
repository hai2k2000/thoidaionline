begin;

alter table public.db_records
  add column if not exists language_code text
  check (language_code is null or language_code in ('vi', 'en', 'zh', 'lo', 'km'));

create index if not exists db_records_language_idx on public.db_records(language_code, updated_at desc);

insert into public.db_categories (code, name, parent_id, department_id, sort_order)
values ('phong_noi_dung', 'Phòng Nội dung', null, null, 30)
on conflict (code) do update
set name = excluded.name, updated_at = now();

update public.db_categories
set name = 'Tổ Tiếng Việt',
    parent_id = (select id from public.db_categories where code = 'phong_noi_dung'),
    sort_order = 10,
    updated_at = now()
where code = 'noi_dung_tieng_viet';

with language_categories(code, name, sort_order) as (
  values
    ('noi_dung_tieng_anh', 'Tổ Tiếng Anh', 20),
    ('noi_dung_tieng_trung', 'Tổ Tiếng Trung', 30),
    ('noi_dung_tieng_lao', 'Tổ Tiếng Lào', 40),
    ('noi_dung_tieng_khmer', 'Tổ Tiếng Campuchia (Khmer)', 50)
)
insert into public.db_categories (code, name, parent_id, department_id, sort_order)
select item.code, item.name, parent.id, null, item.sort_order
from language_categories item
cross join (select id from public.db_categories where code = 'phong_noi_dung') parent
on conflict (code) do update
set name = excluded.name, parent_id = excluded.parent_id, updated_at = now();

notify pgrst, 'reload schema';

commit;
