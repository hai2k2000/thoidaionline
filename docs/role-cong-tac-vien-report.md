# Collaborator role implementation report

Source: feature/role-cong-tac-vien, base 6788a24. Offline RuleCodex snapshot used by owner instruction. No network, SSH, Docker, commit, push, or database mutation.

## Step 1: authorization map

- Navigation: src/components/phase2Navigation.ts getPhase2Navigation feeds AppNav (desktop/mobile). Attendance self, schedules, public evaluation summary, own assets and database were unconditional entries. src/lib/auth.tsx canAccessModule allowed HR/assets for ordinary staff; hasPermission mixes can_* booleans with catalog grants.
- Pages: server pages use getSessionUser and local role/permission checks; client pages use AuthProvider and layouts. /my-tasks was a legacy redirect to /tasks?type=personal. It now renders TasksPage for CTV. Other roles retain their legacy redirect.
- API: serverApi requireReadActor/requireMutationActor provide identity and same-origin validation; many routes use getSessionUser directly, while task routes delegate to taskHandlers/taskHandlerFactory. Public summary and machine endpoints do not uniformly use these helpers. The proxy therefore covers every API, including dotted URLs, before route execution; signed cookie and bearer identities resolve their current role from staff_users. Every non-allowlisted API for CTV returns 403 and every other application page redirects to /my-tasks. Static framework assets remain available.
- Legacy permissions: public.role_permissions contains can_manage_users, can_manage_permissions, can_create_task, can_edit_all_tasks, can_comment, can_assign_task, can_view_department_tasks, can_evaluate_step1/2, can_manage_rubrics. serverSession normalizes them into user.permissions. CTV has comment only, with manager status suppressed even if its job title is manager.
- RBAC v2: public.permissions is the catalog; role_permission_grants stores scopes; user overrides resolve through api_list_effective_permissions in src/lib/rbac/repository.ts. permissionCatalog.ts and permissionScopes.mjs define application catalog/scope validation. taskBasePermission maps progress/submission/attachments to task.view, comments to task.comment. Own account/password are session-authorized, with no separate catalog permission. CTV seeds only task.view/assigned and task.comment/assigned. Session output masks unrelated grants; the proxy remains authoritative even if an override exists.
- Task data: taskRepository.getTaskScopeTerms now restricts CTV to assignee_id, reviewer_id and task_assignees membership before either legacy or RBAC-v2 scope logic. Creator/owner alone and department grants cannot widen access. authorization.canTaskAction checks the same participant relationship and preserves existing workflow conditions for progress, submission, comments and attachments. Review/scoring/assignment/create/edit/cancel are denied.
- Attendance: attendanceVisibility.mjs now excludes role cong_tac_vien in addition to existing ctv job-title exclusions, including object/array role relations.
- Hard-coded role checks: taskReviewerPolicy contains leadership reviewer role codes and manager job-title fallback; CTV is not added to leadership. authorization has organization/read-only role sets and workflow-specific checks. phase2Navigation, auth.tsx, schedule/planning/journalism pages and APIs contain leadership lists. roleLevel is carried in AuthorizationActor and staff ordering; it is not an automatic CTV privilege. Existing non-CTV policy branches remain intact.
- Users discrepancy: this checkout has no seven-role assignment allowlist in /users. The form maps active database roles, and the API accepts role_id with lifecycle validation. The three-code admin/TBT/read-only list controls who can READ users, not which roles can be assigned. Thus the new database role is assignable without changing either list; regression tests cover the current dynamic contract.

## CTV allowlist

Pages: /my-tasks, /tasks/<UUID>, /account. Profile alias and every other application page redirect to /my-tasks.

APIs (existing per-resource/workflow checks still apply):
- GET /api/auth/session
- POST /api/auth/logout and /api/auth/mobile-logout
- PATCH /api/account/profile and /api/account/password
- POST, DELETE /api/account/avatar
- GET /api/tasks and /api/tasks/<UUID>
- POST /api/tasks/<UUID>/comments, attachments, progress-reports, submit-completion
- GET /api/tasks/<UUID>/attachments/<UUID>

Task completion remains limited to the primary assignee by existing workflow. Watchers/reviewers can view and comment; progress/upload follow existing participant mutation rules. Navigation contains only My Tasks and Account/logout, with a documented future Projects insertion hook. Creation, bulk print and print links are hidden for CTV; the progress form is exposed for authorized CTV participants.

## Migration and rollback

20261103150000_role_cong_tac_vien.sql idempotently seeds the role at level 1, legacy comment permission and exactly two assigned RBAC grants. Packager/verifier MIGRATION_REFERENCE includes it in identical order. The revert script locks staff_users and refuses if any active or inactive staff row references the role. No migration was applied.

## Changed files

- PROJECT_STATUS.md
- docs/role-cong-tac-vien-report.md
- scripts/package-standalone.mjs
- scripts/production/role-cong-tac-vien-revert.sql
- scripts/standalone-packaging.test.mjs
- scripts/verify-standalone-artifact.mjs
- src/app/my-tasks/page.tsx
- src/app/tasks/page.tsx
- src/components/AppNav.tsx
- src/components/TaskCenterShell.tsx
- src/components/TaskDetailShell.tsx
- src/components/phase2Navigation.ts
- src/lib/attendanceVisibility.mjs
- src/lib/auth.tsx
- src/lib/authorization.ts
- src/lib/collaboratorProxy.test.mjs
- src/lib/collaboratorRole.mjs
- src/lib/collaboratorRole.test.mjs
- src/lib/collaboratorRoleCoverage.test.mjs
- src/lib/serverSession.ts
- src/lib/taskRepository.ts
- src/proxy.ts
- supabase/migrations/20261103150000_role_cong_tac_vien.sql

