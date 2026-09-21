#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/release-common.sh"

[[ $# -eq 0 ]] || { echo "usage: $0" >&2; exit 2; }
migration_readiness_check
