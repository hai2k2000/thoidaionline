# Journalism Tasks J3A Review

## Scope and Recommendation

J3A is complete as a design/contract/characterization checkpoint only. No application source, schema, migration, permission, grant, production release, or production data was changed.

**Recommendation: GO FOR J3B IMPLEMENTATION, subject to the implementation and test gates in this review.** The owner has finalized the permission matrices, URL policy, withdrawal-reason policy, concurrency model, and migration/RPC plan. J3B still requires a separate explicit start approval.

## Inspected Baseline

- Runtime source baseline: `fad1124cad189a8e10e7f3aa1a07631e8ac31f72`
- J2P report-only branch additions relative to that source: `JOURNALISM_TASKS_J2P_PRODUCTION_REPORT.md` and `JOURNALISM_J2P_RUNTIME_ENV_REPORT.md`; no application code differences
- Production release: `/opt/releases/thoidai-work/fad1124cad189a8e10e7f3aa1a07631f72-j2p-envretry-20260918T050842Z`
- J2 schema: `journalism_work_kinds` and `journalism_task_details` present; detail row count `0`; 10 active seed kinds; RLS enabled
- J2 migration checksum: `9f707262958fee0f160f5beafb42dbdca302c59b65f7bc9120607d0763f05c45`; manually applied/per-file outside ledger
- R2 label migration remains manually applied outside ledger; unresolved legacy migrations remain untouched
- Live RBAC baseline: 17 permissions / 116 grants; no J3 grant changes

## Actual Current Behavior

### Task creation and assignment

- Generic create and assigned create are separate handlers.
- Assigned creation calls `api_assign_task_v2` through `taskRepository.assign`.
- The RPC is `SECURITY DEFINER`, calls `api_assert_task_action(..., 'assign')`, validates active actor/department/manager, assignee/reviewer eligibility, priority/due fields, participants, recurrence, and writes `audit_logs` inside the database function.
- Existing API handlers authorize with legacy guards and, when RBAC is enabled, require RBAC base permission plus legacy result. The client never receives shadow mismatch details.
- This is the correct composition point for an atomic Journalism wrapper; calling it from a wrapper preserves the PostgreSQL transaction.

### Task authorization and scope

- Legacy `view` allows organization roles, related actors, or department viewers in the same department.
- Legacy mutation actions remain action-specific and do not derive mutation from `task.view`.
- RBAC `self` currently means creator/owner; `assigned` means owner/assignee/reviewer/participant; `department` means matching parent department; `all` is unrestricted scope.
- Current task creation grants include `task.create` with `all`, but assignment remains a separate `task.assign` permission and database/legacy scope guard.

### Journalism read path

- Read fields use the alias `journalism:journalism_task_details(...)`.
- Positive parent-reducing filters use an embedded `!inner` relation.
- Exclusion uses the corrected alias predicate `journalism=is.null`; the old `journalism_task_details=is.null` form caused PostgREST `42703` and is not acceptable.
- Existing normal tasks normalize `journalism` to `null`.

### Audit and workflow events

- `audit_logs` columns are `actor_id`, `module`, `entity_type`, `entity_id`, `action`, `old_data`, `new_data`, `created_at`.
- Existing server audit writes use JSONB before/after payloads and throw on insert failure in server-only paths.
- `task_status_events` is the existing Task workflow event table and must not receive Journalism publication events.
- Existing audit action strings are generic (`create`, `update`, `assign`, etc.); J3 should use explicit Journalism action strings in the dedicated module contract.

## Compatibility Findings

1. A dedicated wrapper is safer than composing two HTTP calls; it preserves atomic parent/detail/audit behavior.
2. Existing work-kind FK and active seed model supports active-only create/change while preserving inactive historical reads.
3. `article_url` already has state constraints, so publication semantics should own it rather than metadata editing.
4. J2 has no withdrawal-reason column; audit metadata is the least additive v1 choice.
5. No optimistic version field was found; row locks plus `updated_at` trigger match current conventions.
6. Existing audit helper is not transaction-aware across separate calls; required J3 audit must be inside the DB wrapper/RPC.
7. Permission catalog currently has no Journalism mutation entries; live baseline must remain 17/116 until owner approval.

## Owner-Finalized Policy

- Metadata grants: admin/all, tong_bien_tap/all, pho_tong_bien_tap/all, truong_phong/department, pho_truong_phong/department, phong_vien/assigned, nhan_vien/assigned.
- Publication grants: admin/all, tong_bien_tap/all, pho_tong_bien_tap/all, truong_phong/department, pho_truong_phong/department.
- Inactive compatibility roles receive no Journalism grants.
- Article URL is publication-managed, required on publish, absolute HTTP(S), credential-free, immutable after publication, and preserved on withdrawal.
- Withdrawal reason is required, audit-only, trimmed, and limited to 2000 Unicode characters; no new column.
- Planned publication time is mutable only in `not_published` and `scheduled`; it is cleared on unschedule and preserved as history on publish.
- Work kind, location, and editorial notes may remain metadata-editable after publication/withdrawal subject to authorization, validation, and audit.
- Expected future catalog: 19 permissions / 128 grants.

## Blockers and Risks

- No product-policy blocker remains for J3B design.
- Implementation remains blocked until the owner gives a separate explicit J3B start approval.
- Risk: calling the existing assignment RPC through a wrapper must be verified with a disposable transaction test before production implementation.
- Risk: PostgREST relation aliases must preserve the corrected `journalism=is.null` exclusion behavior.
- Risk: audit payloads can leak editorial text if not bounded/minimized; implementation must enforce the contract.
- Risk: concurrent publication transitions require row locking; application-only checks are insufficient.

## Proposed Future Counts

The finalized matrix adds exactly 2 permission catalog rows and 12 grant tuples: future 19 permissions / 128 grants. These are approved implementation targets only; current production remains 17/116 during J3A-R1.

## Required Implementation Gates After Approval

1. Create a new migration version strictly after `20260918100000`.
2. Add only approved catalog/grant tuples and RPC definitions.
3. Add routes and tests without changing J2 read behavior.
4. Prove transaction rollback on detail/audit failure and concurrent state conflict.
5. Run full TypeScript, changed-file lint, critical authorization, J2 read, module regression, build, and isolated PostgREST gates.
6. Perform production backup and controlled release activation in a separate owner-approved checkpoint.

## Files Produced

- `JOURNALISM_TASKS_J3_CONTRACT.md`
- `JOURNALISM_TASKS_J3A_REVIEW.md`

Only these documentation files are intended for the J3A commit.
