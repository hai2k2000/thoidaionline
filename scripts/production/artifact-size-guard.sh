#!/usr/bin/env bash
set -Eeuo pipefail
: "${THOIDAI_ARTIFACT_WARN_BYTES:=536870912}"
: "${THOIDAI_ARTIFACT_HARD_MAX_BYTES:=805306368}"
if [[ -n "${THOIDAI_MAX_ARTIFACT_GIB:-}" ]]; then THOIDAI_ARTIFACT_HARD_MAX_BYTES=$(awk -v g="$THOIDAI_MAX_ARTIFACT_GIB" 'BEGIN {printf "%.0f", g*1024*1024*1024}'); fi
path=${1:?usage: $0 <artifact-path>}
[[ -d "$path" ]] || { echo "ERROR: artifact path is not a directory: $path" >&2; exit 2; }
bytes=$(du -sx --bytes -- "$path" 2>/dev/null | awk 'NR==1{print $1}') || { echo "ERROR: artifact size inspection failed: $path" >&2; exit 1; }
[[ "$bytes" =~ ^[0-9]+$ ]] || { echo "ERROR: artifact size ambiguous: $path" >&2; exit 1; }
classification=EXPECTED; (( bytes > THOIDAI_ARTIFACT_WARN_BYTES )) && classification=SUSPICIOUS
if (( bytes > THOIDAI_ARTIFACT_HARD_MAX_BYTES )); then classification=BLOCKED_OVERSIZE; printf 'ARTIFACT_SIZE\tclassification=%s\tpath=%s\tbytes=%s\thard_max=%s\nlargest:\n' "$classification" "$path" "$bytes" "$THOIDAI_ARTIFACT_HARD_MAX_BYTES"; du -x -d 2 --bytes -- "$path" 2>/dev/null | sort -nr | head -10 >&2; exit 1; fi
printf 'ARTIFACT_SIZE\tclassification=%s\tpath=%s\tbytes=%s\twarn=%s\thard_max=%s\n' "$classification" "$path" "$bytes" "$THOIDAI_ARTIFACT_WARN_BYTES" "$THOIDAI_ARTIFACT_HARD_MAX_BYTES"