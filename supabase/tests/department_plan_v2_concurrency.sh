#!/usr/bin/env bash
set -Eeuo pipefail

database_url=${1:?usage: $0 <database-url>}
for _ in $(seq 1 12); do
  psql "$database_url" -v ON_ERROR_STOP=1 -Atqc "
    select id from public.api_get_or_create_department_plan(
      '00000000-0000-0000-0000-000000000001',
      'weekly', date '2026-06-08', date '2026-06-14',
      '00000000-0000-0000-0000-000000000011'
    );
  " &
done
wait

count=$(psql "$database_url" -v ON_ERROR_STOP=1 -Atqc "
  select count(*) from public.department_plans
  where department_id = '00000000-0000-0000-0000-000000000001'
    and period_type = 'weekly'
    and period_start = date '2026-06-08';
")
[[ "$count" == 1 ]] || { echo "expected one concurrent plan, got $count" >&2; exit 1; }
echo "department-plan-v2-concurrency: PASS"
