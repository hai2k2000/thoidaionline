begin;
update public.db_form_definitions set status='retired' where record_type_id=(select id from public.db_record_types where code='ho_so_dao_tao') and status='published';
update public.db_record_types set active=false,updated_at=now() where code='ho_so_dao_tao';
commit;
