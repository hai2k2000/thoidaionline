# Project tasks without scoring - code extension

## Non-project approval fixture correction (2026-11-03)

- Case A at the RPC layer: the latest prior assigned-review definition is in `20260924120000_task_approval_gates.sql`. It has no inline score check. Specializing the V1.2 project additions for a null project ID reproduces that entire prior definition byte for byte, including both approval-required paths.
- `api_review_task_completion` (20260814190000) and `review_task_completion` (20261103160000), plus their authorization helper, are not replaced by V1.2 and contain no score check. They update the same task status.
- Important schema distinction: the historical `require_task_score_before_done` trigger function DOES reject unscored regular assigned tasks when bound and enabled. V1.2 preserves that non-project predicate (only formatting differs). Thus the reported restored-prod success is not an RPC regression; offline source comparison cannot establish why that schema's trigger did not enforce the gate. A full historical migration-chain database with that trigger enabled still rejects this fixture.
- The behavior fixture now asserts the reported restored-prod approval without a score for all three RPCs, verifies no score was written, then independently exercises the scoring RPC after resubmission. This supersedes the earlier non-project score-required fixture claim.
- Added `src/lib/projectTaskLegacyReview.test.mjs` to lock the legacy assigned branch, unchanged wrappers/helper, and equivalent non-project trigger predicate. No migration edits, Git/network operations, or live SQL execution in this correction.
- Requested Node validation: 14/14 PASS (new legacy-review test plus projects-v1-2-dryrun and projectTaskNoScoring).

This section supersedes earlier scoring behaviour notes below. Only migration 20261103200000 was extended. No migration was applied.

## Behaviour and API

Project tasks show approval wording, retain requirements/progress/comments/files/history, and hide scoring forms, scoring requirement controls, score summaries and scoring links. Lead/admin approve with Hoan thanh or reject with Tu choi and a required comment. Rejection returns to in_progress, clears the submission timestamp, records the comment/status event/audit, and permits resubmission. Non-project branches remain unchanged. The mixed task list retains scores only for non-project rows; a project-only list hides the score column entirely. ProjectDetailShell already uses Cho duyet and contains no scoring UI, so it required no edit.

Task detail loads project identity before optional evaluation queries, skips completion/checkpoint/qualitative queries for project tasks, and returns null/empty compatibility fields. The existing review API already accepts decision/reason without scores; runtime handler tests prove that lead/admin can use it and ordinary members cannot.

## SQL and evaluation protection

Changed functions in this extension:
- api_review_assigned_task_completion: project branch independent of approval_required; required rejection comment, no scoring writes.
- require_task_score_before_done: bypass only when project_id is non-null; original non-project freshness requirement preserved.
- api_score_task_completion: explicitly rejects project tasks before writing a score; non-project implementation preserved.
- api_get_personnel_evaluation_detail: excludes project task evidence.
- guard_project_task_score_row (new): denies direct INSERT/UPDATE into task_completion_scores for project tasks.
- guard_project_task_evaluation_row (new): denies direct INSERT/UPDATE into task_evaluation_checkpoints and task_qualitative_evaluations for project tasks.

api_review_task_completion -> review_task_completion already delegates project reviews into api_review_assigned_task_completion; those two definitions are unchanged. Existing task approval authorization remains lead/admin scoped. All new/replaced functions have explicit service-only execute ACLs. Revert restores previous definitions verbatim and drops only the added triggers/functions; source tests check exact restoration. Postcondition checks definitions, trigger presence and ACLs.

No project review inserts performance_review_scores. That table remains employee/cycle-scoped, with no task-derived write chain. Project task evidence is excluded in evaluationRepository, the personnel-detail SQL function and public-evaluation-summary. Existing project score rows are not deleted; they cannot appear in those aggregates or project detail UI. No historical employee-level performance score is rewritten.

## Validation

