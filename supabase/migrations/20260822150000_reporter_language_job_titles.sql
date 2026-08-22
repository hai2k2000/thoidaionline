begin;

update public.job_titles
set name='Phóng viên tiếng Việt',updated_at=now()
where code='phong_vien';

insert into public.job_titles(code,name,display_order,active)
select v.code,v.name,v.display_order,true
from (values
  ('phong_vien_tieng_anh','Phóng viên tiếng Anh',51),
  ('phong_vien_tieng_trung','Phóng viên tiếng Trung',52),
  ('phong_vien_tieng_lao','Phóng viên tiếng Lào',53),
  ('phong_vien_tieng_khmer','Phóng viên tiếng Khmer',54),
  ('phong_vien_tieng_nga','Phóng viên tiếng Nga',55)
) v(code,name,display_order)
where not exists (select 1 from public.job_titles jt where jt.code=v.code);

update public.job_titles jt
set name=v.name,display_order=v.display_order,active=true,updated_at=now()
from (values
  ('phong_vien_tieng_anh','Phóng viên tiếng Anh',51),
  ('phong_vien_tieng_trung','Phóng viên tiếng Trung',52),
  ('phong_vien_tieng_lao','Phóng viên tiếng Lào',53),
  ('phong_vien_tieng_khmer','Phóng viên tiếng Khmer',54),
  ('phong_vien_tieng_nga','Phóng viên tiếng Nga',55)
) v(code,name,display_order)
where jt.code=v.code;

update public.staff_users su
set job_title_id=jt.id
from (values
  ('thuphuong','phong_vien_tieng_anh'),
  ('thithuy','phong_vien_tieng_trung'),
  ('ngocanh','phong_vien_tieng_trung'),
  ('minhduc','phong_vien_tieng_lao'),
  ('ducanh','phong_vien_tieng_khmer'),
  ('bachduong','phong_vien_tieng_nga')
) target(username,job_code)
join public.job_titles jt on jt.code=target.job_code
where lower(su.username)=target.username;

notify pgrst,'reload schema';
commit;
