#!/usr/bin/env bash
set -Eeuo pipefail

db_url=${THOIDAI_RBAC_DB_URL:-${DATABASE_URL:-${SUPABASE_DB_URL:-}}}
psql_bin=${THOIDAI_PSQL_BIN:-psql}
target_path=${THOIDAI_RBAC_ROLLBACK_TARGET_PATH:-}

if [[ -n "$target_path" ]]; then
  [[ -d "$target_path" ]] || {
    echo "RBAC rollback compatibility: target is invalid" >&2
    exit 1
  }
  target_support="legacy"
  if [[ -f "$target_path/.release-meta" ]]; then
    target_support=$(awk -F= '$1=="rbac_v2" {print $2; exit}' "$target_path/.release-meta")
  fi
  case "$target_support" in
    supported)
      echo "RBAC rollback compatibility: PASS (target supports RBAC V2)"
      exit 0
      ;;
    legacy|"") ;;
    *)
      echo "RBAC rollback compatibility: target support is unknown" >&2
      exit 1
      ;;
  esac
fi

if [[ -z "$db_url" ]]; then
  echo "RBAC rollback compatibility: database URL is required" >&2
  exit 1
fi

"$psql_bin" "$db_url" -X -v ON_ERROR_STOP=1 -qAt <<'SQL'
do $$
begin
  if to_regprocedure('public.rbac_v2_assert_legacy_rollback_compatible()') is null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_permission_grants'
        and column_name = 'effect'
    ) then
      raise exception 'RBAC V2 rollback gate is absent while explicit effects are installed.';
    end if;
    return;
  end if;
  perform public.rbac_v2_assert_legacy_rollback_compatible();
end
$$;
SQL

echo "RBAC rollback compatibility: PASS"