- Related task/project/evaluation/notification Node suite: 384/384 PASS.
- Exact Node command extracted from .github/workflows/production-artifact.yml: 72/72 PASS.
- npx.cmd tsc --noEmit: PASS.
- npx.cmd eslint touched TS/TSX/MJS files: 0 errors; 6 existing warnings.
- Behaviour SQL now covers real submit, lead rejection with required comment, resubmit, admin/lead score-free approval, denied project scoring, and non-project score-required approval.
- Live PostgreSQL behaviour/revert/reapply remains unexecuted because psql/Docker are unavailable offline. Node SQL checks are source contracts, not database execution.
- No network, commit, push, deploy or production change. One accidental read-only git status command was disclosed.

## Files in this extension

- src/components/TaskDetailShell.tsx
- src/components/TaskCenterShell.tsx
- src/components/TaskStatusTablePage.tsx
- src/components/AdminTaskEditForm.tsx
- src/app/profile/page.tsx
- src/app/users/[id]/page.tsx
- src/lib/notificationRepository.ts
- src/lib/taskRepository.ts
- src/lib/evaluationRepository.ts
- src/app/api/public-evaluation-summary/route.ts
- supabase/migrations/20261103200000_projects_v1_2_permissions.sql
- scripts/production/projects-v1-2-revert.sql
- scripts/production/projects-v1-2/post/20261103200000_projects_v1_2_permissions.sql
- supabase/tests/projects_v1_2_behaviour.sql
- scripts/production/projects-v1-2-dryrun.test.mjs
- src/lib/projectTaskNoScoring.test.mjs
- src/lib/taskHandlers.test.mjs
- src/lib/taskManagementUx.test.mjs (align existing CTV restriction assertion)
- src/lib/taskAssignmentDisplay.test.mjs (dynamic column span assertion)
- PROJECT_STATUS.md
- docs/projects-v1-2-report.md

---

# Projects V1.2 permissions

## Reviewer production-schema fix (2026-11-03)

- V1.2 now replaces `validate_task_report_recipient`: project reviewers must be active project leads or admins; deputies are rejected. Non-project validation and the self-claimable assignment-mode check retain their previous behavior.
- Also replaces `api_approve_task_claim` and `api_review_assigned_task_completion`: their `approval_required` branches use lead/admin authorization for project tasks and retain the previous department authorization for non-project tasks.
- Inspected `api_review_task_completion`, `review_task_completion`, `api_assert_task_action`, `api_score_task_completion`, `require_task_score_before_done`, task/score constraints and `enforce_assignee_manager_watcher`. These already support the project path or enforce unrelated score/data integrity; no changes needed.
- Revert restores all three previous function definitions exactly. Postcondition checks trigger binding, project authorization branches and explicit function ACLs. The recipient trigger retains SECURITY INVOKER.
- SQL behaviour fixtures cover a plain cross-department employee lead scoring/approving, deputy denial, active admin scoring/review, invalid non-project reviewer rejection, inactive/null reviewer rejection, self-claimable validation and both approval-required gates.
- Validation: `node --test scripts/production/projects-v1-2-dryrun.test.mjs scripts/standalone-packaging.test.mjs` passed 24/24. Live SQL behaviour and restore/apply/revert/reapply were not executed in this offline code-fix session; rerun the prod-schema restore dry-run with these updated artifacts.
- No git, network or production operations performed.

Implemented in the existing worktree without commit, push, network, SSH or Docker.

## Behavior

- `project.create` appears under Du an (Vietnamese UI labels) and uses the existing per-user `set_user_override` / `clear_user_override` API actions and `api_set_user_permission_override` / `api_clear_user_permission_override` RPCs. Storage remains `user_permission_grants`; deny overrides allow/role grants. Existing admin and tong_bien_tap role grants remain.
- CTV users cannot receive a create allow through the RPC, do not see its grant control, and fail effective create checks. The creator is always a lead in API and SQL even with empty lead IDs.
- Lead transfer locks the project, promotes an active non-CTV member, updates the caller's chosen role atomically and writes audit history. Nonmember admins stay nonmembers.
- Admin has project lead powers through centralized SQL helpers, app membership guards, RBAC/task authorization, detail controls, library and reviewer selection. Other roles retain their boundaries.
- Members remain collapsed by default. Automatic library content retains the same protection as for project leads.

