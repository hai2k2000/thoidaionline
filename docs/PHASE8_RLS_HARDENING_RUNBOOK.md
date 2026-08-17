# Phase 8 RLS hardening runbook

Phase 8 cuts browser roles off from task, staff, authorization and performance tables. Browser mutations must use same-origin server routes; database RPC execution is reserved for `service_role`.

## Pre-deploy

1. Capture root-only database, active `.next`, source HEAD/tree, dirty status, environment and service/timer backups.
2. Confirm the active build no longer imports the anonymous Supabase client in Task Center, task detail, assignment or evaluation bundles.
3. Apply the migration twice to an ACL-preserving disposable clone and run `phase8_rls_hardening.sql`.

## Deploy and verify

Apply schema, invariants and migration history in one transaction. Build with the real environment, restart only `thoidai-work`, then verify unauthenticated, employee, manager, TBT and Admin HTTP behavior. Confirm browser requests do not target `/rest/v1/tasks`, staff or performance tables.

## Rollback

The schema change is additive and does not change `session_epoch` or `staff_users.session_version`. The Phase 7 server-only task/evaluation build can be restored from the root-only source and active-build backup without restoring anonymous table grants. Restart only `thoidai-work` and repeat API/session smoke tests.

Do not re-enable public policies as an application rollback shortcut. If an explicitly approved emergency requires ACL rollback, restore only the ACL/policy inventory from the pre-change database backup in a transaction, validate every grant, and never restore user data over newer production data.

Legacy percent progress and 1–10 evaluation checkpoints remain readable evidence. Their write RPCs return `feature_not_supported`; no conversion to the 100-point rubric is performed.
