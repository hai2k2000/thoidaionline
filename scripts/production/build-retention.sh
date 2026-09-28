#!/usr/bin/env bash
set -Eeuo pipefail
: "${THOIDAI_BUILD_ROOT:=/opt/build/thoidai-work}"
: "${THOIDAI_BUILD_RETENTION_DAYS:=14}"
mode=dry-run
case "${1:-}" in '') ;; --dry-run) ;; --apply) mode=apply ;; *) echo "usage: $0 [--dry-run|--apply]" >&2; exit 2;; esac
now=$(date +%s)
if [[ ! -d "$THOIDAI_BUILD_ROOT" ]]; then printf 'build\tUNKNOWN\t0\t%s\tmissing-root\n' "$THOIDAI_BUILD_ROOT"; exit 0; fi
while IFS= read -r -d '' path; do
  base=$(basename "$path"); bytes=$(du -sx --bytes -- "$path" 2>/dev/null | awk 'NR==1{print $1}') || { printf 'build\tREVIEW\t0\t%s\tsize-inspection-failed\n' "$path"; continue; }
  mtime=$(stat -c %Y -- "$path" 2>/dev/null || echo 0)
  if [[ ! "$mtime" =~ ^[0-9]+$ || "$mtime" == 0 ]]; then printf 'build\tREVIEW\t%s\t%s\tmtime-inspection-failed\n' "$bytes" "$path"; continue; fi
  age=$(( (now-mtime)/86400 ))
  if [[ "$base" == .keep || "$base" == current || "$base" == active || "$base" == build-evidence ]]; then printf 'build\tKEEP\t%s\t%s\tprotected-name\n' "$bytes" "$path"
  elif (( age > THOIDAI_BUILD_RETENTION_DAYS )); then printf 'build\tCANDIDATE\t%s\t%s\t%s\n' "$bytes" "$path" "older-than-${THOIDAI_BUILD_RETENTION_DAYS}d"
  else printf 'build\tKEEP\t%s\t%s\twithin-retention\n' "$bytes" "$path"; fi
done < <(find "$THOIDAI_BUILD_ROOT" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
if [[ "$mode" == apply ]]; then echo 'ERROR: build retention apply is disabled until owner approves a cleanup batch' >&2; exit 2; fi