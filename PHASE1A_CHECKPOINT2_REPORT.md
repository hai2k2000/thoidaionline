# Phase 1A – Checkpoint 2 Report

Date: 2026-09-16
Production source: `/opt/thoidai-work` (unchanged checkout, service active)
Isolated VPS worktree: `/opt/worktrees/thoidai-phase1a-cp2`
Branch: `phase1a-checkpoint2`
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

The task server boundary invokes shadow comparison for legacy `view`, `comment`, and `assign` checks while returning the legacy decision unchanged. Shadow loading is failure-isolated.

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

Matrix coverage includes active roles `admin`, `tong_bien_tap`, `pho_tong_bien_tap`, `truong_phong`, `pho_truong_phong`, `phong_vien`, `nhan_vien`, compatibility role `tbt_read_only`, own/assigned/same-department/other-department resources, `task.view`, `task.comment`, and department assignment.

| Result | Count | Evidence |
|---|---:|---|
| `MATCH` | 64 | `src/lib/phase1aShadowMatrix.test.mjs` |
| `RESTRICTIVE_MISMATCH` | 0 | Same matrix |
| `SECURITY_CRITICAL_MISMATCH` | 0 | Same matrix |

Workflow-dependent actions (`submit`, `return`, `approve`, `score`, `cancel`, deadline/update, attachment) remain `NEEDS_REVIEW`; no static RBAC grant is used to replace their legacy workflow checks.

## F. SECURITY_CRITICAL_MISMATCH

Count: **0** in the required characterization matrix.

## G. RESTRICTIVE_MISMATCH

Count: **0** in the required characterization matrix.

## H. Mismatch details

No mismatch was found in the covered view/comment/department-assignment matrix. Workflow-dependent actions are intentionally not classified as mismatches because Checkpoint 2 does not grant or replace their stateful legacy authorization.

## I. Migration/backup result

Fresh backup created before DB helper migration:
`/opt/thoidai-work/backups/phase1a-checkpoint2-20260916T050649Z`

It contains a custom database dump (867,053 bytes), schema dump (562,458 bytes), ledger export, source commit identifier, and SHA-256 manifest. Migrations `20260916103000` and `20260916104500` were applied explicit/per-file and recorded in the ledger. Existing unresolved legacy migrations were untouched.

Checkpoint 1 tables remain present: 17 permissions and 116 compatibility grants. Production service remained active.

## J. Test/typecheck/lint/build

- RBAC, DB helper, Checkpoint 1, compatibility, authorization, shadow, wiring, and task tests: **37/37 PASS** on VPS worktree.
- `npx tsc --noEmit`: **PASS** after correcting one import discovered by the first run.
- ESLint on all new RBAC/security files: **PASS**.
- VPS `npm run build`: compilation and TypeScript completed, but final build failed because the isolated VPS worktree could not fetch existing Google Fonts; this is an environment/network limitation unrelated to RBAC code. The same source builds successfully in the local fallback environment with non-secret dummy values. Existing dynamic HR upload tracing warnings remain non-blocking.

## K. Security review

- No production task authorization path was replaced.
- No UI, workflow, attendance, leave/trip, duty, online schedule, personal plan, Wise Eye, `work_kind`, topic, or journalism schema was changed.
- DB helper is server-only and browser execute privileges are denied.
- Inactive compatibility roles receive no new active-user access.
- Production checkout remains on legacy source until an explicit release step; only the isolated VPS worktree contains Checkpoint 2 source.

## L. Rollback/fallback

Application fallback is automatic because production still uses legacy authorization. For DB rollback, stop writes if required, restore the Checkpoint 2 custom dump, and remove only the helper function and its ledger row through a reviewed recovery procedure. Do not use `supabase db push`, `supabase db reset`, historical replay, or migration edits.

## M. Checkpoint 3 decision

**NO-GO pending production build verification.** Security-critical and restrictive mismatch counts are both zero, and all targeted tests/typecheck/lint pass. Before Checkpoint 3, rerun the production build in an environment with the existing font assets available (or use the already verified production build artifact) and obtain owner approval. Checkpoint 3 has not started.
