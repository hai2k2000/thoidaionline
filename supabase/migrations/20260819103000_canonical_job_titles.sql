-- Canonical job-title catalog. Authorization roles remain unchanged.
do $$
declare
  v_truong uuid;
  v_nhan_vien uuid;
begin
  insert into public.job_titles(code,name,display_order,active) values
    ('tong_bien_tap','Tổng biên tập',10,true),
    ('pho_tong_bien_tap','Phó tổng biên tập',20,true),
    ('truong_phong','Trưởng phòng',30,true),
    ('pho_truong_phong','Phó trưởng phòng',40,true),
    ('ke_toan_truong','Kế toán trưởng',50,true),
    ('phong_vien','Phóng viên',60,true),
    ('nhan_vien','Nhân viên',70,true)
  on conflict (lower(code)) do nothing;

  update public.job_titles set
    name=v.name,display_order=v.ord,active=true
  from (values
    ('tong_bien_tap','Tổng biên tập',10),
    ('pho_tong_bien_tap','Phó tổng biên tập',20),
    ('truong_phong','Trưởng phòng',30),
    ('pho_truong_phong','Phó trưởng phòng',40),
    ('ke_toan_truong','Kế toán trưởng',50),
    ('phong_vien','Phóng viên',60),
    ('nhan_vien','Nhân viên',70)
  ) as v(code,name,ord)
  where lower(public.job_titles.code)=v.code;

  select id into strict v_truong from public.job_titles where lower(code)='truong_phong';
  select id into strict v_nhan_vien from public.job_titles where lower(code)='nhan_vien';

  update public.staff_users su set job_title_id=v_truong
  from public.job_titles old
  where su.job_title_id=old.id and lower(old.code) in
    ('phu_trach_phong_bien_tap','phu_trach_phong_phong_vien','phu_trach_phong_tong_hop');

  update public.staff_users su set job_title_id=v_nhan_vien
  from public.job_titles old
  where su.job_title_id=old.id and lower(old.code) in ('bien_tap_vien','tong-hop','admin');

  update public.job_titles set active=false
  where lower(code) not in
    ('tong_bien_tap','pho_tong_bien_tap','truong_phong','pho_truong_phong','ke_toan_truong','phong_vien','nhan_vien');

  if (select count(*) from public.job_titles where active) <> 7 then
    raise exception 'canonical job title active count mismatch';
  end if;
  if exists(select 1 from public.staff_users su left join public.job_titles jt on jt.id=su.job_title_id where su.job_title_id is not null and jt.id is null) then
    raise exception 'orphan staff job title reference';
  end if;
end $$;
