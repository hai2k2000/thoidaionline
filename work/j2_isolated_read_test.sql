\set ON_ERROR_STOP on
insert into public.tasks(id,title,owner_id,created_at) values
  ('00000000-0000-0000-0000-000000000001','normal', '10000000-0000-0000-0000-000000000001','2026-10-03T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000002','journalism news', '10000000-0000-0000-0000-000000000001','2026-10-02T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000003','journalism photo', '10000000-0000-0000-0000-000000000002','2026-10-01T00:00:00Z');

insert into public.journalism_task_details(task_id,work_kind_id,publication_status,planned_publication_at)
select '00000000-0000-0000-0000-000000000002', id, 'scheduled', '2026-10-10T00:00:00Z'
from public.journalism_work_kinds where code='news';
insert into public.journalism_task_details(task_id,work_kind_id,publication_status,planned_publication_at,published_at)
select '00000000-0000-0000-0000-000000000003', id, 'published', '2026-10-20T00:00:00Z', '2026-10-21T00:00:00Z'
from public.journalism_work_kinds where code='photo';

do $$
declare n integer;
begin
  select count(*) into n from public.tasks;
  if n <> 3 then raise exception 'no filter count %', n; end if;
  select count(*) into n from public.tasks t join public.journalism_task_details d on d.task_id=t.id;
  if n <> 2 then raise exception 'journalism only count %', n; end if;
  select count(*) into n from public.tasks t left join public.journalism_task_details d on d.task_id=t.id where d.task_id is null;
  if n <> 1 then raise exception 'normal only count %', n; end if;
  select count(*) into n from public.tasks t join public.journalism_task_details d on d.task_id=t.id join public.journalism_work_kinds k on k.id=d.work_kind_id where k.code='news';
  if n <> 1 then raise exception 'work kind count %', n; end if;
  select count(*) into n from public.tasks t join public.journalism_task_details d on d.task_id=t.id where d.publication_status='published';
  if n <> 1 then raise exception 'publication status count %', n; end if;
  select count(*) into n from public.tasks t join public.journalism_task_details d on d.task_id=t.id where d.planned_publication_at >= '2026-10-15'::timestamptz;
  if n <> 1 then raise exception 'planned date count %', n; end if;
  select count(*) into n from (
    select t.id from public.tasks t join public.journalism_task_details d on d.task_id=t.id order by t.created_at desc limit 1 offset 0
  ) q;
  if n <> 1 then raise exception 'pagination count %', n; end if;
  select count(*) into n from (
    select t.id from public.tasks t join public.journalism_task_details d on d.task_id=t.id where t.owner_id='10000000-0000-0000-0000-000000000001'
  ) q;
  if n <> 1 then raise exception 'authorized scope count %', n; end if;
end $$;

select 'read_behavior_pass' as result;
