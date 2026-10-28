begin;
drop function if exists public.api_request_late_exception(uuid,date,text);
drop function if exists public.api_review_late_exception(uuid,uuid,text,text);
drop function if exists public.api_list_reviewable_late_exceptions(uuid,date,date);
create or replace function public.api_upsert_attendance_admin_note(p_actor_id uuid,p_user_id uuid,p_work_date date,p_note text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_note public.attendance_admin_notes; v_previous text;
begin
  if not exists (select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active=true and r.active=true and r.code='admin') then raise exception 'Admin attendance note forbidden.' using errcode='42501'; end if;
  if p_user_id is null or p_work_date is null or char_length(btrim(coalesce(p_note,''))) not between 3 and 2000 then raise exception 'Invalid attendance admin note.' using errcode='22023'; end if;
  if not exists (select 1 from public.staff_users where id=p_user_id) then raise exception 'Attendance employee not found.' using errcode='22023'; end if;
  select note into v_previous from public.attendance_admin_notes where user_id=p_user_id and work_date=p_work_date for update;
  insert into public.attendance_admin_notes (user_id,work_date,note,created_by,updated_by) values (p_user_id,p_work_date,btrim(p_note),p_actor_id,p_actor_id) on conflict (user_id,work_date) do update set note=excluded.note,updated_by=excluded.updated_by,updated_at=now() returning * into v_note;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values (p_actor_id,'attendance','attendance_admin_notes',v_note.id,case when v_previous is null then 'create_admin_note' else 'update_admin_note' end,jsonb_build_object('user_id',p_user_id,'work_date',p_work_date,'previous_note',v_previous),jsonb_build_object('user_id',p_user_id,'work_date',p_work_date,'new_note',v_note.note));
  return to_jsonb(v_note);
end; $$;
revoke all on function public.api_upsert_attendance_admin_note(uuid,uuid,date,text) from public, anon, authenticated;
grant execute on function public.api_upsert_attendance_admin_note(uuid,uuid,date,text) to service_role;
commit;
