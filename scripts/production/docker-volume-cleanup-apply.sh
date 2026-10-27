#!/usr/bin/env bash
# Allowlist-only removal of anonymous dangling Docker volumes.
# VERIFY by default; --apply needs THOIDAI_VOLUME_CLEANUP_APPROVED=APPROVE-DOCKER-VOLUME-CLEANUP-2026-10-27.
# Allowlist (one 64-hex volume name per line) comes from env ALLOWLIST_B64.
set -u -o pipefail
main() {
  local mode=VERIFY ok=0 skip=0 del=0 fail=0 bytes=0 ev= v mp labels sz
  [[ ${1:-} == --apply && ${THOIDAI_VOLUME_CLEANUP_APPROVED:-} == APPROVE-DOCKER-VOLUME-CLEANUP-2026-10-27 ]] && mode=APPLY
  local list; list=$(printf '%s' "${ALLOWLIST_B64:-}" | base64 -d | tr -d '\r') || { echo 'FAILED allowlist'; return 1; }
  [[ -n $list ]] || { echo 'FAILED empty-allowlist'; return 1; }
  local dangling; dangling=$(docker volume ls -qf dangling=true)
  if [[ $mode == APPLY ]]; then
    ev=/opt/ops/thoidai-work/cleanup-evidence/docker-volumes-2026-10-27-$(date -u +%Y%m%dT%H%M%SZ)
    mkdir -p "$ev" && printf '%s\n' "$list" > "$ev/allowlist.txt" && df -h / > "$ev/df-before.txt" || { echo 'FAILED evidence'; return 1; }
  fi
  while IFS= read -r v; do
    [[ -n $v ]] || continue
    if [[ ! $v =~ ^[0-9a-f]{64}$ ]]; then echo "SKIP not-hex64 $v"; ((skip+=1)); continue; fi
    if ! grep -qxF -- "$v" <<<"$dangling"; then echo "SKIP not-dangling $v"; ((skip+=1)); continue; fi
    if [[ -n $(docker ps -aq --filter "volume=$v") ]]; then echo "SKIP referenced $v"; ((skip+=1)); continue; fi
    labels=$(docker volume inspect --format '{{json .Labels}}' "$v" 2>/dev/null)
    if [[ $labels != '{"com.docker.volume.anonymous":""}' ]]; then echo "SKIP labels $v"; ((skip+=1)); continue; fi
    mp=$(docker volume inspect --format '{{.Mountpoint}}' "$v")
    sz=$(du -sb -- "$mp" 2>/dev/null | awk '{print $1}'); sz=${sz:-0}
    if [[ $mode != APPLY ]]; then echo "WOULD-DELETE $v $sz"; ((ok+=1)); bytes=$((bytes+sz)); continue; fi
    printf '%s\t%s\t%s\t%s\t%s\n' "$v" "$sz" "$(docker volume inspect --format '{{.CreatedAt}}' "$v")" "$(cat "$mp/PG_VERSION" 2>/dev/null)" "$labels" >> "$ev/before.tsv"
    if docker volume rm -- "$v" >/dev/null 2>&1; then echo "DELETED $v $sz"; ((del+=1)); bytes=$((bytes+sz)); printf 'DELETED\t%s\n' "$v" >> "$ev/results.tsv"
    else echo "FAILED $v"; ((fail+=1)); printf 'FAILED\t%s\n' "$v" >> "$ev/results.tsv"; fi
  done <<<"$list"
  [[ $mode == APPLY ]] && df -h / > "$ev/df-after.txt"
  echo "SUMMARY mode=$mode would=$ok deleted=$del skipped=$skip failed=$fail bytes=$bytes evidence=${ev:-none}"
}
main "$@" </dev/null
