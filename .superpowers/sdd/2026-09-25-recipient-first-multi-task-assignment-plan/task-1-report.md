Status: DONE
Commit: 4bc62e6f3c5ba85802e1436ba068c4a7ab8762c3
Tests: node --test src/lib/taskAssignmentBatchDbContract.test.mjs (4/4); related baseline tests (17/17 combined) pass; git diff --check pass.
Invariant checks: actor-scoped primary key; request_hash and ordered task_ids stored; 1..20 contract check; no existing task mutation; service_role-only RPC execution; additive/idempotent DDL.
DB impact: migration file only; not applied to any database.
Concerns: RPC body intentionally remains feature_not_ready until Checkpoint 2; .superpowers is scratch ledger only.
