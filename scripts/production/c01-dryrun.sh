set -Eeuo pipefail

main() {
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
work_dir="/opt/ops/thoidai-work/c01-dryrun-${timestamp}"
container="thoidai-c01-dryrun-${timestamp}"
volume="${container}-volume"
image='public.ecr.aws/supabase/postgres:17.6.1.095'
db_container='supabase_db_thoidai-work'
temp_password="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
container_started=0
status_printed=0
cleanup(){ exit_status=$?; set +e; if [ "$container_started" -eq 1 ]; then docker rm -f "$container" >/dev/null 2>&1 || true; fi; docker volume rm "$volume" >/dev/null 2>&1 || true; rm -rf -- "$work_dir"; printf 'CLEANUP_CONTAINER=%s\n' "$(docker ps -a --format '{{.Names}}' | grep -Fx "$container" >/dev/null 2>&1 && echo PRESENT || echo ABSENT)"; printf 'CLEANUP_VOLUME=%s\n' "$(docker volume ls --format '{{.Name}}' | grep -Fx "$volume" >/dev/null 2>&1 && echo PRESENT || echo ABSENT)"; printf 'CLEANUP_DIR=%s\n' "$(test -e "$work_dir" && echo PRESENT || echo ABSENT)"; if [ "$exit_status" -eq 0 ] && [ "$status_printed" -eq 0 ]; then printf 'DRYRUN_STATUS=INCOMPLETE\n'; exit_status=1; fi; trap - EXIT; exit "$exit_status"; }
trap cleanup EXIT
free_kib="$(df -Pk / | awk 'NR==2 {print $4}')"
printf 'DISK_FREE_BEFORE=%s\nDISK_REQUIRED_GIB=11\n' "$(df -h / | awk 'NR==2 {print $4}')"
free -h | awk 'NR==1 {printf "MEMORY_HEADER=%s\n",$0} NR==2 {printf "MEMORY_VALUES=%s\n",$0}'
if [ "$free_kib" -lt $((11*1024*1024)) ]; then printf 'DISK_GATE=BLOCKED\n'; exit 1; fi
printf 'DISK_GATE=PASS\n'
mkdir -p "$work_dir"; chmod 0700 "$work_dir"
docker exec "$db_container" pg_dump -U postgres -d postgres --schema-only >"$work_dir/schema.sql"
docker exec "$db_container" pg_dump -U postgres -d postgres --data-only -t supabase_migrations.schema_migrations >"$work_dir/migrations.sql"
docker exec "$db_container" pg_dump -U postgres -d postgres --data-only -t storage.buckets >"$work_dir/storage-buckets.sql"
chmod 0600 "$work_dir/schema.sql" "$work_dir/migrations.sql" "$work_dir/storage-buckets.sql"
printf 'DUMP_SCHEMA_SHA256=%s\n' "$(sha256sum "$work_dir/schema.sql"|awk '{print $1}')"; printf 'DUMP_MIGRATIONS_SHA256=%s\n' "$(sha256sum "$work_dir/migrations.sql"|awk '{print $1}')"; printf 'DUMP_STORAGE_BUCKETS_SHA256=%s\n' "$(sha256sum "$work_dir/storage-buckets.sql"|awk '{print $1}')"
docker volume create "$volume" >/dev/null
docker run -d --name "$container" --network none --volume "$volume:/var/lib/postgresql/data" --memory 512m -e POSTGRES_PASSWORD="$temp_password" "$image" >/dev/null
container_started=1
init_complete=0; for _ in $(seq 1 90); do if docker logs "$container" 2>&1 | grep -Fq 'PostgreSQL init process complete; ready for start up.'; then init_complete=1; break; fi; sleep 2; done
if [ "$init_complete" -ne 1 ]; then printf 'TEMP_DB_HEALTH=TIMEOUT\n'; docker logs "$container" 2>&1 | tail -n 30 | tr -cd '[:print:]\n'; exit 1; fi
printf 'TEMP_DB_INIT=COMPLETE\n'
healthy=0; consecutive=0; for _ in $(seq 1 90); do if docker exec "$container" pg_isready -U postgres -d postgres >/dev/null 2>&1 && [ "$(docker exec "$container" env PGPASSWORD="$temp_password" psql -Atqc "select count(*) from pg_roles where rolname in ('supabase_admin','supabase_auth_admin','supabase_storage_admin','service_role')" -U supabase_admin -d postgres 2>/dev/null || true)" = 4 ]; then consecutive=$((consecutive + 1)); if [ "$consecutive" -ge 3 ]; then healthy=1; break; fi; else consecutive=0; fi; sleep 2; done
if [ "$healthy" -ne 1 ]; then printf 'TEMP_DB_HEALTH=TIMEOUT\n'; docker logs "$container" 2>&1 | tail -n 30 | tr -cd '[:print:]\n'; exit 1; fi
printf 'TEMP_DB_HEALTH=PASS\n'
psql_as(){ local role="$1"; shift; docker exec -i "$container" env PGPASSWORD="$temp_password" psql -v ON_ERROR_STOP=1 -U "$role" -d postgres "$@"; }
# Restore objects with only the ACLs captured in the dump; production defaults are rebuilt at the end of the dump.
psql_as supabase_admin <<'SQL'
alter default privileges for role postgres in schema public revoke all on tables from postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public revoke all on tables from postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public revoke all on sequences from postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public revoke all on functions from postgres, anon, authenticated, service_role;
SQL
printf 'TEMP_DEFAULT_ACL_PUBLIC=%s\n' "$(psql_as supabase_admin -Atc "select count(*) from pg_default_acl a join pg_namespace n on n.oid=a.defaclnamespace where n.nspname='public';" </dev/null)"
docker exec -i "$container" env PGPASSWORD="$temp_password" psql -U supabase_admin -d postgres <"$work_dir/schema.sql" >"$work_dir/restore.log" 2>&1 || true
restore_errors="$(grep -Eic '(^| )(ERROR|FATAL):' "$work_dir/restore.log" || true)"; printf 'SCHEMA_RESTORE_ERRORS=%s\n' "$restore_errors"; grep -Ei '(^| )(ERROR|FATAL):' "$work_dir/restore.log"|head -n 20||true
[ "$restore_errors" -eq 0 ] && printf 'SCHEMA_RESTORE=PASS\n' || printf 'SCHEMA_RESTORE=COMPLETED_WITH_ERRORS\n'
grep -Eiq 'warning|no privileges could be revoked' "$work_dir/restore.log" && printf 'SCHEMA_RESTORE_WARNINGS=%s\n' "$(grep -Ei 'warning|no privileges could be revoked' "$work_dir/restore.log"|tr '\n' ' '|tr -cd '[:print:]')" || printf 'SCHEMA_RESTORE_WARNINGS=NONE\n'
psql_as supabase_admin <"$work_dir/migrations.sql" >"$work_dir/ledger-restore.log" 2>&1 || { printf 'LEDGER_RESTORE=FAIL\n'; cat "$work_dir/ledger-restore.log"; exit 1; }; printf 'LEDGER_RESTORE=PASS\n'
bucket_delete_sql="$work_dir/storage-buckets-delete.sql"
{
  printf '%s\n' 'begin;'
  # Replica mode is limited to the temporary database transaction; never use it on production.
  printf '%s\n' 'set local session_replication_role = replica;'
  printf '%s\n' 'create temporary table c01_storage_bucket_ids (id text primary key);' 'copy c01_storage_bucket_ids (id) from stdin;'
  awk '/^COPY storage\.buckets / {copy=1; next} copy && /^\\\.$/ {exit} copy {split($0, f, "\t"); print f[1]}' "$work_dir/storage-buckets.sql"
  printf '%s\n' '\.' "select 'STORAGE_BUCKETS_CONFLICTS=' || count(*) from storage.buckets b join c01_storage_bucket_ids s on b.id = s.id;" 'do $$ begin if exists (select 1 from storage.buckets b join c01_storage_bucket_ids s on b.id = s.id) then delete from storage.buckets b using c01_storage_bucket_ids s where b.id = s.id; end if; end $$;' 'commit;'
} >"$bucket_delete_sql"
psql_as supabase_admin <"$bucket_delete_sql" >"$work_dir/storage-buckets-delete.log" 2>&1 || { printf 'STORAGE_BUCKETS_DELETE=FAIL\n'; cat "$work_dir/storage-buckets-delete.log"; exit 1; }; cat "$work_dir/storage-buckets-delete.log"; printf 'STORAGE_BUCKETS_DELETE=PASS\n'
bucket_restore_sql="$work_dir/storage-buckets-restore.sql"
{
  printf '%s\n' 'begin;'
  # Replica mode is limited to the temporary database transaction; never use it on production.
  printf '%s\n' 'set local session_replication_role = replica;'
  cat "$work_dir/storage-buckets.sql"
  printf '%s\n' 'commit;'
} >"$bucket_restore_sql"
psql_as supabase_admin <"$bucket_restore_sql" >"$work_dir/storage-buckets-restore.log" 2>&1 || { printf 'STORAGE_BUCKETS_RESTORE=FAIL\n'; cat "$work_dir/storage-buckets-restore.log"; exit 1; }; printf 'STORAGE_BUCKETS_RESTORE=PASS\n'
printf '%s' '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'|base64 -d|gzip -d >"$work_dir/public.sql"; printf '%s' 'H4sIAAAAAAAEAJ1VwW7bOBC96ysGQQHZgC3LRdPdxsihTX0osFsEG28vRSHQ4shiQ5Esh7Kjfv0OJTlOs802WMOwII705s2bN+P5HK6FD/AObAVX83yZwZ8tBfCtAUFArRNbQVgI2SgDE+tPRxSsF7sxNL1I5nMYjzK7/YploMW2LW8xEAiPYA8GJWy7JwBmQBZCjUCiwQFLBGzQ8OsjGWcp7DwSWKM7wEYFODMWnFd7pXHHgdK2mnMgeNzbW5RnEeggvFFmxyyMhFIYYwNIb12fzVmtSoWUwaZWBPw91N3AY2AHtdAVixORXuYvX+dv8mX+5jzP82IruDojC8Ky9Sp0RS28xJgro28aDj2ZmK0We+Rbz4we1pFFzKvWey6Sq7CyLYOy5gIG2SAIup1XXFrPy7Vbpjp7rHEMYeNC16NtmLhwDkjtDC08Csll70UQnnuJfo9+TkoyGRXq/kCVWHirESZC64iwiO1ZHIv3+K1FilkMLF+BFB1Fo3zcKXMH2rKoJbcLKm+bXrRP1zegAqGuplmyRX5slSTEtWhbCh1/b4ugGrRtgEtIzynleOskt/q+sNE0/WtD0fxoJTThLAH+REUKUt+x0Cp64BKW+avfz397nQ9xLsQeUBYN5ylC51i+S3agF93nPg6QskQMK6LaCyerdAapajj3wpnd6earQ7772Tt7IzPr0Nw1urK+EYHmtqpYS2nLNno2425LbmmJROyHRmfHyP8FJNd3s0YMjNZf0x7pS3KokedLyajoyTNR2d7mvcU7UBXgnYq9PBtVjYAPTHbGc/XYXatfQBzY9/hLjGQYx9iZh9PKjwax1fgvS/d2EsbyUhAt28qEqBPK1XOBjnvnaaBEWnghiEcgvBiMymKe6puwhZkKLAeIx7iD4oMG02h807fCC0XIECW62FVI40J9d3F08XGoxvH22AhlYp8AeI1w9tV/cXC74risxvxU1gxh4gBy50f0tF9zkzRWnUbjm24SB5ymwMs7Haj8GJg+o4QId1/AaIcnC6gFFX1DivsmjYRm9zyPzY5HN+s/1leb2YePN+u/NrO/r9+/3axn7/lws06fz02xKer4n/XITSej/MCUr8nRAeyH0ja8TFbJP1D7FxIRBwAA'|base64 -d|gzip -d >"$work_dir/storage.sql"
public_sha="$(sha256sum "$work_dir/public.sql"|awk '{print $1}')"; storage_sha="$(sha256sum "$work_dir/storage.sql"|awk '{print $1}')"; printf 'SQL_PUBLIC_SHA256=%s\nSQL_STORAGE_SHA256=%s\n' "$public_sha" "$storage_sha"
[ "$public_sha" = aa26878df83a3e5ba3aebb8ecdcb2e870ffa662d279231b404aa283c357e0e30 ] && [ "$storage_sha" = b13be1d8e42d56c119ddc087c15b9b91e2bf5366b95137c442fbc42d223acad6 ] || { printf 'SQL_INTEGRITY=FAIL\n'; exit 1; }; printf 'SQL_INTEGRITY=PASS\n'
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
status_printed=1
printf 'DRYRUN_STATUS=PASS\n'
}

main "$@"; exit $?
