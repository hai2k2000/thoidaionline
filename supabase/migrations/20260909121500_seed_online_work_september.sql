begin;

do $block$
declare
  v_actor uuid;
  v_people jsonb;
  v_count integer;
begin
  select id into v_actor from public.staff_users where username = 'admin' and active = true limit 1;
  if v_actor is null then raise exception 'active admin not found' using errcode = 'P0002'; end if;

  with people as (
    select username, id from public.staff_users
    where active = true and username in ('thuphuong','thithuy','ngocanh','minhduc','ducanh','bachduong')
  )
  select jsonb_object_agg(username, id), count(*) into v_people, v_count from people;
  if v_count <> 6 then raise exception 'foreign-language roster incomplete' using errcode = 'P0002'; end if;

  perform public.api_save_monthly_online_work_schedule(v_actor, '2026-09-01', jsonb_build_array(
    jsonb_build_object('date','2026-09-03','staffIds',jsonb_build_array(v_people->'bachduong')),
    jsonb_build_object('date','2026-09-04','staffIds',jsonb_build_array(v_people->'thithuy',v_people->'ngocanh')),
    jsonb_build_object('date','2026-09-05','staffIds',jsonb_build_array(v_people->'thuphuong',v_people->'thithuy',v_people->'ngocanh',v_people->'minhduc',v_people->'ducanh',v_people->'bachduong')),
    jsonb_build_object('date','2026-09-06','staffIds',jsonb_build_array(v_people->'thuphuong',v_people->'thithuy',v_people->'ngocanh',v_people->'minhduc',v_people->'ducanh',v_people->'bachduong')),
    jsonb_build_object('date','2026-09-07','staffIds',jsonb_build_array(v_people->'thithuy',v_people->'ngocanh')),
    jsonb_build_object('date','2026-09-08','staffIds',jsonb_build_array(v_people->'minhduc')),
    jsonb_build_object('date','2026-09-09','staffIds',jsonb_build_array(v_people->'ducanh')),
    jsonb_build_object('date','2026-09-10','staffIds',jsonb_build_array(v_people->'thuphuong')),
    jsonb_build_object('date','2026-09-11','staffIds',jsonb_build_array(v_people->'bachduong')),
    jsonb_build_object('date','2026-09-12','staffIds',jsonb_build_array(v_people->'thuphuong',v_people->'thithuy',v_people->'ngocanh',v_people->'minhduc',v_people->'ducanh',v_people->'bachduong')),
    jsonb_build_object('date','2026-09-13','staffIds',jsonb_build_array(v_people->'thuphuong',v_people->'thithuy',v_people->'ngocanh',v_people->'minhduc',v_people->'ducanh',v_people->'bachduong')),
    jsonb_build_object('date','2026-09-14','staffIds',jsonb_build_array(v_people->'thithuy',v_people->'ngocanh')),
    jsonb_build_object('date','2026-09-15','staffIds',jsonb_build_array(v_people->'thuphuong')),
    jsonb_build_object('date','2026-09-16','staffIds',jsonb_build_array(v_people->'bachduong')),
    jsonb_build_object('date','2026-09-17','staffIds',jsonb_build_array(v_people->'minhduc')),
    jsonb_build_object('date','2026-09-18','staffIds',jsonb_build_array(v_people->'ducanh')),
    jsonb_build_object('date','2026-09-19','staffIds',jsonb_build_array(v_people->'thuphuong',v_people->'thithuy',v_people->'ngocanh',v_people->'minhduc',v_people->'ducanh',v_people->'bachduong')),
    jsonb_build_object('date','2026-09-20','staffIds',jsonb_build_array(v_people->'thuphuong',v_people->'thithuy',v_people->'ngocanh',v_people->'minhduc',v_people->'ducanh',v_people->'bachduong')),
    jsonb_build_object('date','2026-09-21','staffIds',jsonb_build_array(v_people->'bachduong')),
    jsonb_build_object('date','2026-09-22','staffIds',jsonb_build_array(v_people->'thithuy',v_people->'ngocanh')),
    jsonb_build_object('date','2026-09-23','staffIds',jsonb_build_array(v_people->'minhduc')),
    jsonb_build_object('date','2026-09-24','staffIds',jsonb_build_array(v_people->'ducanh')),
    jsonb_build_object('date','2026-09-25','staffIds',jsonb_build_array(v_people->'thuphuong')),
    jsonb_build_object('date','2026-09-26','staffIds',jsonb_build_array(v_people->'thuphuong',v_people->'thithuy',v_people->'ngocanh',v_people->'minhduc',v_people->'ducanh',v_people->'bachduong')),
    jsonb_build_object('date','2026-09-27','staffIds',jsonb_build_array(v_people->'thuphuong',v_people->'thithuy',v_people->'ngocanh',v_people->'minhduc',v_people->'ducanh',v_people->'bachduong')),
    jsonb_build_object('date','2026-09-28','staffIds',jsonb_build_array(v_people->'minhduc')),
    jsonb_build_object('date','2026-09-29','staffIds',jsonb_build_array(v_people->'ducanh')),
    jsonb_build_object('date','2026-09-30','staffIds',jsonb_build_array(v_people->'thuphuong'))
  ));
end
$block$;

commit;
