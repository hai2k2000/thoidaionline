begin;

alter table public.roles add column if not exists active boolean not null default true;

create or replace function public.api_publish_tbt_evaluation(p_actor uuid,p_review uuid,p_scores jsonb)
returns text language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_status text; v_total numeric; v_rank text; v_allowed boolean;
begin
  select coalesce(rp.can_evaluate_step2,false) into v_allowed
  from public.staff_users u left join public.role_permissions rp on rp.role_id=u.role_id
  join public.roles r on r.id=u.role_id
  where u.id=p_actor and u.active and r.code='tong_bien_tap' and r.active;
  if not coalesce(v_allowed,false) then raise exception 'forbidden' using errcode='42501'; end if;
  select status into v_status from public.performance_reviews where id=p_review for update;
  if not found then raise exception 'review not found' using errcode='P0002'; end if;
  if v_status not in ('awaiting_manager','awaiting_tbt') then raise exception 'invalid review state' using errcode='22023'; end if;
  v_total:=public.phase7_store_scores(p_actor,p_review,'tbt',p_scores);
  v_rank:=case when v_total>=90 then 'Hoàn thành xuất sắc nhiệm vụ' when v_total>=80 then 'Hoàn thành tốt nhiệm vụ' when v_total>=65 then 'Hoàn thành nhiệm vụ' when v_total>=50 then 'Hoàn thành một phần nhiệm vụ' else 'Không hoàn thành nhiệm vụ' end;
  if v_status='awaiting_manager' then
    update public.performance_reviews set final_score=v_total,rank=v_rank,published_by=p_actor,updated_at=now() where id=p_review;
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor,'performance','performance_reviews',p_review,'submit_tbt_early',jsonb_build_object('status','awaiting_manager','score',v_total,'rank',v_rank));
    return 'awaiting_manager';
  end if;
  update public.performance_reviews set final_score=v_total,rank=v_rank,status='published',published_at=now(),published_by=p_actor,approved_at=now(),updated_at=now() where id=p_review;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor,'performance','performance_reviews',p_review,'publish',jsonb_build_object('status','published','score',v_total,'rank',v_rank));
  return 'published';
end $function$;

create or replace function public.api_submit_manager_evaluation(p_actor uuid,p_review uuid,p_scores jsonb)
returns text language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_employee uuid; v_status text; v_manager uuid; v_allowed boolean; v_total numeric; v_has_tbt boolean;
begin
  select r.employee_id,r.status,d.manager_id,coalesce(p.can_evaluate_step1,false) into v_employee,v_status,v_manager,v_allowed
  from public.performance_reviews r join public.staff_users u on u.id=r.employee_id join public.departments d on d.id=u.department_id
  left join public.staff_users a on a.id=p_actor left join public.role_permissions p on p.role_id=a.role_id where r.id=p_review for update of r;
  if not found then raise exception 'review not found' using errcode='P0002'; end if;
  if p_actor=v_employee or p_actor is distinct from v_manager or not v_allowed then raise exception 'forbidden' using errcode='42501'; end if;
  if v_status<>'awaiting_manager' then raise exception 'invalid review state' using errcode='22023'; end if;
  v_total:=public.phase7_store_scores(p_actor,p_review,'manager',p_scores);
  select exists(select 1 from public.performance_review_scores where review_id=p_review and stage='tbt') into v_has_tbt;
  if v_has_tbt then
    update public.performance_reviews set reviewer_id=p_actor,reviewer_score=v_total,status='published',reviewed_at=now(),published_at=now(),approved_at=now(),updated_at=now() where id=p_review;
    insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor,'performance','performance_reviews',p_review,'submit_manager_and_publish',jsonb_build_object('status','published','score',v_total));
    return 'published';
  end if;
  update public.performance_reviews set reviewer_id=p_actor,reviewer_score=v_total,status='awaiting_tbt',reviewed_at=now(),updated_at=now() where id=p_review;
  insert into public.audit_logs(actor_id,module,entity_type,entity_id,action,new_data) values(p_actor,'performance','performance_reviews',p_review,'submit_manager',jsonb_build_object('status','awaiting_tbt','score',v_total));
  return 'awaiting_tbt';
end $function$;

create or replace function public.api_create_role(p_actor uuid,p_code text,p_name text,p_level integer)
returns public.roles language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_role public.roles;
begin
  if not exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id join public.role_permissions rp on rp.role_id=r.id where u.id=p_actor and u.active and r.code='admin' and r.active and rp.can_manage_permissions) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_code !~ '^[a-z][a-z0-9_]{2,49}$' or length(btrim(p_name)) not between 2 and 120 or p_level not between 1 and 99 then raise exception 'invalid role' using errcode='22023'; end if;
  insert into public.roles(code,name,level,active) values(lower(btrim(p_code)),btrim(p_name),p_level,true) returning * into v_role;
  insert into public.role_permissions(role_id,can_manage_users,can_manage_permissions,can_create_task,can_edit_all_tasks,can_comment) values(v_role.id,false,false,false,false,false);
  return v_role;
end $function$;

create or replace function public.api_set_role_active(p_actor uuid,p_role uuid,p_active boolean)
returns public.roles language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_role public.roles;
begin
  if not exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id join public.role_permissions rp on rp.role_id=r.id where u.id=p_actor and u.active and r.code='admin' and r.active and rp.can_manage_permissions) then raise exception 'forbidden' using errcode='42501'; end if;
  select * into v_role from public.roles where id=p_role for update;
  if not found then raise exception 'role not found' using errcode='P0002'; end if;
  if v_role.code='admin' and not p_active then raise exception 'admin role cannot be locked' using errcode='42501'; end if;
  update public.roles set active=p_active where id=p_role returning * into v_role;
  return v_role;
end $function$;

revoke all on function public.api_create_role(uuid,text,text,integer),public.api_set_role_active(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.api_create_role(uuid,text,text,integer),public.api_set_role_active(uuid,uuid,boolean) to service_role;
commit;
