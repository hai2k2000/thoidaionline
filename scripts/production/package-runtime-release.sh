#!/usr/bin/env bash
set -Eeuo pipefail
source_dir=${1:?}; staged=${2:?}
[[ -d "$source_dir/.next/standalone" && -f "$source_dir/.next/BUILD_ID" ]] || { echo 'ERROR: standalone output missing' >&2; exit 1; }
if [[ -f "$source_dir/scripts/check-required-routes.mjs" ]]; then
  (cd "$source_dir" && /usr/bin/node scripts/check-required-routes.mjs)
fi
rm -rf -- "$staged"; mkdir -p "$staged/.next" "$staged/.next/static" "$staged/.next/cache"
cp -a "$source_dir/.next/standalone/." "$staged/"
[[ ! -d "$source_dir/.next/static" ]] || cp -a "$source_dir/.next/static/." "$staged/.next/static/"
[[ ! -d "$source_dir/public" ]] || cp -a "$source_dir/public" "$staged/public"
cp -a "$source_dir/.next/BUILD_ID" "$staged/.next/BUILD_ID"
printf '{"private":true,"scripts":{"start":"node server.js"}}\n' > "$staged/package.json"
rm -f -- "$staged/scripts/check-required-routes.mjs"
rm -rf -- "$staged/.git" "$staged/node_modules/.cache" "$staged/node_modules/.pnpm-store"
printf 'RUNTIME_PACKAGE\tpath=%s\tbuild_id=%s\n' "$staged" "$(cat "$source_dir/.next/BUILD_ID")"