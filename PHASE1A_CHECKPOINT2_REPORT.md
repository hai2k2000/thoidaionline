# Phase 1A – Checkpoint 2 Report

Date: 2026-09-16
Production source: `/opt/thoidai-work` (unchanged checkout, service active)
Isolated VPS worktree: `/opt/worktrees/thoidai-phase1a-cp2`
Branch: `phase1a-checkpoint2` (implementation commit recorded below)
Scope: TypeScript authorization layer, DB grant reader, and shadow mode only

## A. TypeScript RBAC architecture

Added `src/lib/rbac/`:

- `types.ts`: lowercase scope and canonical task resource types.
- `permissionCatalog.ts`: catalog code union.
- `authorization.ts`: `hasPermission`, `scopesFor`, `can`, and `assertPermission`.
- `repository.ts`: server-only loader through the DB helper; no client-supplied role, department, or grants.
- `shadow.ts`: legacy/RBAC comparison and metadata-only discrepancy logger.

Task server handlers invoke this observer for `view`, `comment`, and `assign`; legacy authorization remains authoritative and shadow failures are isolated.

The helper evaluates permission plus scope plus canonical resource relationships. `task.create` has no implicit assignment authority. Legacy `canTaskAction()`, `canAssignToDepartment()`, `role_permissions`, and task RPCs remain production decision-makers.

The task server boundary invokes shadow comparison for legacy `view`, `comment`, and `assign` checks while returning the legacy decision unchanged. Assignment shadow receives the actual `canAssignToDepartment()` result for both allow and deny paths; deny returns before participant resolution or repository mutation. Shadow loading is failure-isolated.

## B. DB authorization helper

Migration `20260916103000_phase1a_rbac_db_helper.sql` adds `api_list_role_permission_grants(uuid)` as a `SECURITY DEFINER` read-only grant loader with `search_path = public, pg_temp`, active actor/role validation, and permission-code/scope output. Execute is revoked from `public`, `anon`, and `authenticated`; only `service_role` can execute it. Migration `20260916104500_phase1a_rbac_compatibility_completion.sql` adds only compatibility grants.

## C. Scope resolution rules

- `self`: task creator or owner is the actor.
- `assigned`: owner, assignee, reviewer, or canonical participant relation contains the actor.
- `department`: canonical task department equals the actor department; null departments never match.
- `all`: removes only the data-scope limit; workflow/state/reviewer rules remain outside this helper.

## D. Shadow-mode design

`compareShadowResult()` classifies each pair as `MATCH`, `RESTRICTIVE_MISMATCH`, or `SECURITY_CRITICAL_MISMATCH`. `shadowAuthorize()` returns the legacy result unchanged and logs only actor id, role code, permission, resource metadata, and classification. No secret, cookie, password, token, or client response is logged.

The implementation is wired only as a parallel observer. It does not replace task authorization or change task responses.

## E. Legacy vs RBAC comparison matrix

Matrix coverage includes active roles `admin`, `tong_bien_tap`, `pho_tong_bien_tap`, `truong_phong`, `pho_truong_phong`, `phong_vien`, `nhan_vien`, and compatibility roles `tbt_read_only`, `bien_tap_vien`, `tri_su`. Resource cases include own, assigned, same-department, other-department, and organization-level assignment cases. `task.view`, `task.comment`, `task.assign`, and `task.create` are characterized; workflow-dependent actions are enumerated separately as `NEEDS_REVIEW`.

| Result | Count | Evidence |
|---|---:|---|
| Matrix | Rows | MATCH | RESTRICTIVE_MISMATCH | SECURITY_CRITICAL_MISMATCH | Evidence |
|---|---:|---:|---:|---:|---|
| view/comment | 80 | 80 | 0 | 0 | `src/lib/phase1aShadowMatrix.test.mjs` |
| assignment scope | 30 | 30 | 0 | 0 | `src/lib/phase1aShadowMatrix.test.mjs` |
| workflow characterization | 90 | n/a | n/a | n/a | `src/lib/phase1aShadowMatrix.test.mjs` |

`task.create` is separately verified for four create-capable non-assignment roles: create is allowed by the RBAC grant, while cross-department assignment remains denied by both legacy and RBAC scope checks.

