# Checkpoint 2: Atomic Batch RPC

Work only in `/opt/worktrees/task-assignment-batch` on branch
`feat/task-assignment-batch`, starting at commit
`4bc62e6f3c5ba85802e1436ba068c4a7ab8762c3`. Read the approved spec and the
Checkpoint 2 section in the implementation plan before editing.

Implement the full `public.api_assign_task_batch_v1` in a new additive
migration (prefer `supabase/migrations/20260925111000_task_assignment_batch_rpc.sql`)
and add focused tests in `src/lib/taskAssignmentBatchRpc.test.mjs`.

Required behavior:

- Signature remains `api_assign_task_batch_v1(uuid, uuid, uuid, uuid, jsonb) returns jsonb`.
- Accept 1..20 task objects; reject 0, >20, malformed objects, missing required DB fields, invalid batch state, and forged scope.
- Reuse/call existing `api_assign_task_v2` for every normalized task inside one PostgreSQL transaction; do not copy its authorization, participants, recurrence, audit, status, notification, or assignment-source rules.
- Preserve actor/department/assignee authorization exactly; no new permissions.
- Compute/compare a canonical request hash over shared batch fields and ordered task payloads.
- Use actor+batch advisory transaction lock and the idempotency table from Checkpoint 1.
- Same actor+batch+same hash returns original ordered task IDs with replay=true and creates no rows/events.
- Same actor+batch+different hash raises explicit conflict.
- Any task failure rolls back all task rows, side effects, and idempotency state; failed calls are retryable.
- Store and return task IDs in input order, never insertion order.
- Preserve exact single `api_assign_task_v2` behavior.
- Migration must be additive/idempotent, service-role-only, no production DB changes.

TDD first: add tests, run RED, implement, then GREEN. Tests must cover 1,
20, 21 rejected, task 2/20 invalid rollback, authorization rollback, same
hash replay, different hash conflict, simulated mid-loop failure rollback,
ordered results, exactly-once audit/status behavior, and single-RPC unchanged.
Use static SQL contracts if no disposable local DB is configured; do not use
production DB.

After implementation run focused tests and related assignment/approval
regressions. Perform explicit spec and quality review: atomicity, internal RPC
reuse, idempotency/concurrency, order, authorization, max-20, and migration
safety.

Write report to:
`/opt/worktrees/task-assignment-batch/.superpowers/sdd/2026-09-25-recipient-first-multi-task-assignment-plan/task-2-report.md`
with status, commit, tests, invariants, DB impact, and concerns. Do not spawn
subagents or deploy.
