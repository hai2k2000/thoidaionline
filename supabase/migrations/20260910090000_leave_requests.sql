begin;

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.staff_users(id),
  department_id uuid references public.departments(id),
  start_date date not null,
  end_date date not null,
  start_period text not null default 'full' check (start_period in ('full','morning','afternoon')),
  end_period text not null default 'full' check (end_period in ('full','morning','afternoon')),
  leave_type text not null default 'annual' check (leave_type in ('annual','sick','unpaid','personal','business')),
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references public.staff_users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (start_date <> end_date or start_period = 'full' or end_period = start_period)
);
create index if not exists leave_requests_date_idx on public.leave_requests(start_date,end_date,status);
create index if not exists leave_requests_requester_idx on public.leave_requests(requester_id,status,created_at desc);
alter table public.leave_requests enable row level security;
revoke all on public.leave_requests from public, anon, authenticated;
grant select, insert, update on public.leave_requests to service_role;

create or replace function public.api_create_leave_request(
  p_actor uuid,p_start_date date,p_end_date date,p_start_period text,p_end_period text,p_leave_type text,p_reason text
) returns public.leave_requests language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_department uuid; v_row public.leave_requests;
begin
  select department_id into v_department from public.staff_users where id=p_actor and active=true;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date or p_end_date-p_start_date>60
     or p_start_period not in ('full','morning','afternoon') or p_end_period not in ('full','morning','afternoon')
     or p_leave_type not in ('annual','sick','unpaid','personal','business')
     or length(trim(coalesce(p_reason,''))) not between 3 and 1000
     or (p_start_date=p_end_date and p_start_period<>'full' and p_end_period<>p_start_period) then
    raise exception 'invalid leave request' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('leave-request:'||p_actor::text));
  if exists(select 1 from public.leave_requests where requester_id=p_actor and status in ('pending','approved')
    and daterange(start_date,end_date,'[]') && daterange(p_start_date,p_end_date,'[]')) then
    raise exception 'overlapping leave request' using errcode='23505';
  end if;
  insert into public.leave_requests(requester_id,department_id,start_date,end_date,start_period,end_period,leave_type,reason)
  values(p_actor,v_department,p_start_date,p_end_date,p_start_period,p_end_period,p_leave_type,trim(p_reason)) returning * into v_row;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data)
  values(p_actor,'admin','leave_requests',v_row.id,'create_leave_request',to_jsonb(v_row));
  return v_row;
end $function$;

create or replace function public.api_review_leave_request(p_actor uuid,p_request_id uuid,p_decision text,p_note text)
returns public.leave_requests language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_row public.leave_requests; v_old public.leave_requests; v_role text; v_job text; v_department uuid;
begin
  if p_decision not in ('approved','rejected') or length(coalesce(p_note,''))>1000 then raise exception 'invalid review' using errcode='22023'; end if;
  select r.code,j.code,u.department_id into v_role,v_job,v_department from public.staff_users u
  join public.roles r on r.id=u.role_id left join public.job_titles j on j.id=u.job_title_id where u.id=p_actor and u.active=true;
  select * into v_old from public.leave_requests where id=p_request_id and status='pending' for update;
  if not found then raise exception 'leave request unavailable' using errcode='40001'; end if;
  if p_actor=v_old.requester_id or not (
    lower(coalesce(v_role,'')) in ('admin','tong_bien_tap','pho_tong_bien_tap','phu_trach_phong_tri_su','phu_trach_phong_phong_vien','phu_trach_phong_bien_tap')
    or (lower(coalesce(v_job,''))='truong_phong' and v_department is not distinct from v_old.department_id)
  ) then raise exception 'forbidden' using errcode='42501'; end if;
  update public.leave_requests set status=p_decision,reviewed_by=p_actor,reviewed_at=now(),review_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now()
  where id=p_request_id returning * into v_row;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor,'admin','leave_requests',v_row.id,'review_leave_request',to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;

create or replace function public.api_cancel_leave_request(p_actor uuid,p_request_id uuid)
returns public.leave_requests language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_row public.leave_requests; v_old public.leave_requests;
begin
  select * into v_old from public.leave_requests where id=p_request_id and requester_id=p_actor and status='pending' for update;
  if not found then raise exception 'leave request unavailable' using errcode='40001'; end if;
  update public.leave_requests set status='cancelled',updated_at=now() where id=p_request_id returning * into v_row;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,old_data,new_data)
  values(p_actor,'admin','leave_requests',v_row.id,'cancel_leave_request',to_jsonb(v_old),to_jsonb(v_row));
  return v_row;
end $function$;

revoke all on function public.api_create_leave_request(uuid,date,date,text,text,text,text) from public,anon,authenticated;
revoke all on function public.api_review_leave_request(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.api_cancel_leave_request(uuid,uuid) from public,anon,authenticated;
grant execute on function public.api_create_leave_request(uuid,date,date,text,text,text,text) to service_role;
grant execute on function public.api_review_leave_request(uuid,uuid,text,text) to service_role;
grant execute on function public.api_cancel_leave_request(uuid,uuid) to service_role;
alter function public.api_create_leave_request(uuid,date,date,text,text,text,text) owner to postgres;
alter function public.api_review_leave_request(uuid,uuid,text,text) owner to postgres;
alter function public.api_cancel_leave_request(uuid,uuid) owner to postgres;

notify pgrst,'reload schema';
commit;