Workflow-dependent actions (`submit`, `return`, `approve`, `score`, `cancel`, deadline/update, attachment) remain `NEEDS_REVIEW`; no static RBAC grant is used to replace their legacy workflow checks.

## F. SECURITY_CRITICAL_MISMATCH

Count: **0** across the 110 comparable view/comment and assignment rows.

## G. RESTRICTIVE_MISMATCH

Count: **0** across the 110 comparable view/comment and assignment rows.

## H. Mismatch details

No mismatch was found in the covered view/comment/assignment matrix. Workflow-dependent actions are intentionally classified as `NEEDS_REVIEW` because Checkpoint 2 does not grant or replace their stateful legacy authorization. `tbt_read_only` remains view-only; inactive compatibility roles do not gain active-user access.

## I. Migration/backup result

Fresh backup created before DB helper migration:
`/opt/thoidai-work/backups/phase1a-checkpoint2-20260916T050649Z`

It contains a custom database dump (867,053 bytes), schema dump (562,458 bytes), ledger export, source commit identifier, and SHA-256 manifest. Migrations `20260916103000` and `20260916104500` were applied explicit/per-file and recorded in the ledger. Existing unresolved legacy migrations were untouched.

Checkpoint 1 tables remain present: 17 permissions and 116 compatibility grants. Production service remained active.

## J. Test/typecheck/lint/build

- Exact test command: `node --test src/lib/rbacAuthorization.test.mjs src/lib/phase1aShadowMatrix.test.mjs src/lib/phase1aShadowWiring.test.mjs src/lib/phase1aRbacCompatibility.test.mjs src/lib/phase1aRbacDbHelper.test.mjs src/lib/phase1aRbacCore.test.mjs src/lib/authorization.test.mjs src/lib/taskHandlers.test.mjs src/lib/manager_assignment.test.mjs src/lib/taskAssignAccess.test.mjs src/lib/taskAssignmentGroup.test.mjs src/lib/taskCompletionScoresSecurity.test.mjs src/lib/taskScoreFreshness.test.mjs`
- Test result: **52/52 PASS**, 0 failed, 0 skipped.
- `npx tsc --noEmit`: **PASS** (exit 0).
- ESLint command covered all changed RBAC/security/task wiring files: **PASS**, 0 errors and 0 warnings.
- Build command used non-secret values only: `NEXT_PUBLIC_SUPABASE_URL=https://example.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key SESSION_SECRET=dummy-session-secret npm run build`
- `npm run build`: **PASS** (exit 0). Existing dynamic HR upload tracing warnings remain non-blocking.

## K. Security review

- No production task authorization path was replaced.
- No UI, workflow, attendance, leave/trip, duty, online schedule, personal plan, Wise Eye, `work_kind`, topic, or journalism schema was changed.
- DB helper is server-only and browser execute privileges are denied.
- Inactive compatibility roles receive no new active-user access.
- Production checkout remains on legacy source until an explicit release step; only the isolated VPS worktree contains Checkpoint 2 source.

## L. Rollback/fallback

Application fallback is automatic because production still uses legacy authorization. For DB rollback, stop writes if required, restore the Checkpoint 2 custom dump, and remove only the helper function and its ledger row through a reviewed recovery procedure. Do not use `supabase db push`, `supabase db reset`, historical replay, or migration edits.

## M. Interrupted-state resolution and branch

- Dirty-state patch preserved before edits at `/tmp/phase1a-cp2-interrupted-state.patch`; SHA-256: `b12a8847fc203ba3cc6ec19ad3fd41ff4c7231dfe0f24014a3fced1d4610865f`.
- The assignment-shadow fix was reviewed with a RED test against commit `25b7641` (17 existing tests passed, new test failed) and then GREEN on the corrected worktree.
- Line-ending-only noise in the interrupted TypeScript files was normalized without discarding semantic changes.
- Implementation commit SHA: `57bb72f36a7e76ad9cd8c2a7b1df760ae872d0e4`.
- Remote branch: `origin/phase1a-checkpoint2` created and pushed successfully; no force-push and no merge to `main`.

## N. Checkpoint 3 decision

**NO-GO.** Checkpoint 2 remains shadow-only. Production source was not changed or restarted. Checkpoint 3 must not start until owner review explicitly approves the sealed checkpoint artifact.
