#!/usr/bin/env bash
set -Eeuo pipefail

root=$(mktemp -d)
bin=$(mktemp -d)
trap 'rm -rf -- "$root" "$bin"' EXIT
mkdir -p "$root/current-release" "$root/previous-release" "$root/rollback1-release" "$root/rollback-release" "$root/superseded-release" "$root/legacy-release"
write_meta() {
  cat > "$1/.release-meta" <<EOF
commit=0123456789abcdef0123456789abcdef01234567
created_at=2026-09-23T09:00:00Z
artifact_type=next-standalone
canonical_baseline=e501652e969900b97938acccd8f998df4e5d1873
protection=managed
rollback_eligible=yes
health_status=pass
deploy_status=success
EOF
  printf 'health_status=pass\ndeploy_status=success\n' > "$1/.deploy-success"
  mkdir -p "$1/.next"
  touch "$1/.next/BUILD_ID" "$1/required-route-manifest.json"
}
write_meta "$root/current-release"
write_meta "$root/previous-release"
write_meta "$root/rollback1-release"
write_meta "$root/rollback-release"
write_meta "$root/superseded-release"
touch "$root/legacy-release/.next-BUILD_ID"
ln -s "$root/current-release" "$root/current"
ln -s "$root/previous-release" "$root/previous"
ln -s "$root/rollback1-release" "$root/rollback-1"
ln -s "$root/rollback-release" "$root/rollback-2"
cat > "$bin/systemctl" <<EOF
#!/usr/bin/env bash
if [[ "\$1" == show ]]; then echo "$root/current-release"; elif [[ "\$1" == is-active ]]; then exit 0; fi
EOF
cat > "$bin/curl" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$bin/systemctl" "$bin/curl"
THOIDAI_SYSTEMCTL_BIN="$bin/systemctl" THOIDAI_CURL_BIN="$bin/curl" THOIDAI_SERVICE=svc bash scripts/production/mark-release-success.sh "$root/current-release"
grep -F 'health_status=pass' "$root/current-release/.deploy-success"
grep -F 'deploy_status=success' "$root/current-release/.deploy-success"
out=$(THOIDAI_RELEASE_ROOT="$root" THOIDAI_SYSTEMCTL_BIN="$bin/systemctl" THOIDAI_CURL_BIN="$bin/curl" THOIDAI_SERVICE=svc bash scripts/production/release-retention.sh --dry-run)
grep -F "$root/current-release" <<<"$out" | grep -F current
grep -F "$root/superseded-release" <<<"$out" | grep -F superseded-managed
grep -F "$root/legacy-release" <<<"$out" | grep -F legacy-unmanaged
! grep -F "$root/legacy-release" <<<"$out" | grep -F DELETE
echo "managed-retention: PASS"
