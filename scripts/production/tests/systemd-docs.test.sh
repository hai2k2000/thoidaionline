#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
unit="$ROOT/deploy/systemd/thoidai-work-current.service"
doc="$ROOT/docs/operations/release-lifecycle.md"
[ -f "$unit" ]
[ -f "$doc" ]
grep -q 'WorkingDirectory=/opt/releases/thoidai-work/current' "$unit"
grep -q '/opt/releases/thoidai-work/current/.next/cache' "$unit"
grep -q 'Environment=TASK_RBAC_V2_ENABLED=true' "$unit"
grep -q 'Environment=ROLE_LIFECYCLE_ENABLED=true' "$unit"
grep -q 'Environment=TBT_DIRECT_EVALUATION_ENABLED=true' "$unit"
! grep -Eq '20[0-9]{2}[0-9]{4}T|[0-9a-f]{12,}-j[0-9]' "$unit"
grep -q '15 accumulated drop-ins' "$doc"
grep -q 'not part of the implementation checkpoint' "$doc"
echo "PASS systemd-docs"
