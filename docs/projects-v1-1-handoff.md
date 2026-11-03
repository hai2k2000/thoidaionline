# Projects V1.1 local implementation handoff

Date: 2026-11-03
Branch: feature/projects-v1-1-library
Base: 98bb89b
Status: code implemented; required local checks pass; database/browser execution unverified.

## Implementation

- Deputy membership can assign project tasks with an active lead reviewer. Default reviewer is the current lead or the first lead for a deputy. Review and project/member management remain lead-only.
- CTV cannot become lead/deputy through membership/create RPCs (table trigger), UI controls, or a later staff role change. CTV can use the library as a project member.
- Library tab: folder tree, mobile folder selector, breadcrumb, multi-file upload, HTTPS links, folder creation, rename/move/delete controls, uploader/date/size, task badges and membership-authorized signed downloads.
- Manual content may be changed by its owner or project leads/deputies. Automatic task files cannot be deleted; leads/deputies can move/rename them. System folder cannot be changed. Nonempty folders must be emptied before soft deletion, preserving other users' content.
- Folder mutations serialize on the project row and reject cross-project parents and cycles. All library RPCs use SECURITY DEFINER with explicit search_path and service-only ACLs; mutations and list/download access are audited.

## Single migration

`supabase/migrations/20261103180000_projects_v1_1_deputy_library.sql`

Tables: `project_library_folders`, `project_library_items`. Both enable RLS with no policies and revoke client/public privileges. Folder names are unique case-insensitively within a live parent; task source attachment IDs are unique. Deletion is soft.

Updated RPCs: `api_set_project_member`, `api_assign_project_task`.
New helpers/RPCs:
- `api_project_can_assign`
- `api_assert_project_library`
- `ensure_project_task_folder`
- `api_list_project_library`
- `api_create_project_library_folder`
- `api_mutate_project_library_folder` (rename/move/delete)
- `api_add_project_library_item` (HTTPS link or file registration)
- `api_mutate_project_library_item` (rename/move/delete)
- `api_get_project_library_file`

Triggers:
- `guard_project_lead_role` on project_members rejects CTV leadership.
- `guard_project_staff_role` on staff_users prevents changing a project leader into CTV without first removing leadership.
- `create_project_task_folder` on projects creates the system folder.
- `file_project_task_attachment` on task_attachments files each new project-task attachment.

Existing project folders and task attachments are backfilled idempotently. Revert restores V1 membership/assignment behavior, preserves V1 tables and refuses to discard manual library content. The dry-run is copied from the working V1 runner and adapted for V1.1; approval, backup checksum, disk guard, isolated container, postconditions, behavior, idempotency, revert and reapply remain intact.

## Attachment findings

All canonical assignment and task-detail uploads use `task_attachments`. `task_progress_reports` contains report text/status but no file metadata, and completion submission updates task workflow state; neither has a separate attachment table. Files attached while reporting/submitting use the same attachment endpoint/table. These files are indexed as `source=task_attachment` because the existing metadata does not distinguish workflow origins. No text links are extracted.

Storage stays in `task-private`, without copying task objects. Shared policy: 10 MiB, PDF/PNG/JPEG/DOCX/XLSX, existing extension MIME fallback. Display names remain separate from generated ASCII object keys. Failed library registration removes the newly uploaded object. Downloads recheck project access through the RPC before creating a 60-second signed URL.

## CTV allowlist additions

- `/api/projects/:uuid/library`: GET, POST, PATCH, DELETE.
- `/api/projects/:uuid/library/download/:uuid`: GET.

RPCs enforce ownership, active membership, automatic-file protection and lead/deputy management rights. Existing project mutation APIs remain blocked for CTV.

## Validation

- Exact full Node command from `.github/workflows/production-artifact.yml`: 71 passed, 0 failed.
- Focused Projects/library/CTV/attachment/C-01/dry-run suite: 65 passed, 0 failed.
- `npx.cmd tsc --noEmit`: exit 0.
- `npx.cmd eslint` on all touched .ts/.tsx/.mjs files: exit 0.
- `git diff --check`: clean.
- Broader source sweep (`node --test` on all src/**/*.test.mjs): 1,635 tests; 1,630 passed, 4 failed, 1 skipped.

The four broad-suite failures are in unchanged baseline files:
1. `src/lib/databaseManagement/approvalUi.browser.test.mjs`: hardcoded external Playwright installation `/tmp/thoidai-approval-browser/node_modules/playwright/index.mjs` unavailable.
2. `src/lib/departmentPlanDocxExport.test.mjs`: direct Node import cannot resolve `server-only`.
3. `src/lib/permissionGroups.test.mjs`: expected labels omit the existing `Khác` group emitted for the catalog.
4. `src/lib/taskManagementUx.test.mjs`: source regex predates the existing CTV condition on canClaimTasks.

No dependencies were installed and unrelated tests/application behavior were not changed to hide these failures.

## Unverified

- Migration/postcondition/behavior/revert execution against PostgreSQL and full disposable dry-run (no local psql found; Docker/SSH/network excluded by owner).
- Browser visual/runtime checks, production build, real storage upload/download and live acceptance scenarios.
- Production activation and Git synchronization are deliberately not performed. Changes remain uncommitted in the requested worktree.

## Files

- `scripts/package-standalone.mjs`
- `scripts/production/projects-v1-1-dryrun.sh`
- `scripts/production/projects-v1-1-dryrun.test.mjs`
- `scripts/production/projects-v1-1-revert.sql`
- `scripts/production/projects-v1-1/post/20261103180000_projects_v1_1_deputy_library.sql`
- `scripts/standalone-packaging.test.mjs`
- `scripts/verify-standalone-artifact.mjs`
- `src/app/api/projects/[id]/library/download/[itemId]/route.ts`
- `src/app/api/projects/[id]/library/route.ts`
- `src/app/api/projects/[id]/members/route.ts`
- `src/app/api/projects/[id]/tasks/route.ts`
- `src/app/api/projects/route.ts`
- `src/app/projects/[id]/page.tsx`
- `src/components/CanonicalAssignmentForm.tsx`
- `src/components/ProjectCreateForm.tsx`
- `src/components/ProjectDetailShell.tsx`
- `src/components/ProjectLibrary.tsx`
- `src/lib/authorization.ts`
- `src/lib/collaboratorRole.mjs`
- `src/lib/collaboratorRoleCoverage.test.mjs`
- `src/lib/projectApi.test.mjs`
- `src/lib/projectApiGuards.ts`
- `src/lib/projectLibrary.test.mjs`
- `src/lib/projectLibrary.ts`
- `src/lib/projectLibraryRepository.ts`
- `src/lib/projectLibraryRoutes.test.mjs`
- `src/lib/projectRepository.ts`
- `src/lib/projectsV11.test.mjs`
- `src/lib/rbac/authorization.ts`
- `src/lib/rbac/types.ts`
- `src/lib/reviewerUploadContract.test.mjs`
- `src/lib/taskAttachmentPolicy.d.ts`
- `src/lib/taskAttachmentPolicy.mjs`
- `src/lib/taskHandlerFactory.ts`
- `src/lib/taskHandlers.ts`
- `src/lib/taskRepository.ts`
- `supabase/migrations/20261103180000_projects_v1_1_deputy_library.sql`
- `supabase/tests/projects_v1_1_behaviour.sql`
