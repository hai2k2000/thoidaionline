begin;

create or replace function public.api_review_leave_request(p_actor uuid,p_request_id uuid,p_decision text,p_note text)
returns public.leave_requests language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_row public.leave_requests; v_old public.leave_requests; v_role text; v_job text; v_department uuid; v_days integer;
begin
  if p_decision not in ('approved','rejected') or length(coalesce(p_note,''))>1000 then raise exception 'invalid review' using errcode='22023'; end if;
  select r.code,j.code,u.department_id into v_role,v_job,v_department from public.staff_users u
  join public.roles r on r.id=u.role_id left join public.job_titles j on j.id=u.job_title_id where u.id=p_actor and u.active=true;
  select * into v_old from public.leave_requests where id=p_request_id and status='pending' for update;
  if not found then raise exception 'leave request unavailable' using errcode='40001'; end if;
  v_days := (v_old.end_date - v_old.start_date) + 1;
  if p_actor=v_old.requester_id
    or (v_days >= 3 and lower(coalesce(v_role,'')) <> 'tong_bien_tap')
    or (v_days < 3 and not (
      lower(coalesce(v_role,'')) in ('admin','tong_bien_tap','pho_tong_bien_tap')
      or (
        lower(coalesce(v_role,'')) in ('phu_trach_phong_tri_su','phu_trach_phong_phong_vien','phu_trach_phong_bien_tap')
        and v_department is not distinct from v_old.department_id
      )
      or (lower(coalesce(v_job,'')) in ('truong_phong','pho_truong_phong') and v_department is not distinct from v_old.department_id)
    )) then raise exception 'forbidden' using errcode='42501'; end if;
  update public.leave_requests set status=p_decision,reviewed_by=p_actor,reviewed_at=now(),review_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now()
  where id=p_request_id returning * into v_row;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor,'admin','leave_requests',v_row.id,'review_leave_request',to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;

revoke all on function public.api_review_leave_request(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.api_review_leave_request(uuid,uuid,text,text) to service_role;
alter function public.api_review_leave_request(uuid,uuid,text,text) owner to postgres;

notify pgrst,'reload schema';
commit;
