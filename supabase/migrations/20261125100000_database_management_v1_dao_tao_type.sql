begin;

insert into public.db_record_types(category_id,code,name,active,sort_order)
select id,'ho_so_dao_tao','Hồ sơ đào tạo',true,110
from public.db_categories where code='noi_dung_tieng_viet'
on conflict (code) do update set name=excluded.name,active=true,sort_order=excluded.sort_order,category_id=excluded.category_id,updated_at=now();

do $form$
declare
  type_id uuid;
  form_id uuid;
  source_form_id uuid;
begin
  select id into type_id from public.db_record_types where code='ho_so_dao_tao';
  select f.id into form_id from public.db_form_definitions f where f.record_type_id=type_id and f.status='published' order by f.version desc limit 1;
  if form_id is null then
    select f.id into source_form_id from public.db_form_definitions f join public.db_record_types t on t.id=f.record_type_id where t.code='ho_so_su_kien' and f.status='published' order by f.version desc limit 1;
    if source_form_id is null then raise exception 'published source form missing'; end if;
    insert into public.db_form_definitions(record_type_id,version,status,search_config,display_config)
    select type_id,(select coalesce(max(version),0)+1 from public.db_form_definitions where record_type_id=type_id),'published',jsonb_build_object('fields',jsonb_build_array('title','summary','don_vi_to_chuc','giang_vien','hinh_thuc','ngay_bat_dau','ngay_ket_thuc')),d.display_config
    from public.db_form_definitions d where d.id=source_form_id returning id into form_id;
    insert into public.db_form_fields(form_definition_id,field_key,label,data_type,required,searchable,options,validation,hidden,sort_order) values
      (form_id,'title','Tên khóa / lớp đào tạo','text',true,true,'[]'::jsonb,'{"maxLength":500}'::jsonb,false,10),
      (form_id,'summary','Nội dung đào tạo','long_text',false,true,'[]'::jsonb,'{}'::jsonb,false,20),
      (form_id,'don_vi_to_chuc','Đơn vị tổ chức','text',false,true,'[]'::jsonb,'{}'::jsonb,false,30),
      (form_id,'giang_vien','Giảng viên / người hướng dẫn','text',false,true,'[]'::jsonb,'{}'::jsonb,false,40),
      (form_id,'nguoi_tham_gia','Người tham gia','long_text',false,true,'[]'::jsonb,'{}'::jsonb,false,50),
      (form_id,'hinh_thuc','Hình thức','select',false,true,'[{"value":"Trực tiếp","label":"Trực tiếp"},{"value":"Trực tuyến","label":"Trực tuyến"},{"value":"Kết hợp","label":"Kết hợp"}]'::jsonb,'{}'::jsonb,false,60),
      (form_id,'ngay_bat_dau','Ngày bắt đầu','date',false,true,'[]'::jsonb,'{}'::jsonb,false,70),
      (form_id,'ngay_ket_thuc','Ngày kết thúc','date',false,true,'[]'::jsonb,'{}'::jsonb,false,80),
      (form_id,'dia_diem','Địa điểm','text',false,true,'[]'::jsonb,'{}'::jsonb,false,90),
      (form_id,'ket_qua','Kết quả / chứng nhận','long_text',false,true,'[]'::jsonb,'{}'::jsonb,false,100);
    insert into public.db_form_fields(form_definition_id,field_key,label,data_type,required,searchable,options,validation,hidden,sort_order)
    select form_id,field_key,label,data_type,false,searchable,options,validation,false,sort_order from public.db_form_fields where form_definition_id=source_form_id and field_key in ('keywords','responsible_person','publication_url','status');
  end if;
end
$form$;

do $assert$
declare
 type_id uuid; published_count integer; required_count integer;
begin
 select id into type_id from public.db_record_types where code='ho_so_dao_tao' and active and category_id=(select id from public.db_categories where code='noi_dung_tieng_viet');
 if (select count(*) from public.db_record_types where code='ho_so_dao_tao' and active and category_id=(select id from public.db_categories where code='noi_dung_tieng_viet')) <> 1 then raise exception 'dao tao active record type count assertion failed'; end if;
 select count(*) into published_count from public.db_form_definitions where record_type_id=type_id and status='published';
 if published_count <> 1 then raise exception 'dao tao published form count assertion failed'; end if;
 select count(*) filter (where required) into required_count from public.db_form_fields where form_definition_id=(select id from public.db_form_definitions where record_type_id=type_id and status='published');
 if required_count <> 1 or not exists (select 1 from public.db_form_fields where form_definition_id=(select id from public.db_form_definitions where record_type_id=type_id and status='published') and field_key='title' and required) then raise exception 'dao tao required field assertion failed'; end if;
 if exists (select 1 from public.db_form_fields where form_definition_id=(select id from public.db_form_definitions where record_type_id=type_id and status='published') and required and field_key <> 'title') then raise exception 'dao tao only title required assertion failed'; end if;
 if exists (select 1 from unnest(array['title','summary','don_vi_to_chuc','giang_vien','nguoi_tham_gia','hinh_thuc','ngay_bat_dau','ngay_ket_thuc','dia_diem','ket_qua','keywords','responsible_person','publication_url','status']) key where not exists (select 1 from public.db_form_fields where form_definition_id=(select id from public.db_form_definitions where record_type_id=type_id and status='published') and field_key=key and not hidden)) then raise exception 'dao tao field presence assertion failed'; end if;
 if exists (select 1 from public.db_form_fields where form_definition_id=(select id from public.db_form_definitions where record_type_id=type_id and status='published') and field_key in ('hinh_thuc','status') and (options is null or jsonb_array_length(options)=0)) then raise exception 'dao tao options assertion failed'; end if;
end
$assert$;

commit;
