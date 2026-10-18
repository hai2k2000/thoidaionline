#!/usr/bin/env bash
set -Eeuo pipefail

# Runs only against the disposable PostgreSQL created by start-sandbox.sh.
: "${E2E_DB_URL:?E2E_DB_URL is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

command -v psql >/dev/null || { echo "psql is required" >&2; exit 1; }
free_kb=$(df -Pk "${RUNNER_TEMP:-/tmp}" | awk 'NR==2 {print $4}')
min_free_kb=$((10 * 1024 * 1024))
if [[ -z "$free_kb" || "$free_kb" -lt "$min_free_kb" ]]; then
  echo "disk_guard_failed: free_kb=${free_kb:-unknown} minimum_kb=$min_free_kb" >&2
  exit 1
fi

output_file="${RUNNER_TEMP:-/tmp}/cp6-benchmark.log"
umask 077
{ /usr/bin/time -v psql "$E2E_DB_URL" -v ON_ERROR_STOP=1 -f scripts/e2e/cp6-benchmark.sql; } 2>&1 | tee "$output_file"
node scripts/e2e/cp6-benchmark-evidence.mjs "$output_file"
