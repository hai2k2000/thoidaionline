#!/usr/bin/env bash
set -euo pipefail

container=${J5D_PG_CONTAINER:-j5b-pg-test}
database=${J5D_PG_DATABASE:-j5c2}
psql() { docker exec -i "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 "$@"; }

psql <<'SQL'
do $$
declare a uuid := (select id from staff_users where active limit 1); d uuid := (select department_id from staff_users where id=a); k uuid := (select id from journalism_work_kinds limit 1);
begin
  delete from editorial_series_items where series_id in (select id from editorial_series where name like 'J5D Concurrency%');
  delete from editorial_series where name like 'J5D Concurrency%';
  delete from journalism_task_details where task_id in ('a5dc0000-0000-4000-8000-000000000001','a5dc0000-0000-4000-8000-000000000002','a5dc0000-0000-4000-8000-000000000003');
  delete from tasks where id in ('a5dc0000-0000-4000-8000-000000000001','a5dc0000-0000-4000-8000-000000000002','a5dc0000-0000-4000-8000-000000000003');
  insert into tasks(id,title,department_id,created_by,owner_id) values
    ('a5dc0000-0000-4000-8000-000000000001','J5D Concurrency A',d,a,a),
    ('a5dc0000-0000-4000-8000-000000000002','J5D Concurrency B',d,a,a),
    ('a5dc0000-0000-4000-8000-000000000003','J5D Concurrency C',d,a,a);
  insert into journalism_task_details(task_id,work_kind_id) values
    ('a5dc0000-0000-4000-8000-000000000001',k),('a5dc0000-0000-4000-8000-000000000002',k),('a5dc0000-0000-4000-8000-000000000003',k);
  insert into editorial_series(name,is_active,created_by) values ('J5D Concurrency Append',true,a),('J5D Concurrency A',true,a),('J5D Concurrency B',true,a);
end $$;
SQL

actor=$(docker exec "$container" psql -U postgres -d "$database" -Atc "select id from staff_users where active limit 1")
series=$(docker exec "$container" psql -U postgres -d "$database" -Atc "select id from editorial_series where name='J5D Concurrency Append'")
for task in a5dc0000-0000-4000-8000-000000000001 a5dc0000-0000-4000-8000-000000000002 a5dc0000-0000-4000-8000-000000000003; do
  printf "select public.api_attach_editorial_series_task_v1('%s','%s','%s');\n" "$actor" "$task" "$series" | docker exec -i "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 >/tmp/j5d-append-$task.out &
done
wait
count=$(docker exec "$container" psql -U postgres -d "$database" -Atc "select count(*) from editorial_series_items where series_id='$series'")
positions=$(docker exec "$container" psql -U postgres -d "$database" -Atc "select coalesce(string_agg(position::text,',' order by position),'') from editorial_series_items where series_id='$series'")
test "$count" = 3
test "$positions" = '1,2,3'
echo "CONCURRENT_APPEND_PASS count=$count positions=$positions"

task=a5dc0000-0000-4000-8000-000000000003
series_a=$(docker exec "$container" psql -U postgres -d "$database" -Atc "select id from editorial_series where name='J5D Concurrency A'")
series_b=$(docker exec "$container" psql -U postgres -d "$database" -Atc "select id from editorial_series where name='J5D Concurrency B'")
printf "select public.api_attach_editorial_series_task_v1('%s','%s','%s');\n" "$actor" "$task" "$series_a" | docker exec -i "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 >/tmp/j5d-same-a.out 2>/tmp/j5d-same-a.err &
printf "select public.api_attach_editorial_series_task_v1('%s','%s','%s');\n" "$actor" "$task" "$series_b" | docker exec -i "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 >/tmp/j5d-same-b.out 2>/tmp/j5d-same-b.err &
wait || true
memberships=$(docker exec "$container" psql -U postgres -d "$database" -Atc "select count(*) from editorial_series_items where task_id='$task'")
test "$memberships" = 1
echo "SAME_TASK_SERIES_CONCURRENCY_PASS memberships=$memberships"
