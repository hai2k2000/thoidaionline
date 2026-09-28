#!/usr/bin/env bash
set -Eeuo pipefail
: "${THOIDAI_MAX_ARTIFACT_GIB:=4}"
: "${THOIDAI_ARTIFACT_SIZE_BIN:=du}"
path=${1:?usage: $0 <artifact-path>}
[[ -d "$path" ]] || { echo "ERROR: artifact path is not a directory: $path" >&2; exit 2; }
bytes=$($THOIDAI_ARTIFACT_SIZE_BIN -sx --bytes -- "$path" 2>/dev/null | awk 'NR==1 {print $1}') || { echo "ERROR: artifact size inspection failed: $path" >&2; exit 1; }
[[ "$bytes" =~ ^[0-9]+$ ]] || { echo "ERROR: artifact size is ambiguous: $path" >&2; exit 1; }
limit=$(awk -v gib="$THOIDAI_MAX_ARTIFACT_GIB" 'BEGIN { if (gib !~ /^[0-9]+([.][0-9]+)?$/) exit 1; printf "%.0f\n", gib*1024*1024*1024 }') || { echo "ERROR: invalid THOIDAI_MAX_ARTIFACT_GIB" >&2; exit 2; }
printf 'ARTIFACT_SIZE\tpath=%s\tbytes=%s\tlimit_bytes=%s\n' "$path" "$bytes" "$limit"
(( bytes <= limit )) || { echo "ERROR: artifact exceeds configured limit" >&2; exit 1; }