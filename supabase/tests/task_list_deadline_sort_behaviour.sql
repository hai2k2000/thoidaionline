begin;
set local role postgres;
-- Exercise the actual table and its existing triggers; all fixtures are rolled back.
do $$
declare
  r public.tasks;
  fixture record;
  ids uuid[] := '{}';
  actual uuid[];
  n integer := 0;
begin
  for fixture in select * from (values
    ('new','urgent',date '2026-01-01',time '08:00',false,timestamp '2026-01-01 08:00',0),
    ('new','high',date '2026-01-01',time '09:00',false,timestamp '2026-01-01 09:00',1),
    ('new','normal',date '2026-01-01',null::time,false,timestamp '2026-01-01 23:59',2),
    ('new','low',null::date,time '12:00',false,null::timestamp,3),
    ('done','normal',date '2025-01-01',time '08:00',true,timestamp '2025-01-01 08:00',2),
    ('cancelled','high',null::date,null::time,true,null::timestamp,1)
  ) v(status,priority,due_date,due_time,closed,due_at,rank) loop
    n := n+1;
    insert into public.tasks(title,status,priority,due_date,due_time,task_type)
      values('task-list-sort behaviour '||n,fixture.status,fixture.priority,fixture.due_date,fixture.due_time,'personal')
      returning * into r;
    ids := array_append(ids,r.id);
    if r.list_closed is distinct from fixture.closed or r.list_due_at is distinct from fixture.due_at
       or r.list_priority_rank is distinct from fixture.rank then
      raise exception 'Generated insert values failed for fixture %',n;
    end if;
  end loop;
  select array_agg(id order by list_closed,list_due_at nulls last,created_at desc,id) into actual
    from public.tasks where id=any(ids);
  if actual is distinct from ids then raise exception 'Deadline ordering failed'; end if;
  update public.tasks set priority='low',due_date=null,due_time=null,status='cancelled' where id=ids[1] returning * into r;
  if not r.list_closed or r.list_due_at is not null or r.list_priority_rank<>3 then raise exception 'Generated update values failed'; end if;
  begin
    update public.tasks set list_priority_rank=0 where id=ids[1];
    raise exception 'Generated column unexpectedly writable';
  exception when sqlstate '428C9' then null;
  end;
  raise notice 'task_list_deadline_sort_behaviour PASS';
end $$;
rollback;
