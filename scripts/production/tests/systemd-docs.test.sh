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
grep -q '^MemoryHigh=500M$' "$unit"
grep -q '^MemoryMax=650M$' "$unit"
grep -q '^TasksMax=250$' "$unit"
grep -q '^NoNewPrivileges=true$' "$unit"
grep -q '^PrivateTmp=true$' "$unit"
grep -q '^ProtectSystem=strict$' "$unit"
grep -q '^ProtectHome=true$' "$unit"
grep -q '^CapabilityBoundingSet=$' "$unit"
grep -q '^AmbientCapabilities=$' "$unit"
grep -q '^RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6$' "$unit"
for hardening in \
  ProtectKernelTunables=true ProtectKernelModules=true ProtectKernelLogs=true \
  ProtectControlGroups=true ProtectClock=true ProtectHostname=true \
  LockPersonality=true RestrictSUIDSGID=true RestrictRealtime=true \
  RestrictNamespaces=true SystemCallArchitectures=native; do
  grep -q "^$hardening$" "$unit"
done
! grep -Eq '20[0-9]{2}[0-9]{4}T|[0-9a-f]{12,}-j[0-9]' "$unit"
grep -q '16 accumulated drop-ins' "$doc"
grep -q 'DropInPaths' "$doc"
grep -q 'current -> 4e22ee6314ffd3e26ab94b0dbf74be14a4075c9d-online-work-month-end-20260921T031920Z' "$doc"
grep -q 'previous -> e88d16942a78f416f2e6de27cad5cb94c3146d94-j6-gate12-error-mapping-20260921T014731Z' "$doc"
grep -q 'rollback-2 -> d66f69898e63cde8ae4d9f1eff7adbc4c8028da2-j6-task-detail-hotfix-envlinks-20260920T183314Z' "$doc"
for dropin in \
  10-memory-guard.conf 100-j6-release.conf 20-role-lifecycle.conf \
  30-checkpoint4-1-release.conf 40-checkpoint-permission-ui-release.conf \
  50-org-rbac-r3-retry-release.conf 60-j2p-envretry-release.conf \
  70-j3c-release.conf 80-j4c-release.conf 90-j5f-release.conf \
  zz-j6-release.conf zzz-j6-auth-recovery-j5f.conf \
  zzzz-j6-auth-recovery-corrected.conf zzzzz-j6-task-detail-hotfix-final.conf \
  zzzzzz-j6-gate12-error-mapping.conf zzzzzzz-online-work-month-end.conf; do
  grep -q "$dropin" "$doc"
done
grep -q 'capture-systemd-baseline.sh' "$doc"
grep -q 'validate-bootstrap.sh' "$doc"
grep -q 'dropin-paths.txt' "$doc"
grep -q 'not part of the implementation checkpoint' "$doc"
echo "PASS systemd-docs"
