# Phase 1A Checkpoint 3 Task Authorization Migration Design

Date: 2026-09-16
Approved baseline: `141921afce7c3d15b8efc741b83cccaa0c0d82e3`
Branch: `phase1a-checkpoint3`
Production activation: prohibited in this checkpoint

## Objective

Add an RBAC 2.0 enforcement path for the Task module while preserving current user-visible authorization and workflow behavior. RBAC decides base permission and resource scope. Existing legacy guards and database RPC validation continue to decide workflow, reviewer, state, score freshness, participant, assignment, and role-exception rules.

## Scope

Included task flows:

- list and direct detail access;
- personal creation and assignment creation;
- comment, update, deadline, cancel, reopen-equivalent actions;
- progress/submit, return, resubmit, approve, score/rescore;
- attachment upload/download;
- existing task evaluation paths.

Excluded modules and features remain untouched: attendance, Wise Eye, leave, business trip, duty schedule, online schedule, personal work plan outside task handlers, staff/permission UI, audit UI, CMS, AI, KPI, new dashboard, work kind, journalism details, and editorial topics.

## Feature Flag

A server-only helper reads `TASK_RBAC_V2_ENABLED`.

- Only the exact normalized value `true` enables RBAC enforcement.
- Missing, empty, malformed, or unrecognized values return `false`.
- The variable is never exposed through `NEXT_PUBLIC_*`, client props, API responses, or browser bundles.
- Flag `false` returns the legacy authorization result unchanged.
- Flag `true` requires RBAC base access and the existing legacy/workflow guard.
- Shadow comparison runs in both modes.

This is fail-legacy, not fail-open: invalid configuration cannot activate RBAC enforcement.

## Authorization Decision Model

For a canonical task resource loaded server-side:

```text
session actor
  -> load role grants once per request context
  -> evaluate RBAC base permission and scope
  -> evaluate existing legacy/workflow guard
  -> compare legacy and RBAC base for shadow telemetry
  -> select final result using server-only flag
  -> call repository/RPC only after final allow
```

Final decision:

```text
flag off: legacy guard
flag on:  RBAC base access AND legacy/workflow guard
```

Any denied layer denies the request. RBAC base access is not a mutation permission substitute.

## Permission Mapping

Direct static permissions:

- view/list/detail/download: `task.view` plus canonical scope and legacy access guard;
- comment: `task.comment` plus legacy comment guard;
- assignment: `task.assign` plus RBAC scope, `canAssignToDepartment()`, participant validation, and RPC validation;
- personal/create behavior: `task.create`, kept separate from assignment;
- admin edit: `task.edit_all` plus legacy `admin_edit` guard;
- step 1 evaluation: `task.evaluate.step1` plus evaluator/reviewer/stage guard;
- step 2 evaluation: `task.evaluate.step2` plus TBT/leader guard.

Workflow actions without complete grants remain explicitly legacy guarded:

- submit/resubmit;
- return/approve;
- score/rescore;
- update/reopen;
- deadline change;
- cancel;
- attachment mutation.

For these actions, `task.view` is only base resource access. It never implies mutation authority. No Checkpoint 3 grant or migration is added to make these actions appear statically complete.

## Canonical Resource Rules

The caller cannot supply authorization relationships. Task ID is validated, then `TaskAccessSnapshot` is loaded from the database. Department, creator, owner, assignee, reviewer, manager, status, task type, self-claimability, and participants come from canonical data.

Assignment uses validated request targets only to evaluate the proposed target scope; server session supplies the actor and reviewer. Existing participant resolution and RPC validation remain mandatory.

## List Filtering

List filtering stays in the repository and preserves pagination.

The query builder derives legacy-equivalent terms from RBAC grants:

- `all`: no authorization scope predicate;
- `department`: canonical `department_id` equals the actor department;
- `self`: creator or owner relation, because both are part of current legacy view behavior;
- `assigned`: owner, assignee, reviewer, or `task_assignees` participant relation, because all are accepted by current `canTaskAction(view)` behavior.

Multiple scopes are OR-combined. Participant task IDs are loaded once, never per row. User filters remain additional constraints and cannot widen authorization scope. The existing legacy path is unchanged when the flag is off.

## Detail and Mutation Enforcement

Direct detail/API access loads the canonical resource and returns the current forbidden/not-found behavior when denied.

Every mutation must satisfy:

1. authenticated server-session actor;
2. required RBAC base permission/scope when flag is on;
3. current legacy resource/workflow guard;
4. current participant, reviewer, manager, state, freshness, and role-exception validation;
5. existing repository/RPC database validation.

Client `actor_id`, role, department, permission, owner, reviewer, or relationship fields are ignored for authorization.

## Shadow and Security Telemetry

Shadow instrumentation remains active in flag-off and flag-on modes. It records minimal metadata only: actor ID, role code, permission, resource type/ID, and classification.

It never returns mismatches to clients and never logs cookies, session contents, tokens, passwords, secrets, request bodies, or credential material.

`legacy DENY + RBAC ALLOW` is `SECURITY_CRITICAL_MISMATCH`. Such a mismatch blocks controlled activation.

## Database and RPC Strategy

Checkpoint 3 makes no database migration, grant change, RPC replacement, or historical migration replay.

Existing RPCs retain workflow validation and audit/status-history writes. If implementation proves a new RPC, migration, or grant is required, work stops before applying it and owner approval is requested.

## Testing Strategy

Tests run in both modes:

- flag off proves legacy regression compatibility;
- flag on proves RBAC base enforcement plus unchanged workflow guards.

Required coverage includes active and compatibility roles, own/assigned/same-department/other-department/organization resources, create-versus-assign escalation, direct ID/API denial, fake actor/department attempts, view/comment/assign/update/submit/return/resubmit/approve/score/rescore/deadline/cancel/reopen/attachment flows, audit/history preservation, and the full assigned-task workflow.

The final matrix records:

```text
ROLE | ACTION | RESOURCE | LEGACY | RBAC BASE | WORKFLOW | FINAL | RESULT
```

Verification requires authorization/security tests, workflow tests, TypeScript, changed-file ESLint, and a production build using non-secret build-safe values.

## Performance

A request-scoped RBAC context caches actor grants. List authorization computes scope constraints once and participant IDs at most once. Detail/mutation authorization loads grants once per request and canonical task access once per guard. No client-side post-filtering or per-row grant query is introduced.

## Rollback and Production Safety

Production remains on legacy source and is not restarted. No merge to `main`, deployment, or production flag activation occurs.

After a future approved deployment, rollback is immediate by setting/removing `TASK_RBAC_V2_ENABLED` so its resolved value is false, restoring the legacy decision path without database rollback. Shadow telemetry remains available for investigation.

## Deliverables

- server-only fail-legacy flag parser;
- reusable task enforcement adapter and request-scoped grant loading;
- RBAC-equivalent server-side list scoping;
- task handler enforcement with legacy workflow guards;
- dual-mode regression/security/workflow tests;
- `PHASE1A_CHECKPOINT3_REPORT.md`;
- clean pushed `phase1a-checkpoint3` branch;
- no production deployment or activation.
