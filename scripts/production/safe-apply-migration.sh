#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
exec node "$script_dir/safe-apply-migration.mjs" "$@"
