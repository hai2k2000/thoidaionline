begin;

alter table public.attendance_logs add column if not exists late_exception_status text;
alter table public.attendance_logs add column if not exists late_exception_reason text;
alter table public.attendance_logs add column if not exists late_exception_reviewed_by uuid references public.staff_users(id) on delete set null;
alter table public.attendance_logs add column if not exists late_exception_reviewed_at timestamptz;
alter table public.attendance_logs add column if not exists late_exception_review_note text;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.attendance_logs'::regclass and conname='attendance_logs_late_exception_status_check') then
    alter table public.attendance_logs add constraint attendance_logs_late_exception_status_check check (late_exception_status is null or late_exception_status in ('pending','approved','rejected'));
  end if;
end $$;
update public.attendance_logs set late_exception_status='approved' where late_exception='sudden_work' and late_exception_status is null;

create or replace function public.api_request_late_exception(p_actor uuid,p_work_date date,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_row public.attendance_logs;
begin
  if char_length(btrim(coalesce(p_reason,''))) not between 3 and 2000 then raise exception 'invalid reason' using errcode='22023'; end if;
  select * into v_row from public.attendance_logs where user_id=p_actor and work_date=p_work_date for update;
  if not found then raise exception 'attendance row not found' using errcode='P0002'; end if;
  if v_row.check_in is null or v_row.check_in::time <= time '08:15:00' or v_row.status in ('leave','absent') then raise exception 'not eligible' using errcode='22023'; end if;
  if v_row.late_exception_status in ('pending','approved') then raise exception 'exception already requested' using errcode='40001'; end if;
  if v_row.late_exception_status='rejected' and v_row.late_exception_reviewed_at is null then raise exception 'exception unavailable' using errcode='40001'; end if;
  update public.attendance_logs set late_exception='sudden_work',late_exception_status='pending',late_exception_reason=btrim(p_reason),late_exception_reviewed_by=null,late_exception_reviewed_at=null,late_exception_review_note=null where id=v_row.id returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.api_review_late_exception(p_actor uuid,p_log_id uuid,p_decision text,p_note text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_row public.attendance_logs; v_old public.attendance_logs; v_perm record; v_allowed boolean:=false;
begin
  if p_decision not in ('approved','rejected') or (p_decision='rejected' and char_length(btrim(coalesce(p_note,'')))<3) or char_length(coalesce(p_note,''))>2000 then raise exception 'invalid review' using errcode='22023'; end if;
  select * into v_old from public.attendance_logs where id=p_log_id and late_exception_status='pending' for update;
  if not found then raise exception 'late exception unavailable' using errcode='40001'; end if;
  if v_old.user_id=p_actor then raise exception 'self review forbidden' using errcode='42501'; end if;
  select * into v_perm from public.api_list_effective_permissions(p_actor) where permission_code='attendance.manage' and cardinality(effective_scopes)>0;
  v_allowed := found;
  if not v_allowed then
    select * into v_perm from public.api_list_effective_permissions(p_actor) where permission_code='attendance.view_all' and cardinality(effective_scopes)>0;
    v_allowed := found and ('all'=any(v_perm.effective_scopes) or ('department'=any(v_perm.effective_scopes) and exists(select 1 from public.staff_users target join public.staff_users actor on actor.id=p_actor where target.id=v_old.user_id and target.department_id = actor.department_id)));
  end if;
  if not v_allowed then raise exception 'forbidden' using errcode='42501'; end if;
  update public.attendance_logs set late_exception_status=p_decision,late_exception_reviewed_by=p_actor,late_exception_reviewed_at=now(),late_exception_review_note=nullif(btrim(coalesce(p_note,'')),'') where id=p_log_id returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.api_list_reviewable_late_exceptions(p_actor uuid,p_from date,p_to date)
returns table(id uuid) language sql security definer set search_path=public,pg_temp as $$
  select l.id from public.attendance_logs l where l.late_exception_status='pending' and l.work_date between p_from and p_to and l.user_id<>p_actor and (exists(select 1 from public.api_list_effective_permissions(p_actor) p where p.permission_code='attendance.manage' and cardinality(p.effective_scopes)>0) or exists(select 1 from public.api_list_effective_permissions(p_actor) p join public.staff_users a on a.id=p_actor join public.staff_users target on target.id=l.user_id where p.permission_code='attendance.view_all' and cardinality(p.effective_scopes)>0 and ('all'=any(p.effective_scopes) or ('department'=any(p.effective_scopes) and target.department_id = a.department_id)))) limit 500
$$;

create or replace function public.api_upsert_attendance_admin_note(p_actor_id uuid,p_user_id uuid,p_work_date date,p_note text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_note public.attendance_admin_notes; v_previous text;
begin
  if not exists (select 1 from public.api_list_effective_permissions(p_actor_id) where permission_code='attendance.manage' and cardinality(effective_scopes)>0) then raise exception 'Attendance admin note forbidden.' using errcode='42501'; end if;
  if p_user_id is null or p_work_date is null or char_length(btrim(coalesce(p_note,''))) not between 3 and 2000 then raise exception 'Invalid attendance admin note.' using errcode='22023'; end if;
  if not exists (select 1 from public.staff_users where id=p_user_id) then raise exception 'Attendance employee not found.' using errcode='22023'; end if;
  select note into v_previous from public.attendance_admin_notes where user_id=p_user_id and work_date=p_work_date for update;
  insert into public.attendance_admin_notes (user_id,work_date,note,created_by,updated_by) values (p_user_id,p_work_date,btrim(p_note),p_actor_id,p_actor_id) on conflict (user_id,work_date) do update set note=excluded.note,updated_by=excluded.updated_by,updated_at=now() returning * into v_note;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data) values (p_actor_id,'attendance','attendance_admin_notes',v_note.id,case when v_previous is null then 'create_admin_note' else 'update_admin_note' end,jsonb_build_object('user_id',p_user_id,'work_date',p_work_date,'previous_note',v_previous),jsonb_build_object('user_id',p_user_id,'work_date',p_work_date,'new_note',v_note.note));
  return to_jsonb(v_note);
end $$;

do $$ declare f text; begin foreach f in array array['api_request_late_exception(uuid,date,text)','api_review_late_exception(uuid,uuid,text,text)','api_list_reviewable_late_exceptions(uuid,date,date)']::text[] loop execute format('revoke all on function public.%s from public, anon, authenticated',f); execute format('grant execute on function public.%s to service_role',f); execute format('alter function public.%s owner to postgres',f); end loop; end $$;
revoke all on function public.api_upsert_attendance_admin_note(uuid,uuid,date,text) from public, anon, authenticated;
grant execute on function public.api_upsert_attendance_admin_note(uuid,uuid,date,text) to service_role;
alter function public.api_upsert_attendance_admin_note(uuid,uuid,date,text) owner to postgres;
notify pgrst,'reload schema';
commit;
