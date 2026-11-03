# Projects V1.2 permissions

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
