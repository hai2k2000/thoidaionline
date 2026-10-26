set -Eeuo pipefail

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
work_dir="/opt/ops/thoidai-work/c01-dryrun-${timestamp}"
container="thoidai-c01-dryrun-${timestamp}"
volume="${container}-volume"
image='public.ecr.aws/supabase/postgres:17.6.1.095'
db_container='supabase_db_thoidai-work'
temp_password="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
container_started=0
cleanup(){ set +e; if [ "$container_started" -eq 1 ]; then docker rm -f "$container" >/dev/null 2>&1 || true; fi; docker volume rm "$volume" >/dev/null 2>&1 || true; rm -rf -- "$work_dir"; printf 'CLEANUP_CONTAINER=%s\n' "$(docker ps -a --format '{{.Names}}' | grep -Fx "$container" >/dev/null 2>&1 && echo PRESENT || echo ABSENT)"; printf 'CLEANUP_VOLUME=%s\n' "$(docker volume ls --format '{{.Name}}' | grep -Fx "$volume" >/dev/null 2>&1 && echo PRESENT || echo ABSENT)"; printf 'CLEANUP_DIR=%s\n' "$(test -e "$work_dir" && echo PRESENT || echo ABSENT)"; }
trap cleanup EXIT
free_kib="$(df -Pk / | awk 'NR==2 {print $4}')"
printf 'DISK_FREE_BEFORE=%s\nDISK_REQUIRED_GIB=11\n' "$(df -h / | awk 'NR==2 {print $4}')"
free -h | awk 'NR==1 {printf "MEMORY_HEADER=%s\n",$0} NR==2 {printf "MEMORY_VALUES=%s\n",$0}'
if [ "$free_kib" -lt $((11*1024*1024)) ]; then printf 'DISK_GATE=BLOCKED\n'; exit 1; fi
printf 'DISK_GATE=PASS\n'
mkdir -p "$work_dir"; chmod 0700 "$work_dir"
docker exec "$db_container" pg_dump -U postgres -d postgres --schema-only >"$work_dir/schema.sql"
docker exec "$db_container" pg_dump -U postgres -d postgres --data-only -t supabase_migrations.schema_migrations >"$work_dir/migrations.sql"
chmod 0600 "$work_dir/schema.sql" "$work_dir/migrations.sql"
printf 'DUMP_SCHEMA_SHA256=%s\n' "$(sha256sum "$work_dir/schema.sql"|awk '{print $1}')"; printf 'DUMP_MIGRATIONS_SHA256=%s\n' "$(sha256sum "$work_dir/migrations.sql"|awk '{print $1}')"
docker volume create "$volume" >/dev/null
docker run -d --name "$container" --network none --volume "$volume:/var/lib/postgresql/data" --memory 512m -e POSTGRES_PASSWORD="$temp_password" "$image" >/dev/null
container_started=1
healthy=0; for _ in $(seq 1 60); do if docker exec "$container" pg_isready -U postgres -d postgres >/dev/null 2>&1; then healthy=1; break; fi; sleep 2; done
if [ "$healthy" -ne 1 ]; then printf 'TEMP_DB_HEALTH=TIMEOUT\n'; exit 1; fi
printf 'TEMP_DB_HEALTH=PASS\n'
psql_as(){ local role="$1"; shift; docker exec -i "$container" env PGPASSWORD="$temp_password" psql -v ON_ERROR_STOP=1 -U "$role" -d postgres "$@"; }
docker exec -i "$container" env PGPASSWORD="$temp_password" psql -U supabase_admin -d postgres <"$work_dir/schema.sql" >"$work_dir/restore.log" 2>&1 || true
restore_errors="$(grep -Eic '(^| )ERROR:' "$work_dir/restore.log" || true)"; printf 'SCHEMA_RESTORE_ERRORS=%s\n' "$restore_errors"; grep -Ei '(^| )ERROR:' "$work_dir/restore.log"|head -n 20||true
[ "$restore_errors" -eq 0 ] && printf 'SCHEMA_RESTORE=PASS\n' || printf 'SCHEMA_RESTORE=COMPLETED_WITH_ERRORS\n'
grep -Eiq 'warning|no privileges could be revoked' "$work_dir/restore.log" && printf 'SCHEMA_RESTORE_WARNINGS=%s\n' "$(grep -Ei 'warning|no privileges could be revoked' "$work_dir/restore.log"|tr '\n' ' '|tr -cd '[:print:]')" || printf 'SCHEMA_RESTORE_WARNINGS=NONE\n'
psql_as supabase_admin <"$work_dir/migrations.sql" >"$work_dir/ledger-restore.log" 2>&1 || { printf 'LEDGER_RESTORE=FAIL\n'; cat "$work_dir/ledger-restore.log"; exit 1; }; printf 'LEDGER_RESTORE=PASS\n'
printf '%s' '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'|base64 -d|gzip -d >"$work_dir/public.sql"; printf '%s' 'H4sIAAAAAAAEAJ1VwW7bOBC96ysGQQHZgC3LRdPdxsihTX0osFsEG28vRSHQ4shiQ5Esh7Kjfv0OJTlOs802WMOwII705s2bN+P5HK6FD/AObAVX83yZwZ8tBfCtAUFArRNbQVgI2SgDE+tPRxSsF7sxNL1I5nMYjzK7/YploMW2LW8xEAiPYA8GJWy7JwBmQBZCjUCiwQFLBGzQ8OsjGWcp7DwSWKM7wEYFODMWnFd7pXHHgdK2mnMgeNzbW5RnEeggvFFmxyyMhFIYYwNIb12fzVmtSoWUwaZWBPw91N3AY2AHtdAVixORXuYvX+dv8mX+5jzP82IruDojC8Ky9Sp0RS28xJgro28aDj2ZmK0We+Rbz4we1pFFzKvWey6Sq7CyLYOy5gIG2SAIup1XXFrPy7Vbpjp7rHEMYeNC16NtmLhwDkjtDC08Csll70UQnnuJfo9+TkoyGRXq/kCVWHirESZC64iwiO1ZHIv3+K1FilkMLF+BFB1Fo3zcKXMH2rKoJbcLKm+bXrRP1zegAqGuplmyRX5slSTEtWhbCh1/b4ugGrRtgEtIzynleOskt/q+sNE0/WtD0fxoJTThLAH+REUKUt+x0Cp64BKW+avfz397nQ9xLsQeUBYN5ylC51i+S3agF93nPg6QskQMK6LaCyerdAapajj3wpnd6earQ7772Tt7IzPr0Nw1urK+EYHmtqpYS2nLNno2425LbmmJROyHRmfHyP8FJNd3s0YMjNZf0x7pS3KokedLyajoyTNR2d7mvcU7UBXgnYq9PBtVjYAPTHbGc/XYXatfQBzY9/hLjGQYx9iZh9PKjwax1fgvS/d2EsbyUhAt28qEqBPK1XOBjnvnaaBEWnghiEcgvBiMymKe6puwhZkKLAeIx7iD4oMG02h807fCC0XIECW62FVI40J9d3F08XGoxvH22AhlYp8AeI1w9tV/cXC74risxvxU1gxh4gBy50f0tF9zkzRWnUbjm24SB5ymwMs7Haj8GJg+o4QId1/AaIcnC6gFFX1DivsmjYRm9zyPzY5HN+s/1leb2YePN+u/NrO/r9+/3axn7/lws06fz02xKer4n/XITSej/MCUr8nRAeyH0ja8TFbJP1D7FxIRBwAA'|base64 -d|gzip -d >"$work_dir/storage.sql"
public_sha="$(sha256sum "$work_dir/public.sql"|awk '{print $1}')"; storage_sha="$(sha256sum "$work_dir/storage.sql"|awk '{print $1}')"; printf 'SQL_PUBLIC_SHA256=%s\nSQL_STORAGE_SHA256=%s\n' "$public_sha" "$storage_sha"
[ "$public_sha" = 681d1a00e61fbdcb17ee02fb91680e65f79817ee53d5d0ca6835b2ba2957a413 ] && [ "$storage_sha" = b13be1d8e42d56c119ddc087c15b9b91e2bf5366b95137c442fbc42d223acad6 ] || { printf 'SQL_INTEGRITY=FAIL\n'; exit 1; }; printf 'SQL_INTEGRITY=PASS\n'
collect(){ psql_as supabase_admin -At -F '=' <<'SQL'
select 'TABLE_LEAK',count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','f','S') and (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'))
union all select 'FUNCTION_LEAK',count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))
union all select 'POLICY_LEAK',count(*) from pg_policies where schemaname='public' and ('anon'=any(roles) or 'authenticated'=any(roles) or 'public'=any(roles))
union all select 'DEFAULT_ACL_LEAK',count(*) from pg_default_acl a join pg_namespace n on n.oid=a.defaclnamespace,aclexplode(a.defaclacl)x where n.nspname='public' and pg_get_userbyid(a.defaclrole)='postgres' and x.grantee in ('anon'::regrole,'authenticated'::regrole)
union all select 'SERVICE_ROLE_MISSING_SELECT',count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m') and not has_table_privilege('service_role',c.oid,'SELECT')
union all select 'SERVICE_ROLE_MISSING_DML_ON_EXPOSED',count(*) from unnest(array['work_schedules','task_completion_scores','task_quick_report_idempotency','db_record_code_counters','employee_profiles','official_documents','document_assignments','password_reset_tokens','password_reset_attempts'])t(name) where not has_table_privilege('service_role',format('public.%I',t.name)::regclass,'SELECT,INSERT,UPDATE,DELETE')
union all select 'SERVICE_ROLE_RPC_EXECUTE_COUNT',count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'api\_%' and has_function_privilege('service_role',p.oid,'EXECUTE')
union all select 'RLS_OFF_COUNT',count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
union all select 'STORAGE_ANON_POLICY',count(*) from pg_policies where schemaname='storage' and ('anon'=any(roles) or 'public'=any(roles))
union all select 'STORAGE_PUBLIC_BUCKETS',count(*) from storage.buckets where public
union all select 'STORAGE_OBJECTS_ANON_GRANT',count(*) from (values('storage.objects'),('storage.buckets'))t(rel) where has_table_privilege('anon',t.rel::regclass,'SELECT,INSERT,UPDATE,DELETE') order by 1;
SQL
}
value(){ printf '%s\n' "$1"|awk -F= -v k="$2" '$1==k{print $2}'; }
before="$(collect)"; while IFS='=' read -r k v; do printf 'BEFORE_%s=%s\n' "$k" "$v"; done<<<"$before"
ok=1; while IFS='=' read -r k e; do [ "$(value "$before" "$k")" = "$e" ] || { printf 'BASELINE_MISMATCH_%s=%s_EXPECTED_%s\n' "$k" "$(value "$before" "$k")" "$e"; ok=0; }; done <<'BASE'
TABLE_LEAK=9
FUNCTION_LEAK=13
POLICY_LEAK=6
DEFAULT_ACL_LEAK=24
RLS_OFF_COUNT=4
STORAGE_ANON_POLICY=2
STORAGE_OBJECTS_ANON_GRANT=2
STORAGE_PUBLIC_BUCKETS=1
SERVICE_ROLE_RPC_EXECUTE_COUNT=108
BASE
[ "$ok" -eq 1 ] || { printf 'BASELINE_MATCH=NO\nDRYRUN_STATUS=INCONCLUSIVE\n'; exit 1; }; printf 'BASELINE_MATCH=YES\n'
printf 'MIGRATION_PUBLIC=START\n'; psql_as postgres <"$work_dir/public.sql"; printf 'MIGRATION_PUBLIC=PASS\n'
printf 'MIGRATION_STORAGE=START\n'; psql_as supabase_admin <"$work_dir/storage.sql"; printf 'MIGRATION_STORAGE=PASS\n'
after="$(collect)"; while IFS='=' read -r k v; do printf 'AFTER_%s=%s\n' "$k" "$v"; done<<<"$after"
ok=1; for k in TABLE_LEAK FUNCTION_LEAK POLICY_LEAK DEFAULT_ACL_LEAK SERVICE_ROLE_MISSING_SELECT SERVICE_ROLE_MISSING_DML_ON_EXPOSED RLS_OFF_COUNT STORAGE_ANON_POLICY STORAGE_OBJECTS_ANON_GRANT STORAGE_PUBLIC_BUCKETS; do [ "$(value "$after" "$k")" = 0 ] || ok=0; done; [ "$(value "$after" SERVICE_ROLE_RPC_EXECUTE_COUNT)" = 108 ] || ok=0
[ "$ok" -eq 1 ] || { printf 'DRYRUN_STATUS=INCONCLUSIVE\n'; exit 1; }
psql_as supabase_admin <<'SQL'
begin; set local role service_role; select 1 from public.work_schedules limit 0; rollback;
SQL
printf 'ROLE_SERVICE_READ=PASS\n'
if out="$(psql_as supabase_admin <<'SQL' 2>&1
begin; set local role anon; select 1 from public.work_schedules; rollback;
SQL
)"; then printf 'ROLE_ANON_READ=UNEXPECTEDLY_ALLOWED\n'; exit 1; elif printf '%s' "$out"|grep -Fq 'permission denied for table work_schedules'; then printf 'ROLE_ANON_READ=DENIED\n'; else printf 'ROLE_ANON_READ=ERROR\nROLE_ANON_READ_REASON=%s\n' "$(printf '%s' "$out"|tr '\n' ' '|tr -cd '[:print:]')"; exit 1; fi
if out="$(psql_as supabase_admin <<'SQL' 2>&1
begin; set local role anon; select public.api_next_database_record_code(); rollback;
SQL
)"; then printf 'ROLE_ANON_RPC=UNEXPECTEDLY_ALLOWED\n'; exit 1; elif printf '%s' "$out"|grep -Fq 'permission denied for function api_next_database_record_code'; then printf 'ROLE_ANON_RPC=DENIED\n'; else printf 'ROLE_ANON_RPC=ERROR\nROLE_ANON_RPC_REASON=%s\n' "$(printf '%s' "$out"|tr '\n' ' '|tr -cd '[:print:]')"; exit 1; fi
if out="$(psql_as supabase_admin <<'SQL' 2>&1
begin; set local role service_role; insert into public.tasks(title) values ('C-01 dry-run trigger probe'); rollback;
SQL
)"; then printf 'TRIGGER_INSERT=PASS\n'; else printf 'TRIGGER_INSERT=SKIPPED\nTRIGGER_INSERT_REASON=%s\n' "$(printf '%s' "$out"|tr '\n' ' '|tr -cd '[:print:]')"; fi
printf 'DRYRUN_STATUS=PASS\n'
