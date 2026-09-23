#!/usr/bin/env bash
set -Eeuo pipefail

source_root=${1:?usage: $0 <source-root> <artifact-dir>}
artifact_dir=${2:?usage: $0 <source-root> <artifact-dir>}
[[ -d "$source_root" && "$source_root" = /* ]] || { echo "source root must be an absolute directory" >&2; exit 2; }
[[ "$artifact_dir" = /* ]] || { echo "artifact dir must be an absolute path" >&2; exit 2; }
[[ ! -e "$artifact_dir" && ! -L "$artifact_dir" ]] || { echo "artifact dir already exists" >&2; exit 1; }

cd "$source_root"
npm ci --no-audit --no-fund
npm run build
STANDALONE_ARTIFACT_DIR="$artifact_dir" npm run package:standalone
test -f "$artifact_dir/.next/BUILD_ID"
test -f "$artifact_dir/RELEASE_BASELINE_COMMIT"
test -f "$artifact_dir/required-route-manifest.json"
echo "standalone-release: PASS ($artifact_dir)"
