#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/release-common.sh"

[[ $# -eq 3 ]] || { echo "usage: $0 <current> <previous> <rollback-2>" >&2; exit 2; }
validate_bootstrap_mapping "$@"
log_event "BOOTSTRAP_VALIDATION_PASS current=$1 previous=$2 rollback-2=$3"
