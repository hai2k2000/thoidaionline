# SDD ledger — plan: docs/superpowers/plans/2026-09-25-recipient-first-multi-task-assignment-plan.md

Workspace: /opt/worktrees/task-assignment-batch
Branch: feat/task-assignment-batch

## Pre-flight plan scan

| Scope | Pair/task | Finding | Ruling |
|---|---|---|---|
| Shared file/interface | 1 -> 2 | Checkpoint 1 owns the table/signature; Checkpoint 2 replaces the skeleton body. | Valid dependency; keep separate commits. |
| Shared file/interface | 2 -> 3 | RPC result requires ordered `{ordinal,id,title}` output consumed by repository/API. | Valid interface; freeze result shape before API work. |
| Shared file/interface | 3 -> 4 | API scope validation and repository scope model both enforce authorization. | Defense in depth, not duplicated business rule; RPC remains authority. |
| Shared file/interface | 4 -> 5 | Scope model feeds page and client shell; cards must not own recipient state. | Keep recipient shared state outside card reducer. |
| Shared file/interface | 5 -> 6 | Card attachment order must map to returned task order. | Freeze ordered attachment array and task-index mapping. |
| Shared file/interface | 6 -> 7 | Attachment retry tests depend on returned IDs and must not call batch endpoint. | Test helper receives uploader and task IDs; no creation callback. |
| Shared file/interface | 7 -> 8 | Browser gate consumes final API/UI contract and secure accounts. | No production activation; artifact only. |
| Task self-consistency | 1 | Contract tests and migration skeleton match; exact table/RPC names are specified. | Proceed. |
| Task self-consistency | 2 | RPC tests cover atomicity/idempotency/order and implementation invokes existing RPC. | Proceed; no business-rule copy. |
| Task self-consistency | 3 | Explicit `mode=batch` dispatch preserves single-task path. | Proceed. |
| Task self-consistency | 4 | Role scopes retain current permissions while changing picker defaults. | Proceed. |
| Task self-consistency | 5 | UI card state excludes recipient and notes. | Proceed. |
| Task self-consistency | 6 | Storage exception is outside DB transaction by design. | Proceed. |
| Task self-consistency | 7 | Tests include every invariant listed in Global Constraints. | Proceed. |
| Task self-consistency | 8 | Release gate stops before production deployment. | Proceed. |

No unresolved plan conflicts found. No production or shared-branch mutation is authorized by this plan phase.

## Rulings

- Ruling: The batch RPC may normalize card fields before calling `api_assign_task_v2`, but it must not duplicate authorization/participant/recurrence rules — required by the approved spec; cost is a small normalization adapter.
- Ruling: The existing single-task endpoint remains the compatibility path and only exact `mode: "batch"` selects batch behavior — required to prevent malformed payload reinterpretation.

## Progress

Task 1: complete (commit 4bc62e6f3c5ba85802e1436ba068c4a7ab8762c3; inline spec/quality review PASS)
Task 2: complete (atomic batch RPC; inline spec/quality review PASS; commit 440f59e)
Task 3: complete (API compatibility and error contract; inline spec/quality review PASS; commit 2b81cb3)
Task 4: complete (recipient-first UI and role-aware scope; inline spec/quality review PASS; pending commit)
