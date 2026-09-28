#!/usr/bin/env bash
set -Eeuo pipefail
source_dir=${1:?usage: $0 <build-worktree> <staged-release>}
staged=${2:?staged release required}
[[ -d "$source_dir/.next/standalone" && -f "$source_dir/.next/BUILD_ID" ]] || { echo 'ERROR: standalone output missing' >&2; exit 1; }
rm -rf -- "$staged"; mkdir -p "$staged/.next"
cp -a "$source_dir/.next/standalone/." "$staged/"
cp -a "$source_dir/.next/static" "$staged/.next/static"
[[ ! -d "$source_dir/public" ]] || cp -a "$source_dir/public" "$staged/public"
cp -a "$source_dir/.next/BUILD_ID" "$staged/.next/BUILD_ID"
cat > "$staged/package.json" <<'EOF'
{"private":true,"scripts":{"start":"node server.js"}}
EOF
rm -rf -- "$staged/.git" "$staged/.next/cache" "$staged/node_modules/.cache" "$staged/node_modules/.pnpm-store"
printf 'RUNTIME_PACKAGE\tpath=%s\tbuild_id=%s\n' "$staged" "$(cat "$source_dir/.next/BUILD_ID")"