## Complete denied API inventory

148 route files scanned; 13 allowlisted and 135 denied. All current and future API routes are covered by the /api/:path* proxy matcher.

- /api/assets
- /api/assets/[id]
- /api/assets/[id]/service-records
- /api/assets/import
- /api/assets/status-requests
- /api/attendance
- /api/attendance/anomalies
- /api/attendance/export
- /api/attendance/late-exception
- /api/attendance/sync
- /api/attendance/sync/complete
- /api/attendance/sync/fail
- /api/attendance/sync/pending
- /api/attendance/sync/realtime
- /api/attendance/sync/reconcile
- /api/attendance/sync/request
- /api/attendance/sync/status
- /api/attendance/workday-adjustment
- /api/auth/admin-reset
- /api/auth/admin-set-password
- /api/auth/forgot-password
- /api/auth/login
- /api/auth/mobile-login
- /api/auth/reset-password
- /api/database/catalog
- /api/database/records
- /api/database/records/[id]
- /api/database/records/[id]/acl
- /api/database/records/[id]/export
- /api/database/records/[id]/files
- /api/database/records/[id]/files/[fileId]
- /api/database/records/[id]/restore
- /api/database/records/[id]/workflow
- /api/department-managers
- /api/departments
- /api/documents
- /api/documents/[id]
- /api/download/workflow
- /api/duty-schedule
- /api/duty-schedule/summary
- /api/evaluation-rubrics
- /api/evaluations
- /api/evaluations/[id]
- /api/hr/profiles
- /api/hr/staff
- /api/hr/upload
- /api/job-titles
- /api/journalism/calendar
- /api/journalism/calendar/[id]
- /api/journalism/series
- /api/journalism/series/[seriesId]
- /api/journalism/series/[seriesId]/archive
- /api/journalism/series/[seriesId]/order
- /api/journalism/topics
- /api/journalism/topics/[topicId]
- /api/journalism/topics/[topicId]/archive
- /api/leave-requests
- /api/mobile/dashboard
- /api/mobile/push-token
- /api/my-assets
- /api/notifications
- /api/notify/doc-overdue
- /api/notify/due-soon
- /api/online-work
- /api/online-work-schedule
- /api/permissions
- /api/permissions/users/[userId]
- /api/permissions/users/[userId]/category-grants
- /api/permissions/users/[userId]/history
- /api/planning/bulk
- /api/planning/department
- /api/planning/department/[planId]/close
- /api/planning/department/[planId]/items
- /api/planning/department/[planId]/items/assign
- /api/planning/department/candidates
- /api/planning/department/create
- /api/planning/department/import
- /api/planning/department/import/confirm
- /api/planning/department/items/[itemId]
- /api/planning/department/items/[itemId]/assign
- /api/planning/department/items/[itemId]/quick-assign
- /api/planning/department/reports
- /api/planning/department/reports/docx
- /api/planning/department/reports/pdf
- /api/planning/department/template
- /api/profile/assets
- /api/public-evaluation-summary
- /api/reports/summary
- /api/reports/weekly
- /api/reports/weekly/add-work
- /api/reports/weekly/complete
- /api/reports/weekly/docx
- /api/reports/weekly/reopen
- /api/reports/work
- /api/task-recurrence/run
- /api/tasks/[id]/admin-edit
- /api/tasks/[id]/ai-evaluation
- /api/tasks/[id]/cancel
- /api/tasks/[id]/cancel-assigned
- /api/tasks/[id]/complete
- /api/tasks/[id]/deadline
- /api/tasks/[id]/deadline-assigned
- /api/tasks/[id]/evaluations
- /api/tasks/[id]/journalism
- /api/tasks/[id]/journalism/publication
- /api/tasks/[id]/journalism/publication-reconciliation
- /api/tasks/[id]/journalism/publication-report
- /api/tasks/[id]/journalism/publication-verification
- /api/tasks/[id]/journalism/series
- /api/tasks/[id]/journalism/topics
- /api/tasks/[id]/journalism/topics/[topicId]
- /api/tasks/[id]/personal
- /api/tasks/[id]/print/docx
- /api/tasks/[id]/review-completion
- /api/tasks/assign
- /api/tasks/bulk-cancel
- /api/tasks/bulk-print/docx
- /api/tasks/claim
- /api/tasks/claim/review
- /api/tasks/duty
- /api/tasks/duty/import
- /api/tasks/duty/review
- /api/tasks/evaluate
- /api/tasks/journalism/assign
- /api/tasks/personal
- /api/tasks/quick-report
- /api/tasks/quick-report/summary
- /api/tasks/quick-report/summary/docx
- /api/tasks/report
- /api/tasks/review
- /api/users
- /api/users/name
- /api/work-schedule
- /api/work-schedule/events
- /api/work-schedule/personal

## Validation

- Targeted node:test, navigation/authorization/attendance and standalone packaging: 58/58 PASS (including proxy runtime test).
- npm run migration:test: 24/24 PASS (offline mocked migration-runner suite).
- TypeScript: npx.cmd --offline tsc --noEmit PASS.
- Changed-file ESLint: zero errors; existing component warnings recorded in final response.
- git diff --check: PASS.
- Not validated: live database SQL application/idempotency/rollback, browser E2E, production service health or standalone production build. No network/database credentials were used. Source remains uncommitted as explicitly requested.