## Migration artifacts

`supabase/migrations/20261103200000_projects_v1_2_permissions.sql` is the only new migration. Every defined/redefined function has explicit exact-signature service-only execute ACLs; no policies are created. It preserves existing role grants and project/library data.

Included: `scripts/production/projects-v1-2-revert.sql`, `scripts/production/projects-v1-2/post/20261103200000_projects_v1_2_permissions.sql`, transactional `supabase/tests/projects_v1_2_behaviour.sql`, `scripts/production/projects-v1-2-dryrun.sh` and its source tests. The dry-run keeps backup/disk/restore/reapply checks and reasserts both V1 and V1.1 ACLs after restore. The migration is in both standalone reference lists and packaging tests.

## Validation

- Workflow Node command: 72/72 PASS.
- Focused permissions/projects/navigation/dry-run source tests: 116/116 PASS.
- TypeScript `npx.cmd tsc --noEmit`: PASS.
- Changed-file ESLint: PASS.
- Wider src/scripts discovery: 1861 tests, 1852 pass, 8 fail, 1 skip on first run. The admin navigation expectation was corrected and its 17-test suite passes. Seven remaining failures are outside changed behavior: Windows symlink privileges (1), Windows URL/path handling in disposable-runner tests (2), CRLF-sensitive V1.1 source regex (1), unavailable Playwright fixture (1), missing server-only package for direct Node DOCX import (1), and stale legacy-claim source expectation predating CTV exclusion (1). The relevant files were unchanged by this task. No claim that the entire discovered suite is green.

## Unverified

Live SQL execution, behavior fixtures, migration/revert/reapply and browser interaction were not run. No PostgreSQL/Docker/VPS was used. Tests ran on installed Node 24.13.1, not CI Node 22.22.0. Migration is authored and source-checked, not applied.

## Files

- `PROJECTS_V12_REPORT.md`
- `PROJECT_STATUS.md`
- `scripts/package-standalone.mjs`
- `scripts/production/projects-v1-2-dryrun.sh`
- `scripts/production/projects-v1-2-dryrun.test.mjs`
- `scripts/production/projects-v1-2-revert.sql`
- `scripts/production/projects-v1-2/post/20261103200000_projects_v1_2_permissions.sql`
- `scripts/standalone-packaging.test.mjs`
- `scripts/verify-standalone-artifact.mjs`
- `src/app/api/projects/[id]/library/route.ts`
- `src/app/api/projects/[id]/transfer-lead/route.ts`
- `src/app/api/projects/route.ts`
- `src/app/permissions/page.tsx`
- `src/app/projects/[id]/page.tsx`
- `src/components/ProjectCreateForm.tsx`
- `src/components/ProjectDetailShell.tsx`
- `src/components/permissions/OtherPermissionsSection.tsx`
- `src/components/phase2Navigation.test.mjs`
- `src/components/phase2Navigation.ts`
- `src/lib/approvalPermissionView.mjs`
- `src/lib/authorization.ts`
- `src/lib/permissionGroups.test.mjs`
- `src/lib/projectApi.test.mjs`
- `src/lib/projectApiGuards.ts`
- `src/lib/projectRepository.ts`
- `src/lib/projectVisibility.test.mjs`
- `src/lib/projectsP2.test.mjs`
- `src/lib/projectsV12Ui.test.mjs`
- `src/lib/rbac/authorization.ts`
- `src/lib/rbac/permissionScopes.mjs`
- `src/lib/rbac/repository.ts`
- `src/lib/rbac/types.ts`
- `src/lib/serverSession.ts`
- `src/lib/taskAuthorization.ts`
- `src/lib/taskRepository.ts`
- `supabase/migrations/20261103200000_projects_v1_2_permissions.sql`
- `supabase/tests/projects_v1_2_behaviour.sql`
