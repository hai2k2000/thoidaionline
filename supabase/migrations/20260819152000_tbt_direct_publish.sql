begin;

create or replace function public.api_publish_tbt_evaluation(
  p_actor uuid,
  p_review uuid,
  p_scores jsonb
)
returns text
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_status text;
  v_total numeric;
  v_rank text;
  v_allowed boolean;
begin
  select coalesce(rp.can_evaluate_step2,false)
  into v_allowed
  from public.staff_users u
  left join public.role_permissions rp on rp.role_id=u.role_id
  join public.roles r on r.id=u.role_id
  where u.id=p_actor
    and u.active
    and r.code='tong_bien_tap'
    and r.active;

  if not coalesce(v_allowed,false) then
    raise exception 'forbidden' using errcode='42501';
  end if;

  select status
  into v_status
  from public.performance_reviews
  where id=p_review
  for update;

  if not found then
    raise exception 'review not found' using errcode='P0002';
  end if;
  if v_status not in ('awaiting_manager','awaiting_tbt') then
    raise exception 'invalid review state' using errcode='22023';
  end if;

  v_total:=public.phase7_store_scores(p_actor,p_review,'tbt',p_scores);
  v_rank:=case
    when v_total>=90 then 'Hoàn thành xuất sắc nhiệm vụ'
    when v_total>=80 then 'Hoàn thành tốt nhiệm vụ'
    when v_total>=65 then 'Hoàn thành nhiệm vụ'
    when v_total>=50 then 'Hoàn thành một phần nhiệm vụ'
    else 'Không hoàn thành nhiệm vụ'
  end;

  update public.performance_reviews
  set final_score=v_total,
      rank=v_rank,
      status='published',
      published_at=now(),
      published_by=p_actor,
      approved_at=now(),
      updated_at=now()
  where id=p_review;

  insert into public.audit_logs(
    actor_id,module,entity_type,entity_id,action,new_data
  ) values (
    p_actor,
    'performance',
    'performance_reviews',
    p_review,
    case when v_status='awaiting_manager' then 'publish_tbt_direct' else 'publish' end,
    jsonb_build_object('previous_status',v_status,'status','published','score',v_total,'rank',v_rank)
  );

  return 'published';
end
$function$;

revoke all on function public.api_publish_tbt_evaluation(uuid,uuid,jsonb)
from public,anon,authenticated;
grant execute on function public.api_publish_tbt_evaluation(uuid,uuid,jsonb)
to service_role;

commit;
