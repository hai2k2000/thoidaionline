begin;
do $guard$ begin if exists (select 1 from public.db_records r join public.db_record_types t on t.id=r.record_type_id where t.code='thu_vien_anh_video' and r.status <> 'deleted') then raise exception 'Cannot revert media group with non-deleted records'; end if; end $guard$;
update public.db_record_types set active=true,updated_at=now() where code in ('kho_anh_video','ngoai_ngu_anh_video_multimedia');
update public.db_record_types set active=false,updated_at=now() where code='thu_vien_anh_video';
update public.db_categories set active=false,updated_at=now() where code='anh_video';
update public.db_form_definitions set status='retired' where record_type_id=(select id from public.db_record_types where code='thu_vien_anh_video') and status='published';
commit;
