#!/usr/bin/env bash
set -Eeuo pipefail
root=$(mktemp -d); bin=$(mktemp -d); refs=$(mktemp -d); proc=$(mktemp -d); config=$(mktemp -d)
trap 'rm -rf -- "$root" "$bin" "$refs" "$proc" "$config"' EXIT
for name in current-release previous-release rollback1-release rollback2-release latest-a latest-b delete-release referenced-release kept-release unknown-dir build-evidence ops-backups; do mkdir -p "$root/$name"; done
write_meta(){ cat > "$1/.release-meta" <<EOF
commit=0123456789abcdef0123456789abcdef01234567
created_at=$2
EOF
}
write_meta "$root/current-release" 2026-10-20T00:00:00Z
write_meta "$root/previous-release" 2026-10-19T00:00:00Z
write_meta "$root/rollback1-release" 2026-10-18T00:00:00Z
write_meta "$root/rollback2-release" 2026-10-17T00:00:00Z
write_meta "$root/latest-a" 2026-10-16T00:00:00Z
write_meta "$root/latest-b" 2026-10-15T00:00:00Z
write_meta "$root/referenced-release" 2026-10-14T00:00:00Z
write_meta "$root/kept-release" 2026-10-13T00:00:00Z
write_meta "$root/delete-release" 2026-10-12T00:00:00Z
touch "$root/kept-release/.keep"
ln -s "$root/current-release" "$root/current"
ln -s "$root/previous-release" "$root/previous"
ln -s "$root/rollback1-release" "$root/rollback-1"
ln -s "$root/rollback2-release" "$root/rollback-2"
ln -s "$root/referenced-release" "$refs/release-link"
printf '%s\n' "$root/referenced-release" > "$config/reference.conf"
cat > "$bin/systemctl" <<EOF
#!/usr/bin/env bash
[[ "\$1" == show ]] && echo "$root/current-release"
exit 0
EOF
printf '#!/usr/bin/env bash\nexit 0\n' > "$bin/curl"
chmod +x "$bin/systemctl" "$bin/curl"
env_common=(THOIDAI_RELEASE_ROOT="$root" THOIDAI_SYSTEMCTL_BIN="$bin/systemctl" THOIDAI_CURL_BIN="$bin/curl" THOIDAI_SERVICE=svc THOIDAI_RETENTION_KEEP_LATEST=2 THOIDAI_RETENTION_EVIDENCE_ROOT="$root/build-evidence/retention" THOIDAI_RETENTION_REFERENCE_ROOTS="$refs" THOIDAI_RETENTION_CONFIG_ROOTS="$config" THOIDAI_RETENTION_PROC_ROOT="$proc")
out=$(env "${env_common[@]}" bash scripts/production/release-retention.sh --dry-run)
printf '%s\n' "$out"
grep -F "$root/current-release" <<<"$out" | grep -E '(active-systemd|current)'
grep -F $'KEEP\t'"$root/latest-a"$'\tlatest-reserve' <<<"$out"
grep -F $'KEEP\t'"$root/latest-b"$'\tlatest-reserve' <<<"$out"
grep -F $'KEEP\t'"$root/kept-release"$'\tprotected-.keep' <<<"$out"
grep -F "$root/referenced-release" <<<"$out" | grep -E '(symlink-reference|configuration-reference)'
grep -F $'KEEP\t'"$root/unknown-dir"$'\tunknown-nonrelease' <<<"$out"
grep -F $'KEEP\t'"$root/build-evidence"$'\tprotected-nonrelease' <<<"$out"
grep -F $'KEEP\t'"$root/ops-backups"$'\tprotected-nonrelease' <<<"$out"
grep -F $'DELETE\t'"$root/delete-release"$'\tsuperseded-release' <<<"$out"
env "${env_common[@]}" THOIDAI_RETENTION_APPROVED=1 bash scripts/production/release-retention.sh --apply >/dev/null
[[ ! -e "$root/delete-release" ]]
for kept in current-release previous-release rollback1-release rollback2-release latest-a latest-b referenced-release kept-release unknown-dir build-evidence ops-backups; do [[ -e "$root/$kept" ]]; done
find "$root/build-evidence/retention" -type f -name '*.tsv' | grep -q .
echo 'managed-retention: PASS'