#!/usr/bin/env bash
set -euo pipefail

container="thoidai-disposable-weekly-report-20261006-edcd608"
work_dir="/tmp/thoidai-weekly-report-rehearsal-edcd608"
expected_sha="f9b91323103c693daa2e4cae7777dbe550e4d76d22ddba460bf32da1a322986d"

cleanup() {
  code=$?
  if [ "$code" -ne 0 ] && docker ps -a --format '{{.Names}}' | grep -Fxq "$container"; then
    echo '--- disposable container logs ---' >&2
    docker logs "$container" 2>&1 | tail -100 >&2 || true
  fi
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf -- "$work_dir"
  exit "$code"
}
trap cleanup EXIT

test "$(id -u)" -eq 0
test -d "$work_dir"
test "$(sha256sum "$work_dir/20261006130000_personal_weekly_reports.sql" | awk '{print $1}')" = "$expected_sha"
test -f "$work_dir/personal_weekly_report_first_completion.sql"

printf 'disk_before_bytes='
df -B1 --output=avail / | tail -1 | tr -d ' '

if docker ps -a --format '{{.Names}}' | grep -Fxq "$container"; then
  echo 'refusing to reuse an existing container name' >&2
  exit 1
fi

docker run -d \
  --name "$container" \
  --network none \
  --tmpfs /var/lib/postgresql/data:rw,size=536870912 \
  --label com.thoidai.disposable=1 \
  --label com.thoidai.disposable-db-test=personal-weekly-report-v1 \
  -e POSTGRES_PASSWORD=rehearsal-only \
  -e POSTGRES_DB=postgres \
  postgres:17 >/dev/null

for _ in $(seq 1 30); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$container" pg_isready -U postgres >/dev/null
printf 'disposable_postgres_version='
docker exec "$container" psql -U postgres -d postgres -Atc 'show server_version;'
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'create database weekly_report_rehearsal;'

docker exec -i "$container" psql -U postgres -d weekly_report_rehearsal -v ON_ERROR_STOP=1 \
  < "$work_dir/bootstrap.sql"
docker exec -i "$container" psql -U postgres -d weekly_report_rehearsal -v ON_ERROR_STOP=1 \
  < "$work_dir/20261006130000_personal_weekly_reports.sql"
docker exec -i "$container" psql -U postgres -d weekly_report_rehearsal -v ON_ERROR_STOP=1 \
  < "$work_dir/assertions.sql"
docker exec -i "$container" psql -U postgres -d weekly_report_rehearsal -v ON_ERROR_STOP=1 \
  < "$work_dir/personal_weekly_report_first_completion.sql"

printf 'container_mounts='
docker inspect "$container" --format '{{json .Mounts}}'
printf 'published_ports='
docker inspect "$container" --format '{{json .NetworkSettings.Ports}}'

docker rm -f "$container" >/dev/null
if docker ps -a --format '{{.Names}}' | grep -Fxq "$container"; then
  echo 'cleanup_container=FAIL'
  exit 1
fi
printf 'cleanup_container=PASS\n'

printf 'matching_volume_count='
docker volume ls --format '{{.Name}}' | grep -Fc "$container" || true

rm -rf -- "$work_dir"
trap - EXIT

printf 'disk_after_bytes='
df -B1 --output=avail / | tail -1 | tr -d ' '
