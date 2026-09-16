# Phase 1A - Checkpoint 3 Report

Date: 2026-09-16
Branch: `phase1a-checkpoint3`
Baseline: `141921afce7c3d15b8efc741b83cccaa0c0d82e3`
Worktree: `/opt/worktrees/thoidai-phase1a-cp3`

## Scope and safety

- Task authorization only; no production deploy, restart, flag activation, main merge, migration, RPC replacement, or grant seed.
- Production checkout `/opt/thoidai-work` was not modified.
- `TASK_RBAC_V2_ENABLED` is server-only, strict-true, and defaults to legacy behavior for missing, empty, malformed, or unknown values.
- No production `.env` was copied. Build verification uses dummy non-secret values.

## Enforcement model

Flag OFF: final authorization is the existing legacy result. Shadow comparison still runs.

Flag ON: final authorization is `RBAC base access AND legacy workflow/resource guard`. RPC/database validation remains authoritative for mutations. Shadow comparison still runs and remains metadata-only; it never reaches the client and excludes credentials/secrets.

Workflow actions use `task.view` only as base resource access. `task.view` does not imply score, approve, update, cancel, or any other mutation. `task.create` and `task.assign` are separate permissions and an explicit escalation test proves create scope cannot assign.

## Matrix

| ROLE | ACTION | RESOURCE | LEGACY | RBAC BASE | WORKFLOW | FINAL | RESULT |
|---|---|---|---|---|---|---|---|
| all characterized roles | view/detail/list | canonical task relations | legacy | task.view scope | legacy view guard | AND when ON; legacy when OFF | PASS |
| all characterized roles | comment | canonical task relations | legacy | task.comment scope | legacy comment/view guard | AND when ON; legacy when OFF | PASS |
| assignment roles | assign | target department/participants | legacy | task.assign scope | department + participant + RPC guards | AND when ON; legacy when OFF | PASS |
| create-capable roles | create/personal_create | new task | legacy/RPC | task.create | create validation/RPC | AND when ON; legacy when OFF | PASS |
| admin | admin_edit | existing task | legacy admin guard | task.edit_all | legacy admin/workflow guard | AND when ON; legacy when OFF | PASS |
| evaluator/reviewer | evaluate step1/step2 | stage/evaluator relation | legacy | task.evaluate.step1/step2 | evaluator/reviewer/stage rules | AND when ON; legacy when OFF | NEEDS_REVIEW characterization retained |
| workflow actors | submit/return/resubmit/approve/score/rescore/update/deadline/cancel/reopen/attachment | canonical task | legacy | task.view base only | legacy workflow/resource + RPC validation | AND when ON; legacy when OFF | NEEDS_REVIEW; no grant inference |

List scopes remain server-side and use canonical legacy-equivalent relations: creator/owner, assignee, reviewer, participant IDs from `task_assignees`, and department only where the existing policy grants it. No client-provided actor or department is trusted.

## Verification

- Task/RBAC/security suite: 48 tests passed, 0 failed.
- New Checkpoint 3 authorization tests: 6 passed, 0 failed.
- Task handler tests including flag-on deny paths and create-vs-assign escalation: 21 passed, 0 failed.
- `npx tsc --noEmit`: passed.
- Changed-file ESLint: passed with 0 errors.
- `git diff --check`: passed.
- Build command uses only dummy values: `NEXT_PUBLIC_SUPABASE_URL=https://example.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key SESSION_SECRET=dummy-session-secret npx next build --webpack` (PASS). Default Turbopack was not used because the isolated worktree's pre-existing `node_modules` symlink points outside the project root.

## Go gate

`SECURITY_CRITICAL_MISMATCH = 0` for the covered view/comment/assignment characterization. Cross-scope direct API denial, create-versus-assign separation, flag-off legacy regression, flag-on base-plus-legacy denial, TypeScript, lint, and targeted end-to-end handler checks pass.

This branch is intentionally stopped before production activation. Owner review is required before any deployment or flag change.
