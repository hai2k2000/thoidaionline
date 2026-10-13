#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(uname -s)" != Linux ]]; then
  echo "rbac-rollback-gate-fixture: SKIP (CI runs on Linux)"
  exit 0
fi

root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT
bin="$root/bin"
mkdir -p "$bin"
mkdir -p "$root/supported" "$root/legacy"
printf 'rbac_v2=supported\n' > "$root/supported/.release-meta"
cat > "$bin/psql" <<'EOF'
#!/usr/bin/env bash
cat >/dev/null
[[ "${FAIL_GATE:-0}" != 1 ]]
EOF
chmod +x "$bin/psql"

PATH="$bin:$PATH" THOIDAI_RBAC_DB_URL=disposable \
  bash scripts/production/check-rbac-rollback-compatibility.sh >/dev/null

PATH="$bin:$PATH" THOIDAI_RBAC_ROLLBACK_TARGET_PATH="$root/supported" \
  bash scripts/production/check-rbac-rollback-compatibility.sh >/dev/null

if PATH="$bin:$PATH" THOIDAI_RBAC_DB_URL=disposable FAIL_GATE=1 \
  bash scripts/production/check-rbac-rollback-compatibility.sh >/dev/null 2>&1; then
  echo "rollback gate accepted a rejected compatibility check" >&2
  exit 1
fi

if THOIDAI_RBAC_DB_URL= \
  THOIDAI_RBAC_ROLLBACK_TARGET_PATH="$root/legacy" \
  bash scripts/production/check-rbac-rollback-compatibility.sh >/dev/null 2>&1; then
  echo "rollback gate accepted a missing database URL" >&2
  exit 1
fi

echo "rbac-rollback-gate-fixture: PASS"
