#!/usr/bin/env bash
main(){
  set -u -o pipefail
  local now=${ANALYSIS_NOW:-$(date -u +%F)}
  local volume_root=${ANALYSIS_VOLUME_ROOT:-}
  local ps_data name created mount labels age days bytes human kind reason verdict
  declare -A attached=() vcount=() vbytes=() dcount=() dbytes=()

  while IFS=$'\t' read -r name status mounts; do
    [ -n "$name" ] || continue
    for mount_ref in ${mounts//,/ }; do attached["$mount_ref"]="$name"; done
  done < <(docker ps -a --format '{{.Names}}\t{{.Status}}\t{{.Mounts}}')
  printf 'VERDICT\tNAME\tCREATED\tAGE_DAYS\tBYTES\tHUMAN\tKIND\tLABELS\tREASON\n'

  echo 'CONTAINERS'
  while IFS=$'\t' read -r name status mounts; do
    [ -n "$name" ] && printf '%s\t%s\n' "$name" "$status"
  done < <(docker ps -a --format '{{.Names}}\t{{.Status}}\t{{.Mounts}}')

  while IFS= read -r name; do
    [ -n "$name" ] || continue
    IFS=$'\t' read -r _ created mount labels < <(docker volume inspect --format '{{.Name}}\t{{.CreatedAt}}\t{{.Mountpoint}}\t{{json .Labels}}' "$name")
    [ -n "$volume_root" ] && mount="$volume_root/$name"
    bytes=$(timeout 120 du -sb -- "$mount" 2>/dev/null | awk 'NR==1{print $1}')
    bytes=${bytes:-0}; human=$(numfmt --to=iec --suffix=B "$bytes" 2>/dev/null || printf '%sB' "$bytes")
    age=$(date -u -d "$created" +%s 2>/dev/null || date -u +%s)
    days=$(( ($(date -u -d "$now" +%s) - age) / 86400 )); [ "$days" -lt 0 ] && days=0
    labels=$(printf '%s' "$labels" | tr '\t\r\n' '   ')
    kind=unknown; reason='unknown'; last_date=''; last_age=''; pg=''; pid=0; db_count=0
    newest=$(find "$mount" -type f -printf '%T@\n' 2>/dev/null | sort -nr | head -n 1)
    if [ -n "$newest" ]; then
      last_date=$(date -u -d "@${newest%.*}" +%F 2>/dev/null || true)
      [ -n "$last_date" ] && last_age=$(( ($(date -u -d "$now" +%s) - $(date -u -d "$last_date" +%s)) / 86400 ))
    fi
    if [ -f "$mount/PG_VERSION" ]; then
      kind=postgres-data; pg=$(head -n 1 "$mount/PG_VERSION" | tr -d '\r\n'); [ -f "$mount/postmaster.pid" ] && pid=1
      [ -d "$mount/base" ] && db_count=$(find "$mount/base" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | awk 'END{print NR+0}')
    elif [ -d "$mount/stub" ] || [ -d "$mount/storage" ]; then kind=supabase-storage
    elif [ -d "$mount/deno" ] || [ -d "$mount/functions" ] || [ -d "$mount/.deno" ]; then kind=deno-functions-cache
    elif [ -d "$mount/node_modules" ]; then kind=node_modules
    elif [ "$bytes" -le 4096 ]; then kind=empty
    fi
    attached_name=${attached[$name]:-}
    if [ -z "$attached_name" ]; then
      for mount_ref in "${!attached[@]}"; do
        if [[ "$mount_ref" == *"$name"* ]]; then attached_name=${attached[$mount_ref]}; break; fi
      done
    fi
    if [ -n "$attached_name" ]; then verdict=KEEP; reason="attached-to-$attached_name"
    elif [[ "$labels" == *'com.docker.compose.project'*'thoidai-work'* ]] && [[ ! "$labels" =~ (test|disposable|drill|rehearsal|tmp) ]]; then verdict=KEEP; reason=production-label
    elif [[ "$labels" == *'com.docker.compose.project'* ]] && [[ "$labels" != *'thoidai-work'* ]]; then verdict=KEEP; reason=other-project
    elif [ "$pid" -eq 1 ] && [ -n "$last_age" ] && [ "$last_age" -lt 2 ]; then verdict=KEEP; reason=maybe-live
    elif [ -n "$last_age" ] && [ "$last_age" -le 7 ]; then verdict=KEEP; reason=recent-write
    elif [[ "$labels" == '{}' || "$labels" == 'null' || -z "$labels" ]] && [[ "$name" =~ ^[0-9a-fA-F]{64}$ ]] && [ -n "$last_age" ] && [ "$last_age" -gt 7 ]; then verdict=CANDIDATE; reason="anonymous,$kind${pg:+ pg$pg},last-write=${last_date:-unknown}"
    else verdict=KEEP; reason=unknown; fi
    [ "$kind" = postgres-data ] && reason="$reason;pg=$pg;postmaster.pid=$pid;db-dirs=$db_count;LAST_WRITE=${last_date:-unknown};last-write-age=${last_age:-unknown}d"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$verdict" "$name" "$created" "$days" "$bytes" "$human" "$kind" "$labels" "$reason"
    vcount["$verdict"]=$(( ${vcount[$verdict]:-0} + 1 )); vbytes["$verdict"]=$(( ${vbytes[$verdict]:-0} + bytes )); vcount["KIND:$kind"]=$(( ${vcount["KIND:$kind"]:-0} + 1 )); vbytes["KIND:$kind"]=$(( ${vbytes["KIND:$kind"]:-0} + bytes )); dcount["${created:0:10}"]=$(( ${dcount["${created:0:10}"]:-0} + 1 )); dbytes["${created:0:10}"]=$(( ${dbytes["${created:0:10}"]:-0} + bytes ))
  done < <(docker volume ls -qf dangling=true)
  echo SUMMARY
  for verdict in KEEP CANDIDATE; do printf 'VERDICT\t%s\t%s\t%s\n' "$verdict" "${vcount[$verdict]:-0}" "${vbytes[$verdict]:-0}"; done
  for kind in postgres-data supabase-storage deno-functions-cache node_modules empty unknown; do printf 'KIND\t%s\t%s\t%s\n' "$kind" "${vcount[KIND:$kind]:-0}" "${vbytes[KIND:$kind]:-0}"; done
  for created in "${!dcount[@]}"; do printf 'CREATED\t%s\t%s\t%s\n' "$created" "${dcount[$created]}" "${dbytes[$created]}"; done | sort
  docker system df -v
}
main "$@" </dev/null
