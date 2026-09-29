# Checkpoint 1: DB Contract and Migration Skeleton

Work only in the dedicated remote worktree `/opt/worktrees/task-assignment-batch`
on branch `feat/task-assignment-batch`, based at commit `07bc977`. Read the
approved architecture spec at
`docs/superpowers/specs/2026-09-25-recipient-first-multi-task-assignment-design.md`
and the full plan at
`docs/superpowers/plans/2026-09-25-recipient-first-multi-task-assignment-plan.md`
before editing.

Create the additive/idempotent DB contract only. Do not implement the batch
RPC body yet; Checkpoint 2 will replace the deterministic skeleton.

Required files:

- `supabase/migrations/20260925110000_task_assignment_batch_idempotency.sql`
- `src/lib/taskAssignmentBatchDbContract.test.mjs`
- `scripts/schema-contracts.mjs` only if needed to register the named contract

Required database contract:

- table `public.task_assignment_batch_idempotency`
- columns `actor_id uuid`, `batch_id uuid`, `request_hash text`, ordered
  `task_ids uuid[]`, `task_count`, `created_at timestamptz`, nullable
  `completed_at timestamptz`
- actor foreign key and unique `(actor_id, batch_id)`
- task count check 1..20
- created-at index
- exact RPC signature:
  `public.api_assign_task_batch_v1(uuid, uuid, uuid, uuid, jsonb) returns jsonb`
- RPC skeleton may raise deterministic `feature_not_ready`; it must be
  replaceable by Checkpoint 2 without changing the signature
- revoke execute from `public`, `anon`, `authenticated`; grant only to
  `service_role`
- migration must be safe to run repeatedly and must not rewrite existing task
  rows/data

TDD requirements:

1. Add failing tests first for exact columns/types, unique/check constraints,
   idempotent migration clauses, exact RPC signature, and service-role-only
   execution.
2. Run the focused test and confirm the expected RED failure.
3. Implement the smallest migration/skeleton.
4. Run the focused tests GREEN plus existing schema/route checks.

Do not run `supabase db reset`, broad `supabase db push`, migration ledger
repair, production SQL, or deployment. Use static SQL contract tests unless a
local disposable DB is already configured.

Report file: `/opt/worktrees/task-assignment-batch/.superpowers/sdd/2026-09-25-recipient-first-multi-task-assignment-plan/task-1-report.md`.
Write the report with status DONE/BLOCKED, commit SHA, tests, invariant checks,
DB impact, and concerns. Do not dispatch subagents or reviewers.
