#!/usr/bin/env bash
set -Eeuo pipefail
: "${THOIDAI_DOCKER_BIN:=docker}"
: "${THOIDAI_DB_VOLUME:=supabase_db_thoidai-work}"
mode=dry-run
case "${1:-}" in '') ;; --dry-run) ;; --apply) echo 'ERROR: volume deletion is disabled; owner approval required' >&2; exit 2 ;; *) echo "usage: $0 [--dry-run]" >&2; exit 2;; esac
emit(){ printf 'docker-%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5"; }
command -v "$THOIDAI_DOCKER_BIN" >/dev/null 2>&1 || { emit image UNKNOWN 0 docker docker-unavailable; emit volume UNKNOWN 0 docker docker-unavailable; exit 0; }
containers=$($THOIDAI_DOCKER_BIN ps -aq 2>/dev/null || { emit image UNKNOWN 0 docker-container-list-failed; emit volume UNKNOWN 0 docker-container-list-failed; exit 0; })
used_images=''
if [[ -n "$containers" ]]; then used_images=$($THOIDAI_DOCKER_BIN inspect $containers --format '{{.Image}}' 2>/dev/null || true); fi
if images=$($THOIDAI_DOCKER_BIN image ls --format '{{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}' 2>/dev/null); then
  while IFS=$'\t' read -r ref id size; do [[ -z "$ref" ]] && continue; if [[ "$ref" == *supabase* || "$ref" == *thoidai* || "$ref" == *recovery* ]] || grep -F "$id" <<<"$used_images" >/dev/null; then emit image KEEP 0 "$ref" running-or-container-referenced; else emit image CANDIDATE 0 "$ref" "dangling-review size=$size"; fi; done <<<"$images"
else emit image UNKNOWN 0 docker image-list-failed; fi
if volumes=$($THOIDAI_DOCKER_BIN volume ls --format '{{.Name}}' 2>/dev/null); then
  while IFS= read -r name; do [[ -z "$name" ]] && continue
    if [[ "$name" == "$THOIDAI_DB_VOLUME" ]]; then emit volume KEEP 0 "$name" production-db-protected
    elif [[ "$name" == *supabase* || "$name" == *recovery* ]]; then emit volume KEEP 0 "$name" protected-pattern
    else emit volume UNKNOWN 0 "$name" unknown-volume-owner-approval-required; fi
  done <<<"$volumes"
else emit volume UNKNOWN 0 docker volume-list-failed; fi