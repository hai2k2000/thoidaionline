#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(uname -s)" != Linux ]]; then
  echo "deploy-staging-safety: SKIP (CI runs on Linux)"
  exit 0
fi

root=$(mktemp -d)
trap 'rm -rf -- "$root"' EXIT
release_root="$root/releases"
shared="$root/shared"
bin="$root/bin"
mkdir -p "$release_root" "$shared" "$bin" "$root/staging-outside" \
  "$release_root/staging-inside" "$root/artifact/.next/server" "$root/artifact/node_modules/next"
chmod 755 "$root" "$release_root" "$shared" "$root/staging-outside" "$release_root/staging-inside" "$root/artifact"
touch "$shared/.env.local" "$shared/.env.production" "$root/artifact/server.js" \
  "$root/artifact/.next/BUILD_ID" "$root/artifact/node_modules/next/package.json"
printf 'commit=500ca5324d04b10e584dcda5f80b660ea5d68d81\nartifact_source_commit=500ca5324d04b10e584dcda5f80b660ea5d68d81\nbuild_config=canonical-public\nenv_model=runtime-injected\nrisk_class=high\nrisk_test_evidence=automated-tests-pass\n' > "$root/artifact/.release-meta"
cat > "$root/artifact/verify-standalone-artifact.mjs" <<'EOF'
process.exit(0);
EOF

cat > "$bin/node" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == -e ]]; then exit 0; fi
exit 0
EOF
cat > "$bin/systemctl" <<'EOF'
#!/usr/bin/env bash
case "${1:-}" in restart|is-active|show) exit 0 ;; *) exit 0 ;; esac
EOF
cat > "$bin/curl" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$bin/nginx-guard" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$bin/rbac-gate" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$bin/chown" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$bin/runuser" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$bin/install" <<'EOF'
#!/usr/bin/env bash
target=${@: -1}
mkdir -p "$target"
chmod 750 "$target"
EOF
for name in node systemctl curl nginx-guard rbac-gate chown runuser install; do chmod +x "$bin/$name"; done

make_release() { mkdir -p "$release_root/$1"; }
for release in current-release previous-release rollback1-release rollback2-release; do make_release "$release"; done
ln -s "$release_root/current-release" "$release_root/current"
ln -s "$release_root/previous-release" "$release_root/previous"
ln -s "$release_root/rollback1-release" "$release_root/rollback-1"
ln -s "$release_root/rollback2-release" "$release_root/rollback-2"

verify_only() {
  local artifact=$1 expected=$2
  PATH="$bin:$PATH" THOIDAI_RELEASE_ROOT="$release_root" THOIDAI_SHARED_ROOT="$shared" \
    bash scripts/production/deploy-external-artifact.sh "$artifact" "$expected" --verify-only
}

expected_commit=500ca5324d04b10e584dcda5f80b660ea5d68d81
verify_only "$root/staging-outside" "$expected_commit" 2>/dev/null || true
cp -a "$root/artifact/." "$root/staging-outside/"
verify_only "$root/staging-outside" "$expected_commit" >/dev/null

cp -a "$root/artifact/." "$release_root/staging-inside/"
if verify_only "$release_root/staging-inside" "$expected_commit" >"$root/inside.out" 2>&1; then exit 1; fi
grep -q 'inside release root' "$root/inside.out"
if verify_only "$release_root" "$expected_commit" >"$root/root.out" 2>&1; then exit 1; fi
grep -q 'inside release root' "$root/root.out"
ln -s "$release_root" "$root/release-link"
if verify_only "$root/release-link" "$expected_commit" >"$root/link.out" 2>&1; then exit 1; fi
grep -q 'regular directory' "$root/link.out"
ln -s "$release_root/current-release" "$root/active-link"
if verify_only "$root/active-link" "$expected_commit" >"$root/active.out" 2>&1; then exit 1; fi
grep -q 'regular directory' "$root/active.out"

# A successful activation cleans only invocation-owned staging outside releases.
rm -rf "$root/staging-outside"
mkdir "$root/staging-outside"
cp -a "$root/artifact/." "$root/staging-outside/"
PATH="$bin:$PATH" THOIDAI_RELEASE_ROOT="$release_root" THOIDAI_SHARED_ROOT="$shared" \
  THOIDAI_EXTERNAL_DEPLOY_APPROVED=1 \
  THOIDAI_DEPLOY_LOCK="$root/deploy.lock" THOIDAI_NODE_BIN="$bin/node" THOIDAI_SYSTEMCTL_BIN="$bin/systemctl" \
  THOIDAI_CURL_BIN="$bin/curl" THOIDAI_NGINX_GUARD_SCRIPT="$bin/nginx-guard" \
  THOIDAI_RBAC_ROLLBACK_GATE="$bin/rbac-gate" THOIDAI_INSTALL_BIN="$bin/install" THOIDAI_NEW_RELEASE_PATH="$release_root/new-release" \
  bash scripts/production/deploy-external-artifact.sh "$root/staging-outside" "$expected_commit" --activate >/dev/null
[[ ! -e "$root/staging-outside" ]]
[[ -d "$release_root/new-release" ]]
[[ "$(readlink -f "$release_root/current")" == "$(readlink -f "$release_root/new-release")" ]]
[[ -e "$release_root/new-release/server.js" ]]

echo "deploy-staging-safety: PASS (outside/inside/root/symlink/protected staging, owned cleanup and release preservation)"
