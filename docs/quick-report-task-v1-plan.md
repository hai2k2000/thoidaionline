# Quick Report / Incident Task V1

## Goal

Add an explicit `REPORT_ONLY` Task workflow for authorized self-reporting, with single and atomic 1-50 row creation, while preserving existing `STANDARD` approval semantics and global mutation policy.

## Plan

1. **Contract and schema first (TDD):** add failing tests for workflow/category/time/batch contracts; add additive `workflow_type`, report fields, category validation, permission catalog entry, and fail-closed RPCs for single/batch creation.
2. **Server path:** add typed repository/service methods and `/api/tasks/quick-report`; enforce RBAC permission, creator/owner self-report invariants, server-side validation, idempotency, and row-level atomicity through one RPC transaction.
3. **Mutation/reporting safety:** extend task reads and approval queues to expose/report the workflow; exclude `REPORT_ONLY` from approval-only calculations; reuse creator mutation RPCs without changing STANDARD behavior.
4. **UI:** add permission-gated ?+ B?o c?o vi?c ph?t sinh? entry and compact single/batch form with shared defaults, 24-hour time fields, row errors, and duplicate-submit protection; show `Ph?t sinh` in Task Center.
5. **Verification:** run focused red/green tests, approval/global-mutation regressions, TypeScript, touched-file lint, diff check, production-like build, route/artifact guards, and disposable migration rehearsal. Commit and push only after all required gates pass; do not touch production.

## Constraints

- Existing rows are semantically `STANDARD`; no inference from department/title/category/role.
- `REPORT_ONLY` is creator=owner=assignee, no reviewer, no pending approval, and may start `in_progress` or `done`.
- Cancelled tasks remain immutable; creator may edit/cancel only before done; admin may edit/cancel done.
- Batch is 1-50 rows, validated before commit, all-or-none, and idempotent.
