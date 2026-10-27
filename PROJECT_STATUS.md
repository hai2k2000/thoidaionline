# Authentication Reliability Fix

Current Phase: implementation complete; pre-production validation
Current Task: preserve exact password input and distinguish auth backend failures

Completed:
- Removed password trimming from web/mobile login and credential verification.
- Added a safe 503 response for credential lookup, password-verifier, or legacy-upgrade failures instead of reporting a false password mismatch.
- Added regression coverage for exact password preservation, bcrypt behavior, and temporary auth failures.

Validation:
- Focused authentication tests: 11/11 PASS.
- TypeScript and changed-file ESLint: PASS.
- `git diff --check`: PASS.

Production safety:
- Production database, active release, service, and credentials unchanged.
- No migration, restart, or activation performed.

Next:
- Commit and push the feature branch; owner approval is required before any production deployment.

# Weekly Report Quick Work Final Blockers

Current Phase: final source checkpoint
Current Task: commit and push the runtime and packaging fixes

Completed:
- Traced the weekly API failure to participant task requests containing 500 UUIDs, which returned HTTP 431 before the API mapped the failure to `operation_failed`.
- Reduced participant ID batches to 100 while preserving stable task and assignment ordering.
- Aligned the database window with the existing open-ended task rule so tasks with a period start and NULL due date remain eligible.
- Added a packaging file policy that removes `.env*` files before approved runtime environment symlinks are created.
- Kept the secret scanner fail-closed for environment files, populated runtime secrets, and private keys.

Validation:
- Focused weekly report and artifact policy tests: 76/76 PASS.
- Changed-file ESLint and `git diff --check`: PASS.
- Isolated PostgREST reproduced HTTP 431 with 500 UUIDs and passed seven 100-ID batches.
- Native session weekly API: HTTP 200 with 601 eligible rows, including the in-period REPORT_ONLY row.
- Save, refresh, complete, immutable snapshot, and DOCX content: PASS.
- Linux-compatible Next standalone build and artifact secret scan: PASS.

Production safety:
- Production database, active release, service, and rollback pointers unchanged.

Next:
- Commit and push the feature branch, package the clean source SHA, and run VPS verify-only.

# Thoidai Work3 PR #6 Final Review & Fix

## Trusted RBAC V2 readiness evidence producer

Current Phase: bounded implementation complete; owner review pending
Current Task: close the G1 trusted-producer blocker without consuming the activation waiver

Completed:
- Added a root-only, fail-closed producer for fresh backup integrity, disposable restore, migration ledger, schema/RPC, grants parity, and last permission manager evidence.
- Bound readiness output to the exact canonical commit, approved migration checksums, a private root-owned output directory, and a 30-minute expiry.
- Refused list-only restore claims and missing database connectivity; packaged and verified the producer in the standalone artifact.
- Corrected the last-manager `RETURNS void` invocation, exact protected-RPC signature/ACL checking, and disposable restore verification against a real PostgreSQL 17 target with application data and migration-ledger comparison.

Validation:
- Producer contract tests: 2/2 PASS.
- Standalone packaging tests: 12/12 PASS.
- Node syntax and `git diff --check`: PASS.

Production safety:
- No production database, grants, users, releases, service, symlinks, timers, or waiver registry changed.

Next:
- Run the complete local focused validation, push one bounded PR, and wait for owner merge approval before generating fresh production readiness evidence.

## Controlled RBAC V2 deployment exception

Current Phase: bounded implementation complete; owner review pending
Current Task: one-time authenticated-smoke waiver for the exact approved canonical artifact

Completed:
- Added an opt-in, exact-SHA, time-bounded owner approval contract with atomic one-time consumption.
- Added fail-closed readiness attestation for fresh backup/restore, migration, schema/RPC, grants parity, and last-manager evidence before pointer mutation.
- Restricted exception identifiers, registry metadata, and approval lifetime with negative regression coverage.
- Kept backup, migration, grants, rollback, disk, lock, provenance, and health gates unchanged; normal deployments still require authenticated smoke.
- Packaged and verified the validator in the standalone artifact and added secret-free `AUTHENTICATED_SMOKE=WAIVED` evidence plus a manual post-activation checklist.

Validation:
- Focused exception, deploy-gate, external-artifact, and standalone packaging tests: 40/40 PASS.
- TypeScript, changed-file ESLint, route manifest, and `git diff --check`: PASS.
- Ubuntu deployment/rollback fixtures, production-like build, packaging, and artifact round-trip: PASS in PR CI.
- Production code/database/grants/releases/service: unchanged.

Next:
- Review and merge the single PR, then generate a new canonical artifact. Do not activate this branch or reuse an older artifact.

## RBAC V2 SQL Scope Ambiguity Hotfix

Current Phase: hotfix complete; owner merge review pending
Current Task: PR #18 `codex/rbac-v2-scope-hotfix`

Completed:
- Added `20261015110000_rbac_v2_scope_ambiguity_fix.sql` without modifying the historical RBAC V2 migration.
- Disposable PostgreSQL 17 + PostgREST regression reproduced `42702` before the hotfix and verified HTTP 200, scope values, deny precedence, ACL/owner, invalid actor rejection, and safe-runner `ALREADY_APPLIED` after it.
- Updated standalone migration references, verifier, packaging regression, workflow, and migration-first runbook.
- Opened PR #18: https://github.com/hai2k2000/thoidaionline/pull/18

Production safety:
- Production database, grants, users, releases, service and symlinks unchanged.
- PR #16 remains open and is not modified by this hotfix.

Validation:
- Local focused tests: 34/34 PASS; syntax and `git diff --check`: PASS.
- GitHub push CI `38393856284`: PASS.
- GitHub PR CI `38394385427`: PASS, including disposable PostgreSQL/PostgREST regression, packaging, TypeScript, ESLint, route manifest, and artifact round-trip.
- Migration SHA-256: `57A364FDC845C31740518530BB801CD53DEA2B4E12CD2753CEB92E58FC19578A`.

Next:
- Owner review and separate approval to merge PR #18; do not apply migration or deploy production.

## RBAC V2 Role Matrix and User Overrides

Current Phase: implementation complete; pre-production owner review
Current Task: feature branch validation and PR handoff

Completed:
- Added catalog-driven role matrix and per-user inherit/allow/deny management on top of the existing RBAC tables.
- Centralized effective permission resolution with inactive-user, inactive-role, deny precedence, scope, audit, self-elevation, and last-manager protections.
- Added additive migration and idempotent RPC contracts without creating new permissions or grants.
- Preserved legacy Quick Report and asset compatibility wrappers while enforcing the canonical resolver server-side.

Validation:
- Focused RBAC/UI/route: 45/45 PASS; broad RBAC/permission subset: 85/85 PASS.
- Migration runner: 24/24 PASS; local embedded PostgreSQL full-chain rehearsal and second RBAC V2 migration application: PASS.
- TypeScript, changed-file ESLint, route manifest, git diff check, and production-like build: PASS.
- Local disk gate: 27,792,584,704 free bytes against a 21,474,836,480-byte floor.

Production safety:
- Production changed: NO.
- Database/grants changed: NO.
- Migration applied: NO.
- Production deployed/restarted: NO.

Next:
- Push the feature branch and open the owner-review PR targeting `integration/production`; stop before merge, migration, or deployment.

Final review fixes:
- Self-role permission replacement rejects new or broader effective scopes while allowing narrowing and removal.
- Rollback compatibility rejects legacy-union widening caused by role grants plus narrow direct allows, in addition to explicit denies.
- Local pre/post migration evidence: 20 permissions, 29 role grants, and 0 user grants on both sides; no role-plus-direct-allow cases existed to reconcile.
- Latest `integration/production` was merged without conflicts or history rewrite.

Current Phase: COMPLETE; owner merge review
Current Task: Asset UI permission management final review

Completed:
- Corrected effective permission semantics: active user plus active role inheritance or direct grant; persisted grant sources remain separately visible.
- Added inactive-user UI state and blocked new grants while preserving safe direct-grant revoke cleanup.
- Kept inactive roles non-actionable in UI and server RPC; asset.view remains read-only.
- Added behavioral coverage for inactive users/roles, direct and role grants, combined sources, and revoke-source semantics.
- Migration remains additive/idempotent, service-role-only, audit-backed, and does not auto-grant permissions. Timestamp 20261014100000 follows the existing 20261013 V2.3 migration ordering.

Validation:
- Focused Asset/RBAC/UI: 41/41 PASS.
- TypeScript: PASS.
- Changed-file ESLint: PASS (migration SQL ignored by ESLint configuration).
- git diff --check: PASS.
- Route manifest: PASS.
- Safe migration tests: 24/24 PASS.
- Disposable PostgreSQL full-chain rehearsal: PASS.
- Production-like build: PASS with canonical lineage 07a96b6a9bd62f4367bac905656b8b4293279864.
- Full legacy suite: 1179 PASS / 31 FAIL / 1 skipped; failures match the recorded pre-existing baseline and are outside this PR.

Production safety:
- Production changed: NO.
- Database/grants changed: NO.
- Migration applied: NO.
- Production deployed/restarted: NO.
- Disk free during build gate: 21 GiB; hard floor 20 GiB respected.

Next:
- Commit and push the final review fixes, update PR #6, then stop for owner merge review. Do not merge, migrate, deploy, restart, or alter production grants.

# Personal Quick Report Summary

Current Phase: implementation complete; pre-production owner review
Current Task: self-service REPORT_ONLY summary and Word export

Completed:
- Added permission-gated personal Quick Report summary with week, month, and custom date filters.
- Added self-only server query and bounded Word export over canonical tasks.report_work_date data.
- Preserved existing Quick Report create flow, Attendance entry, and management Work Report.

Validation:
- Focused Quick Report, authorization, Attendance, Work Report, and summary/export regressions: PASS.
- TypeScript, changed-file ESLint, route manifest, and git diff --check: PASS.
- Production-like build: BLOCKED by stale local integration/production ref; no lineage override used.

Production mutation: NONE.

Next:
- Refresh the clean canonical integration baseline, rerun the production-like build, then owner review; do not deploy automatically.

## Department Period Report Word Export

Current Phase: COMPLETE; implementation and pre-production validation
Current Task: Word-only period report export

Completed:
- Replaced Department Period Report UI export action with the authenticated DOCX route while preserving selected period, department, and filters.
- Implemented editable Word report structure with sections I–IV, real report rows, Vietnamese text, and approved filenames.
- Preserved existing PDF backend files and unrelated Department Plan business logic.

Validation:
- DOCX exporter regression: 5/5 PASS.
- Department Plan focused regression: 130 PASS, 1 pre-existing bundle check skipped.
- TypeScript, changed-file ESLint, git diff --check, route manifest, and production-like build: PASS.
- Sample DOCX opened successfully in Microsoft Word; PNG renderer unavailable because VPS has no LibreOffice and local renderer lacks pdf2image in its default Python.

Production mutation: COMPLETE — immutable artifact activated and health-checked.

# Department Plan Real + Multi-Assignment V2 Blocker Closure

- Phase A completed: canonical leadership-mapped assignee eligibility is aligned with the existing assignment scope, and successful assignment responses rehydrate linked Task participants/status before reaching the UI.
- Focused Department Plan/leadership/task assignment regressions: PASS.
- TypeScript, changed-file ESLint, route manifest, git diff --check, disposable PostgreSQL migration rehearsal, and production-like webpack build: PASS.
- Production mutation: NONE.

## Admin Quick Report Permission Management

Current Phase: implementation complete; pre-production owner review
Current Task: role-based grant/revoke for task.quick_report.create

Completed:
- Added admin-only role grant/revoke through the existing permission.manage capability.
- Reused role_permission_grants and audit_logs; no user or department grant subsystem was added.
- Added exact Vietnamese Quick Report permission metadata and lightweight revoke confirmation.
- Added additive migration 20261001100000_admin_quick_report_permission_management.sql.

Validation:
- Focused permission/Quick Report/Task/Global Mutation regression: PASS.
- Disposable PostgreSQL schema and RPC rehearsal: PASS; migration applied twice; idempotent grant/revoke and audit verified.
- Production remains untouched.

Next:
- Owner review; no production migration, permission change, deploy, or restart.
## Department Plan V2 Checkpoint 9B

Current Phase: COMPLETE; canonical assignment dialog + atomic Plan-to-Task V2
Current Task: Checkpoint 9B closed without production deployment

Completed:
- Added shared Department Plan assignment dialog using `CanonicalAssignmentForm`.
- Added persisted-item prefill and dirty-item guard.
- Added additive `api_assign_department_plan_task_v2` migration contract with row lock, canonical `api_assign_task_v2` reuse, and one-link protection.
- Added Department Plan assignment endpoint and linked/unlinked UI actions.
- Recurrence, batch creation, and attachments are disabled in this one-item dialog.

Validation:
- Focused CP9B + affected Department Plan/canonical Task regression: 160/160 PASS.
- Migration syntax and runtime idempotency validation in an ephemeral PostgreSQL container: PASS.
- TypeScript: PASS.
- Touched-file ESLint: PASS.
- Production-like build and route manifest: PASS.
- git diff --check: PASS.

Production mutation: NONE.

Next:
- Owner review and separately authorized production rollout; CP9B does not deploy automatically.

## Department Plan V2 Checkpoint 9A

Current Phase: COMPLETE; reusable canonical assignment form
Current Task: Checkpoint 9A — extracted form and preserved Task assignment behavior

Completed:
- Extracted the recipient-first canonical Task assignment form into `src/components/CanonicalAssignmentForm.tsx`.
- Kept TaskAssignShell responsible for page layout, API submission, notifications, attachment upload, and redirects.
- Added compatible `initialValues`, caller-owned `onSubmit`, optional `onCancel`, field validation, scope/picker behavior, participant selectors, priority, due dates, recurrence, and batch payload normalization.

Validation:
- Focused extraction and assignment regression: PASS.
- TypeScript: PASS.
- Touched-file ESLint: PASS.
- Route manifest: PASS.
- Production-like build: PASS with build-only production environment and lineage overrides.
- git diff --check: PASS.

Production mutation: NONE.

Next:
- Checkpoint 9B only after owner approval; no Department Plan integration was started.

## Department Plan V2 Final Integration Gate

Current Phase: FINAL INTEGRATION & PRODUCTION ROLLOUT GATE
Current Task: BLOCKED before production mutation — authorized authenticated production smoke evidence unavailable

Final Integration: c0769ee merged from active production f5d9b66 through CP1-CP8 source dfaf753; release metadata fix 6d5aa4f includes CP1/CP6 migration references.
Pre-deploy validation: Department Plan 73/73, affected regression 229/229, TypeScript, ESLint, route manifest, production-like build, standalone artifact verification PASS.
Production mutation: NONE — migration and activation intentionally stopped pending authorized authenticated smoke.

# Production Smoke Cleanup + Recipient-First Compact Picker

## Department Plan V2 Checkpoint 6

Current Phase: COMPLETE; Plan-to-Task V1 implementation
Current Task: closed without deployment

Completed:
- Added explicit authenticated Plan Item -> canonical Task conversion.
- Reused the canonical api_assign_task_v2 RPC; no parallel Task creation path.
- Added transactional item lock, one-to-one link protection, idempotent retry behavior, audit origin, and non-destructive Task delete semantics.
- Added linked Task state and the "Mở công việc" action to the item detail dialog; unsaved edits block conversion.

Validation:
- CP1–CP6 focused tests: 40/40 PASS.
- CP6 focused tests: 19/19 PASS.
- Required Task/Plan/Approval/Event Assignment/Journalism/Personal Plan/Attendance subset: 232/232 PASS after excluding one pre-existing unrelated Task Center UX assertion.
- TypeScript: PASS.
- Touched-file ESLint: PASS.
- Route manifest: PASS.
- Production-like build with lineage and production env overrides: PASS.
- Migration validation: PASS in a rolled-back development DB transaction; post-rollback schema unchanged.
- git diff --check: PASS.

Mapping:
- Title, description, requirements, department, assignee, and due date map from persisted item data.
- assigned is supported; unassigned and department_wide are rejected because canonical Task creation requires an assignee.
- Canonical Task default status/priority remain authoritative; no background synchronization.

Blockers:
- No CP6 implementation blocker.
- Full repository suite still contains pre-existing unrelated UX assertions on this older CP1 branch; no CP6 files cause those failures.

Next:
- Owner approval for Checkpoint 7; production remains untouched.

Current Phase: COMPLETE; pre-production validation
Current Task: closed without deployment

Completed:
- Audited the four 2026-09-25 smoke staff accounts, their foreign-key references, smoke-only tasks, batch idempotency row, and credential usage.
- Created and checksum-verified /opt/thoidai-work/backups/smoke-cleanup-20260926T041807Z before cleanup.
- Deleted three smoke staff rows, deactivated the smoke manager while preserving one historical work-schedule approver reference, reassigned Phòng Nội dung to the active real manager, and deleted four disposable smoke tasks plus their smoke-only dependencies.
- Securely removed the unused /root/.secrets/thoidai-work/journalism-smoke-accounts.json credential file after confirming no runtime references.
- Replaced the permanent recipient card grid on /tasks/assign with an interaction-only searchable combobox, inline scope, collapsed selected state, and preserved task-card state.

Validation:
- Targeted recipient, batch, approval, Journalism, Event Assignment, Personal Plan, Attendance, and Task Summary regressions: 123/123 PASS.
- TypeScript: PASS.
- Touched-file ESLint: PASS.
- Production build with lineage environment override for the isolated feature branch: PASS; required route manifest PASS.
- Production service remained on commit 36e0f47ba0c402d73741ef865f446b38424bf65a; no deployment or restart performed.
- Source committed and pushed as a39f75c4026ded4ce4e3894efcad9b2ff976ebf5 on codex/compact-recipient-picker.
- Unauthenticated browser check: /tasks/assign redirects to /login; authenticated browser smoke was not run because no authorized live test session/credentials remained after cleanup.

Blockers:
- No implementation or data-integrity blocker.
- Authenticated browser smoke remains owner-verification follow-up before any deployment.

Next:
- Separately authorize any deployment and authenticated browser verification.

# Journalism J6G Status

Current Phase: J6G implementation complete; pre-production validation
Current Task: Manual Publication Reconciliation, focused tests, and immutable artifact without activation

Completed:
- Added scoped reconciliation route/RPC with mandatory reason and optimistic report version.
- Preserved report identity, original reporter, and append-only J6E verification history.
- Added dedicated audit action and Journalism Task detail action; MasterCMS and unrelated modules remain disconnected.

Validation:
- J6G + J6D/J6E/J6F/task-detail focused regression: 31/31 PASS.
- TypeScript: PASS.
- ESLint: PASS.
- Production build: PASS (existing HR upload tracing warnings only).

Blockers:
- No implementation blocker; production migration/deploy intentionally not performed.
+
## Department Plan V2 Checkpoint 7

Current Phase: COMPLETE; Department Plan V2 Reports
Current Task: Checkpoint 7 — read-only reports

Completed:
- Added canonical weekly/monthly Department Plan report page at /planning/reports.
- Added server-authorized read-only API at /api/planning/department/reports.
- Added server-side employee, work-status, and assignment-state filters with the existing Department Plan scope.
- Added authoritative metrics for total, completed, in progress, planned, overdue, unassigned, and department-wide items.
- Preserved lazy plan reads; report requests never create plan containers or Tasks.

Validation:
- CP7 focused tests: 21/21 PASS.
- Department Plan CP1–CP7 tests: 68/68 PASS.
- Affected regression: 354/358 PASS; four known pre-existing failures remain in J5C/J5D and leave/attendance tests.
- Full source suite: 686/712 PASS; 26 known pre-existing failures remain on this older CP1 branch.
- TypeScript: PASS.
- Touched-file ESLint: PASS.
- Route manifest: PASS.
- Production-like build with lineage and production env overrides: PASS.
- git diff --check: PASS.

Status mapping:
- planned -> planned metric.
- in_progress -> in-progress metric.
- completed -> completed metric and never overdue.
- cancelled -> final state, excluded from overdue.
- unassigned and department_wide remain separate assignment metrics.

Blockers:
- No CP7 implementation blocker.
- Production remains untouched; PDF export is intentionally deferred to Checkpoint 8.

Next:
- Owner approval for Checkpoint 8 — PDF Export. Do not begin Checkpoint 8 automatically.


Next:
- Owner review and separately authorized production deployment.

# Event Assignment v1 Status

Current Phase: Implementation complete; pre-production review
Current Task: Event Assignment v1 implementation, tests, and immutable artifact prepared without activation

Completed:
- Read repository AGENTS.md and RuleCodex.
- Inspected live schema read-only and selected additive work_schedules plus normalized assignment architecture.
- Created and pushed branch feature/event-assignment-v1.
- Created design spec and implementation plan.
- Implemented validator, additive migration/RPCs, dedicated API, repository reads/writes, leadership UI, reporter calendar projection, and audit actions.

Validation:
- Event Assignment and existing focused regressions: 63/63 PASS.
- TypeScript: PASS.
- Scoped ESLint: PASS.
- Production build: PASS.
- Migration reviewed statically; production schema verified reverted to pre-feature state after an earlier transient smoke-test mutation.

Artifact:
- Created `/opt/releases/thoidai-work/3e84274-event-assignment-v1-20260921T150918Z`.
- BUILD_ID, package.json, node_modules, runtime environment links, and release metadata validated.
- Artifact activation and migration application are explicitly out of scope.

Blockers:
- No implementation blocker.
- Production deployment requires separate owner authorization and migration review.

Next:
- Owner review of migration and artifact before a separately authorized production deployment.

# Work Assignment Print Redesign Status

Current Phase: bounded print-layout redesign complete; pre-production validation
Current Task: artifact verification and owner review

Completed:
- Redesigned `/tasks/[id]/print` as an A4 portrait, grayscale-friendly assignment form.
- Preserved server-side authorization and `TaskDetailDto` as the only data source.
- Updated owner/assignee mapping and excluded watchers from collaborators.
- Removed code, priority, watcher, and old footer fields; kept required signatures and print controls.

Validation:
- Print, Journalism print, Task Summary, and authorization regressions: 23/23 PASS.
- TypeScript: PASS.
- Canonical baseline guard: PASS.
- Required-route guard: PASS.
- Production build: PASS.
- Standalone artifact verification: PASS.

Blockers:
- None. Production deployment intentionally not performed.

Next:
- Owner review and separately authorized production deployment.

# Task Assignment Semantics Status

Current Phase: implementation complete; pre-production validation
Current Task: structured assignment origin, semantic display, and non-deployed artifact

Completed:
- Added additive `assignment_source` with controlled values `leadership_assigned`, `self_registered`, and `legacy_unknown`.
- Added approval actor fields populated from existing task status events; creator data remains unchanged.
- Updated Task Summary, Task Detail, approval queues, and Work Assignment Print to distinguish self-registered work and leadership assignment.
- Added source filter and blocked employee completion actions while `pending_review`.
- Added migration, focused tests, and artifact metadata references without applying production changes.

Validation:
- Targeted task/approval/print/filter tests: PASS.
- Journalism, Event Assignment, Personal Plan, Online Work, Attendance regressions: PASS.
- TypeScript, canonical baseline, route manifest, and production-like build: PASS.
- Touched-file lint: 0 errors; existing Task Detail warnings remain.

Blockers:
- No implementation blocker; production migration/deploy intentionally not performed.

Next:
- Commit/push source and create the non-deployed standalone artifact for owner review.

# Release Regression Hardening

Current Phase: implementation complete; integration validation
Current Task: merge onto integration/production, build and artifact verification

Completed:
- Added production ancestry and integration-branch guard.
- Added authenticated API contract inventory/shape validation.
- Added read-only schema, migration-state, and PostgREST checks.
- Added artifact provenance fields and verification requirements.
- Added cache permission guard, disk/deploy lock, atomic activation, and application rollback helpers.
- Added authenticated GET contracts for Journalism topics and series list APIs.

Validation:
- Hardening focused tests: 17/17 PASS.
- npm exec tsc --noEmit: PASS.
- Production unchanged: YES.

Blockers:
- Feature branch intentionally fails release guard until merged into integration/production.
- Authenticated contract smoke and live schema checks require secure runtime credentials/config; no credentials were created or exposed.
- Existing production cache path is root-owned; guard will fail until release activation provisions service-owned cache.

Next:
- Commit/push implementation branch, merge into integration/production, run baseline/route/lint/build and package verification.

# Release Regression Hardening Result

Current Phase: COMPLETE; no production deployment requested
Current Task: closed

Implemented:
- Dynamic current-production ancestry guard and mandatory `integration/production` release source.
- Authenticated API contract inventory with valid empty-list response-shape checks.
- Read-only database schema, migration-state, and PostgREST visibility guards.
- Artifact provenance equality fields and standalone verification.
- Disk guard, deploy lock, atomic activation, cache ownership guard, and application-only rollback helper.
- Journalism topics/series authenticated GET list routes using the existing repository and scope checks.

Validation:
- Hardening focused tests: 17/17 PASS.
- TypeScript: PASS.
- ESLint: PASS.
- Required-route manifest: PASS.
- Production build with production env: PASS.
- Standalone artifact verification: PASS; `/opt/build/thoidai-work/release-regression-hardening-final2` (~81MB).
- Canary `/login`: HTTP 200; unauthenticated protected APIs correctly return 401.

Evidence:
- Current production commit: `e72e4969a0fd20f176bb906f4f2203d58f30a74e`.
- Canonical integration branch: `integration/production` at `77b08a0`.
- Confirmed current runtime issue: `.next/cache` is `root:root`, causing service-user EACCES on image cache writes; activation guard now fails closed and provisions service ownership for new releases.

Blockers:
- No smoke account credentials were created or exposed, so authenticated live contract smoke remains not-run.
- Production unchanged.

Follow Up:
- Owner may separately authorize a controlled deployment and service-cache ownership normalization.

## Department Plan Quick Assign V1

Feature branch: `feature/department-plan-quick-assign-v1`
Migration: `20261001120000_department_plan_quick_assign_v1.sql`

Implemented:
- Added an atomic, service-role-only Department Plan quick-assign RPC.
- Reused `department_plan_items.linked_task_id` and canonical `api_assign_task_v2`.
- Added compact assignee/due date/due time/priority/note UI and linked Task status projection.
- Preserved normal `STANDARD` Task workflow, Task Approval, and Global Mutation Policy semantics.

Validation:
- Quick Assign focused tests: 6/6 PASS.
- Department Plan checkpoint/navigation/report/PDF regressions: PASS.
- Task Assignment, Task Approval, creator mutation, admin edit, and Global Mutation Policy regressions: PASS.
- TypeScript: PASS.
- Changed-file ESLint: PASS.
- Required-route manifest: PASS.
- `git diff --check`: PASS.
- Disposable production-compatible PostgreSQL rehearsal: PASS; valid assignment, duplicate rejection, cross-department rejection, and unauthorized actor rejection verified.

Safety:
- Production unchanged: NONE.
- Migration not applied to production.
- Feature branch intentionally fails the release lineage guard until merged into `integration/production`.

## Department Plan V2 Checkpoint 8

Current Phase: COMPLETE; Department Plan PDF export
Current Task: Checkpoint 8 — server-side PDF export, pre-production validation

Completed:
- Added an authenticated, read-only `GET /api/planning/department/reports/pdf` endpoint backed by the shared CP7 authorization and report repository.
- Added A4 landscape PDF output with embedded DejaVu Sans Unicode fonts, Vietnamese text support, weekly/monthly period labels, active filters, CP7 metrics, detail rows, empty state, repeated headers, page numbers, and safe filenames.
- Added a client-only `Xuất PDF` action that preserves current period, department, employee, status, and assignment filters without mutating report state or creating records.
- Added the DejaVu font license alongside bundled font assets.

Validation:
- CP8 focused tests: 5/5 PASS; CP1–CP8 Department Plan tests: 73/73 PASS.
- TypeScript: PASS.
- Touched-file ESLint: PASS.
- Required-route manifest: PASS.
- Production-like build with lineage and production env overrides: PASS.
- Representative weekly, monthly, filtered, empty, Vietnamese-heavy, and 45-row multipage PDFs generated in `/tmp`; all had valid `%PDF-` signatures and multipage output reached 4 pages.
- `git diff --check`: PASS.

Safety:
- Report/PDF path is GET-only and read-only; no DB migration, Task mutation, export storage, scheduler, email, or production activation was performed.
- Production remains untouched; no restart or deployment performed.

Next:
- Owner review and separately authorized integration/deployment checkpoint.
## Quick Report UX V2

Current Phase: implementation complete; pre-production owner review
Current Task: unified date-only Quick Report form

Completed:
- Replaced the single/batch tabs with one unified form containing one row by default, add/remove row controls, and one atomic submit path.
- Replaced user-entered HH:mm fields with start/completion dates; same-day completion is valid, completion before start is rejected, and in-progress rows may omit completion date.
- Preserved REPORT_ONLY workflow, self-report authorization, user/role permission checks, max 50 rows, idempotency, reporting visibility, and approval isolation.
- Added a minimal additive RPC replacement migration to validate date-only rows and retain existing task storage.

Validation:
- Focused Quick Report/date/UI/server/reporting tests: 17/17 PASS.
- RBAC, mutation, approval, and Task Center regressions: 31/31 PASS.
- TypeScript, changed-file ESLint, route manifest, and git diff check: PASS.
- Direct production-like Next build with production environment: PASS.
- Disposable PostgreSQL function rehearsal: PASS; no production mutation.

Blockers:
- The normal build preflight cannot pass in this worktree because its local `integration/production` branch is stale at `4ca39fd`; canonical `origin/integration/production` and this branch base are `b56d0df`.

Production mutation: NONE.

Next:
- Refresh the local integration ref in a clean integration worktree, rerun the normal lineage-gated build, then owner review.


# Department Period Plan V2 — 2026-10-03

Current Phase: COMPLETE — implemented and deployed
Current Task: Department Period Plan V2

Completed:
- Added additive period metadata, close snapshots, carry-forward fields, and Task × Plan-period unique index.
- Added bounded candidate scan, preview/confirm creation, manual/import preview, user/task matching signals, auto-link hooks, close RPC, and DOCX export.
- Applied migration 20261003100000_department_period_plan_v2 after production backup; rehearsal and invariant validation passed.
- Deployed immutable release department-period-plan-v2-a323414 with rollback pointers preserved.

Validation:
- Department Period Plan V2 targeted tests: PASS (3/3).
- Department Plan/Work Report/Quick Report/task approval regression set: 126/127 PASS; one pre-existing stale Quick Report UI contract assertion remains unrelated.
- TypeScript: PASS; changed-file ESLint: PASS; production-like build: PASS; standalone artifact: PASS.
- Production service active, NRestarts=0, /login=200, protected routes return 401/307, cache ownership PASS.
- Authenticated live smoke: NOT VERIFIED (no authenticated session supplied).

Blockers:
- none for deployment.

Follow Up:
- Expand the DOCX parser for additional department-specific Word layouts and add an authenticated end-to-end browser smoke when a session is available.

Next:
- Monitor release and rollback pointers; keep current/previous/rollback-2 retention.


## Department Plan Canonical Saturday-Friday Week

Current Phase: implementation and production validation
Current Task: fix Department Plan weekly boundary from Monday-Sunday to Saturday-Friday

Completed:
- Confirmed live source and database constraints were both Monday-based.
- Changed the shared Department Plan helper and Excel fixtures to Saturday-Friday.
- Added explicit `plan_id` loading so historical plans keep their stored dates and remain scoped.
- Added additive migration 20261004100000_department_plan_saturday_friday.sql; no historical rows are rewritten.

Validation:
- Focused Department Plan regression: 33/33 PASS.
- Migration rehearsal on restored disposable PostgreSQL database: PASS.
- Production backup created before migration: /opt/thoidai-work/backups/department-plan-saturday-friday-pre-20261004T020238Z.dump.
- Production migration applied and schema/history checks: PASS.

Blockers:
- none

Next:
- Build/package immutable release, run artifact and smoke checks, then activate production.

## Admin Attendance Note + Weekend Filter

Current Phase: implementation complete; pre-production owner review
Current Task: separate Admin attendance notes and hide standard weekend rows

Completed:
- Added the scoped `attendance_admin_notes` table and service-role-only admin upsert RPC with canonical admin authorization and audit history.
- Added Attendance API/UI support for notes on existing logs and weekday workdays without an attendance log, without modifying attendance punch/status/device fields.
- Excluded Saturday and Sunday from standard Attendance rows, generated rows, summaries, counts, pagination, and empty states while preserving database records.

Validation:
- Focused Attendance, Wise Eye, late-work exception, access, merge, and weekend/admin-note tests: 48/48 PASS.
- Disposable PostgreSQL migration rehearsal, including repeat/idempotency run and privilege checks: PASS.
- TypeScript, changed-file ESLint, route manifest, and git diff check: PASS.

Production mutation: NONE.

Next:
- Complete the canonical lineage-gated production-like build, then push this feature branch for owner review; do not deploy in this phase.

## Weekly Report Add Work

Current Phase: implementation
Current Task: Task 3 - draft UI add/remove flow

Completed:
- Approved bounded design and implementation plan.
- Created isolated branch from weekly-report reopen/versioning commit 8a94e2b.
- Added pure addable-row filtering and server allow-list model contracts.
- Added server-scoped addable rows, draft allow-list validation, and a bounded REPORT_ONLY add-work route.

Validation:
- Task 1 focused model tests: 19/19 PASS.
- Task 2 focused server + weekly report regressions: 48/48 PASS.
- Production unchanged.

Blockers:
- None.

Next:
- Add draft-only UI controls for existing Task selection, sudden work, and removal.

- Task 3 UI add/remove controls committed as 9b3e47a.
- Task 4 Version 2/DOCX/Personal Plan coverage added; full regression set currently 118/118 PASS.
- No migration added; production unchanged.
- Final source gates pass; canonical `npm run build` is blocked by the repository lineage guard on the feature branch, and standalone packaging is blocked by Windows symlink permissions in this local environment.

## Asset Management V2.2 — Phase 1

Current Phase: implementation complete; pre-production owner review
Current Task: user filter, my-assets scope, and bounded status-change approval workflow

Completed:
- Added additive `asset_status_change_requests` schema with bounded statuses, one pending request per asset, expected assignment/status snapshots, service-role RPCs, transactional approval re-check, and asset audit actions.
- Added server-session APIs for `/api/my-assets` and `/api/assets/status-requests`; employees cannot directly mutate `assets.status`, and requests are restricted to their active direct assignment.
- Added `/my-assets`, admin `/assets/status-requests`, current assignee/shared/unassigned filters, and permission-driven navigation labels.
- Q3 data and production database were not changed.

Validation:
- Focused asset/API/repository/navigation/V2.1 regression: 20/20 PASS.
- V2.2 source-contract tests: 2/2 PASS.
- TypeScript: PASS.
- Changed-file ESLint: PASS.
- Production-like build with lineage environment override: PASS; route manifest includes all new routes.

Production mutation: NONE. Migration rehearsal against disposable PostgreSQL remains the final pre-owner gate; no production migration, deploy, restart, or Q3 re-import was performed.

Blockers:
- No implementation CRITICAL/HIGH blocker.

Next:
- Owner review; separately authorize disposable migration rehearsal/production rollout only after approval.

## Asset Management V2.2 — Owner Review Fixes

Current Phase: owner-review fixes complete; pre-production deployment review
Current Task: close bounded review findings before production

Completed:
- Self-service `/my-assets`, `/api/my-assets`, and request creation now require only an authenticated active session and remain server-scoped to the actor's current direct assignments.
- Navigation exposes `Tài sản của tôi` to every authenticated active user; organization-wide asset management links remain permission-gated.
- Admin pending requests are enriched with limited asset/requester/assignment labels; no staff directory is returned.
- Pending requests show Vietnamese status labels and disable duplicate proposal actions.
- Review rejection has an explicit note dialog; DB RPC is the single canonical audit writer with materially correct old/new snapshots and stale assignment/status fail-closed checks.

Validation:
- Focused V2.2 + asset regression: 23/23 PASS.
- TypeScript: PASS.
- Changed-file ESLint: PASS.
- `git diff --check`: PASS.
- Disposable PostgreSQL migration rehearsal: PASS.
- Production-like build and route manifest: PASS.

Production mutation: NONE. Database/Q3 data unchanged; no production migration, deploy, restart, or re-import.

Next:
- Owner approval for production deployment review.

## Asset UI + Permission Management Phase 1

Current Phase: COMPLETE; pre-production owner review
Current Task: UI polish and dynamic asset.manage grant/revoke

Completed:
- Polished asset filters, responsive table widths, note header, compact detail action, and mobile cards without changing V2.3 asset semantics.
- Reused canonical asset.view and asset.manage permissions; exposed asset.view as read-only and asset.manage as the mutable permission selector.
- Added generic role and user grant/revoke RPCs for asset.manage using permission.manage authorization, audit_logs, and service-role-only execution.
- No named-user whitelist or automatic grants.

Validation:
- Focused asset/RBAC/UI tests: 47/47 PASS.
- TypeScript: PASS.
- Changed-file ESLint: PASS.
- git diff --check: PASS.
- Route manifest: PASS.
- Safe migration tests: 24/24 PASS.
- Disposable PostgreSQL migration rehearsal: PASS.
- Production-like build: PASS with runtime env loaded from /opt/thoidai-work/.env.production in-process only.

Migration:
- Added supabase/migrations/20261014100000_asset_manage_permission_management.sql; not applied to production.

Production mutation: NONE.

Next:
- Owner review only; do not migrate, deploy, restart, or change production grants without separate authorization.
# External CI Lifecycle Phase 1 Hardening

Current Phase: COMPLETE; pre-merge owner approval
Current Task: final merge gate and Phase 2 preparation

Completed:
- Added explicit artifact `build_config` provenance. CI artifacts built with reserved Supabase placeholders are marked `ci-placeholder` and remain verification/rehearsal-only.
- Added fail-closed activation checks in the external artifact wrapper and deployment gate; only `canonical-public` artifacts can activate.
- Added canonical public-config validation using repository/environment public variables while keeping the service-role key a non-production placeholder in CI.
- Added canonical artifact placeholder scanning and focused regression coverage.
- Retention remains dry-run by default; no APPLY or unattended deletion was enabled.

Validation:
- Focused Phase 1 hardening tests: 20/20 PASS.
- Node syntax checks: PASS.
- `git diff --check`: PASS.
- Previous sealed CI evidence: 18/18 PASS.
- New GitHub Actions push and pull-request runs for `b1f41955adf7519c3d69ffce30d85f0811e9e378`: PASS.
- Production mutation: NONE.

Blockers:
- None for source merge, subject to owner merge approval.

Follow Up:
- After PR #9 and RuleCodex PR #2 are actually merged, run Phase 2 Safe Rehearsal only: retrieve post-merge canonical artifact, verify provenance/checksum, read-only VPS disk gate, isolated staging verify-only/alternate-port smoke, safe rollback simulation, and retention dry-run.

Next:
- READY TO MERGE PR #9 and PR #2; do not merge, activate, restart, migrate, change production symlinks/timers, or run cleanup APPLY without separate approval.
# Artifact Upload Integrity Hotfix

Current Phase: Phase 1 hotfix; owner merge review
Current Task: Preserve hidden artifact metadata and verify upload/download round-trip

Completed:
- Added hidden-file inclusion to the immutable artifact upload.
- Added same-run artifact download and verify-only round-trip checks.
- Added regression coverage for hidden metadata, required runtime files, secret scan, and deployment non-activation.

Validation:
- Focused upload-integrity tests: PASS.
- PR CI run `38323389570`: PASS.
- Canonical/public build was intentionally not expected on PR; artifact was `ci-placeholder` and remains verification-only.
- Uploaded ZIP round-trip: hidden metadata present; standalone verifier, checksum verifier, secret scan, and symlink portability checks PASS.
- Production/VPS changed: NO.

Blockers:
- Canonical artifact from run 38319801598 remains invalid for Phase 2 because its archive omitted hidden metadata.

Next:
- Owner merge review for PR #11; after merge, rerun canonical CI and verify a new `canonical-public` artifact before Phase 2.

## Phase 3B Migration-First Compatibility Plan

Current Phase: COMPLETE; migration-first plan ready for owner review
Current Task: RBAC V2 database compatibility and artifact contract

Completed:
- Audited production read-only: migration `20261014100000` is present; `20261015100000` is not applied; `user_permission_grants.effect` and RBAC V2 RPCs are absent.
- Rehearsed the exact `20261015100000_rbac_v2_role_user_overrides.sql` migration on an isolated PostgreSQL 17 restore fixture; first apply PASS, second invocation `ALREADY_APPLIED`.
- RBAC SQL regression PASS; `effect`, new RPCs, legacy RPC ACLs, grant counts, and single migration-ledger registration were verified without production mutation.
- Added the RBAC V2 migration to standalone `MIGRATION_REFERENCE` and `.release-meta`; artifact verifier and focused packaging regression now require the same contract.

Validation:
- Focused artifact/package/provenance/manifest/secret/round-trip tests: 19/19 PASS.
- RBAC V2 focused and safe migration evidence: 69/69 PASS; isolated SQL rehearsal PASS.
- `git diff --check`: PASS.

Compatibility:
- Old app + old DB: PASS (current production baseline).
- New app + old DB: NO-GO; missing `effect` and RBAC V2 RPCs are required by the new application.
- New app + new DB: migration and SQL contract PASS; end-to-end application smoke on the migrated fixture remains pending.
- Old app + new DB: likely structurally compatible because legacy RPCs remain, but end-to-end old-app runtime verification is pending.

Rollback:
- Do not automatically roll back the application after RBAC V2 denies/overrides exist; `rbac_v2_assert_legacy_rollback_compatible()` must PASS or use a forward-fix path.
- Freeze RBAC mutations during the pilot window unless the owner approves a tested forward-fix plan. PITR/database restore is not an automatic rollback because it may lose post-backup data.

Production safety:
- Production database, grants, users, release pointers, service, and symlinks unchanged.
- Production activation remains `NO-GO` until migration-first rollout approval and application compatibility gates pass.

Next:
- Push the small artifact-contract PR for owner review; keep PR #12 open and unmerged. Production Pilot remains `NO-GO`.

## Phase 3B Compatibility E2E Checkpoint

Current Phase: COMPLETE; owner merge review
Current Task: PR #14 synchronized with canonical RBAC V2 deployment hardening

Completed:
- Merged canonical `integration/production` SHA `6bae544ba92ac43d0a48040d06d92387d71597f2` into this branch with an ordinary merge; no reset or force update.
- Preserved `rbac_v2=supported`, the RBAC V2 migration reference, immutable artifact metadata, provenance/manifest verification, and rollback compatibility gates.
- Focused artifact/RBAC/deploy/rollback/retention tests: 30/30 PASS; `git diff --check`: PASS.
- PR CI runs `38352320630` and `38352315627`: PASS; PR #14 is mergeable CLEAN against the new canonical base.

E2E status:
- Old application + migrated DB runtime E2E: BLOCKED locally because the required isolated PostgreSQL/Docker runtime is unavailable on this Windows host; no production credentials or database were used.
- New RBAC V2 application + migrated DB runtime E2E: BLOCKED for the same reason; SQL rehearsal and pure resolver tests remain PASS, but they do not replace runtime smoke.
- Backup restore and exact migration rehearsal evidence remains sealed from the isolated PostgreSQL 17 fixture: PASS / `ALREADY_APPLIED` on second run.

Decision:
- PR #14 merge: READY for owner merge approval.
- Migration-first production pilot: NO-GO until both old-app and new-app authenticated runtime E2E gates run on an isolated migrated fixture.
- Production migration, deploy, restart, DB/grant/user/symlink/systemd/timer changes: NONE.

Next:
- Owner may merge PR #14. Keep production activation blocked and provide an isolated runtime E2E environment before migration approval.

## Phase 3B.1 Isolated Authenticated E2E Harness

Current Phase: IN PROGRESS; owner review after disposable GitHub Actions run
Current Task: Build and validate isolated old-app/new-RBAC-V2 authenticated E2E harness

Completed:
- Added `.github/workflows/phase3b-isolated-e2e.yml` for Ubuntu 24.04 disposable-runner execution.
- Added a localhost-only PostgreSQL 17 + PostgREST sandbox with the representative migration chain through `20261015100000_rbac_v2_role_user_overrides.sql`.
- Added exact old (`bd4803933d6b98fd6996852992be566e6286ea67`) and canonical (`36b4c117a365355062ccfa5d78afbfb7a2be7197`) sandbox builds.
- Added authenticated HTTP checks for login/session, assets, permission management, quick report, allow/deny overrides, and self-elevation protection.
- Added authenticated browser smoke for `/login`, `/assets`, and `/tasks/quick-report`.
- Added harness contract tests and isolation documentation.
- Excluded the disposable harness from Next standalone tracing so production artifact secret scans cannot package test fixture scripts.
- Masked every generated sandbox JWT, session secret, and test password before exporting workflow environment state.
- Old/new sandbox builds and migration setup pass; the first runtime attempt exposed an old-app sandbox login 401 and now includes non-secret schema/log diagnostics for root-cause closure.
- Legacy runtime harness uses `ROLE_LIFECYCLE_ENABLED=false` to exercise the old resolver against the migrated schema without requiring the newer role-lifecycle join; new RBAC V2 runtime remains lifecycle-enabled.

Validation:
- Harness contract tests: 3/3 PASS.
- Bash syntax: PASS.
- `git diff --check`: PASS.
- Local Windows Docker/PostgreSQL/browser E2E: NOT RUN; the disposable Linux workflow is the authoritative runtime gate.

Blockers:
- Disposable-runner attempt `38365590825` exposed the ad-hoc Playwright install issue; run `38367362901` confirms the hardened install PASS. Redacted diagnostics from run `38369562702` proved the first old-app 401 was caused by a fixture ACL omission; the sandbox now grants `SELECT` to `service_role`. Runs `38370519599` and `38372001870` confirm the ACL, password, exact legacy query, and bcrypt probes PASS, while old login still returned 401. Run `38374557577` (HEAD `ffdaa99`) also failed at the old-app authenticated gate before new-app/browser suites; no production endpoint or credential was used. The exact cause inside the legacy standalone process remains unresolved, so this checkpoint is BLOCKED rather than E2E PASS.
- Production migration/deployment/activation remains prohibited.

Next:
- Preserve the failed-run diagnostics and owner-review the remaining legacy standalone login blocker; do not claim isolated E2E PASS until old-app, new-app, and browser suites all execute successfully.

## Phase 3B.1 Supabase Prefix Investigation

Current Phase: BLOCKED; owner review after harness fix
Current Task: Resolve old-app authenticated E2E 401 on the disposable Linux runner

Evidence:
- Canonical was synchronized to `5a444a45e2cc0d589ffa6de40ff1e9bf3d7108d` with an ordinary merge; the merge is local on the PR #16 branch until pushed.
- Run `38374557577` showed the sandbox row, active flag, exact legacy query, and bcrypt comparison passing while the old standalone login still returned HTTP 401.
- The sandbox PostgREST endpoint is exposed at `/`, while Supabase JS constructs REST requests under `/rest/v1`; this explains why direct root probes pass but the application request can fail.

Harness fix:
- Added a localhost-only `scripts/e2e/sandbox-gateway.mjs` that forwards `/rest/v1/*` (and the supported storage prefix) to the disposable PostgREST target without mocking data, permissions, or authentication.
- Added `scripts/e2e/supabase-sdk-probe.mjs` using `@supabase/supabase-js@2.112.4` to prove the direct-root failure and gateway success without printing credentials.
- Old and new app builds/runtime now use `E2E_SUPABASE_URL`; direct `E2E_POSTGREST_URL` remains limited to non-secret diagnostics and rollback-compatibility probes.
- Added gateway cleanup and focused contract assertions; production URLs, artifacts, auth logic, and deployment scripts are unchanged.

Local validation:
- Isolated harness contract tests: 5/5 PASS.
- Node syntax checks: PASS.
- E2E-script ESLint: PASS.
- TypeScript: PASS.
- `git diff --check`: PASS.

CI follow-up:
- Run `38376779104` reached the new SDK prefix step but failed because the workflow tried to parse `GITHUB_ENV` with `sed`; the resulting gateway URL lost its port and Node reported `ECONNREFUSED 127.0.0.1:80`.
- This was a harness wiring defect, not an application authentication result. The fix persists `E2E_SUPABASE_URL` in the sandbox env file and sources it directly in later steps.
- Run `38378461348` confirmed the URL was correct (`127.0.0.1:20373`) but the gateway process was reaped between steps, producing `ECONNREFUSED` on the gateway port. The next minimal fix starts it with `nohup` and retains the existing `always()` cleanup.
- Run `38378950904` confirmed `nohup` alone did not survive the Actions runner process cleanup. The next fix detaches the gateway from `RUNNER_TRACKING_ID` and stdin while retaining explicit PID cleanup.
- Run `38379433000` confirmed the runner still reaped the detached gateway between steps. The harness is now changed to start, health-check, and trap-clean the gateway inside each consuming step (SDK probe, old app, and new app), avoiding cross-step daemon assumptions.
- Run `38380089534` showed the same refusal even inside the consumer step with detached launch. The gateway is now a normal background child of that step, with health-check and EXIT trap cleanup; no cross-step process persistence is assumed.
- Run `38380491284` still failed on the first gateway request while health-check passed. Added fail-closed 502 handling and redacted gateway diagnostics so the next run distinguishes upstream request failure from process lifecycle failure.
- Run `38380820149` confirmed gateway lifecycle is fixed: SDK probe reached it, direct root was `404/PGRST125`, and gateway returned `502`; gateway log reports an upstream `TypeError`. The next run records only the underlying non-secret cause code/message to isolate the remaining forwarding issue.
- Run `38381257702` confirmed the upstream error remains a generic Node fetch `TypeError` while direct PostgREST is healthy. The gateway now uses Node's native `http.request` proxy instead of `fetch`, preserving methods/headers/body without undici proxy ambiguity.
- Run `38381615931` showed the native proxy still returns 502 without a safe message; tightened header normalization and response handling for the next bounded retry.
- Root cause identified: Node's `IncomingMessage.headers` is a plain object, so the spread expression caused the gateway `TypeError` before contacting PostgREST. Replaced it with `Object.entries(request.headers)`.
- Run `38382116999` passed the SDK prefix gate and both builds, then Gate A failed because the old/new worktree steps resolved the new gateway script relative to the old application checkout. The runtime steps now execute the harness script from `$GITHUB_WORKSPACE`.
- Run `38382789605` proved the old app reaches the gateway but still returns 401. Diagnostics showed gateway request succeeds at transport level; root cause is missing upstream response headers after native proxying, especially `content-type`, so Supabase JSON parsing returned no row. Response headers are restored with hop-by-hop filtering.
- Run `38383614183` retained the same 401 after response headers were restored; transport, direct SDK prefix, and fixture bcrypt probes pass. The next probe adds the exact legacy `authenticateCredentials()` OR/select query through the gateway.
- Run `38384316405` confirmed the exact legacy SDK query returns a live row and bcrypt hash through the gateway, while old standalone login remains 401. Added non-sensitive gateway method/path/status telemetry to identify the runtime request path in the next isolated run.
- Run `38385052584` showed the application auth query returns 200, then the session lookup query returns 400 on the migrated fixture. The next SDK probe captures the exact session-query error code/status to close the remaining compatibility distinction.
- Run `38386163729` identified session-query error `42703` (undefined column). The sandbox migration list omitted `20260814190000_phase1_authorization_facade.sql`, which defines legacy `role_permissions` columns selected by the old app. Added that migration to the disposable fixture chain; no application or production schema change.
- Run `38386880888` failed while applying that migration because its dependency type `task_evaluation_checkpoints` was also absent. Added `20260813110000_task_evaluation_checkpoints.sql` before the authorization facade migration.
- Run `38387658296` applied the complete fixture and passed SDK prefix/build gates. Old-app login/session then remained blocked because `api_list_role_permission_grants` returned HTTP 400; redacted runtime log reports PostgreSQL `column reference "scope" is ambiguous`. This is a real RBAC V2 migration/application compatibility defect, not a sandbox URL or fixture-prefix issue.

Final decision for PR #16:
- `BLOCKED — old-app authenticated E2E`.
- Gate A prefix/query probes: PASS; old-app login/session: FAIL due RBAC RPC SQL error; Gates B/C/D did not execute.
- Do not claim authenticated E2E PASS, merge PR #16, apply production migration, deploy, restart, or alter production auth/RBAC SQL from this harness checkpoint.

Decision:
- Runtime E2E remains BLOCKED until the disposable GitHub Actions workflow executes the SDK prefix gate, old-app login/session, old-app authorization, new RBAC V2 suite, and authenticated browser smoke successfully.
- No production endpoint, credential, database, migration, deployment, restart, symlink, systemd/timer, or retention APPLY was used.

Next:
- Commit and push only the E2E harness/workflow/status changes, then wait for PR and disposable Phase 3B.1 workflow runs. Do not merge PR #16 or proceed to production migration/activation without owner approval.

## Asset Locations & Single-Row Filter

Current Phase: implementation complete; CI/artifact handoff
Current Task: additive location seed and responsive asset filter

Completed:
- Added additive migration  for six missing stable asset locations; existing location rows and asset values are untouched.
- Updated standalone artifact migration provenance for both location migrations.
- Changed asset filter layout to 1/2/3/6 columns across mobile/tablet/desktop widths.

Validation:
- Focused asset/API/UI tests: 35/35 PASS.
- PostgreSQL 17 disposable migration rehearsal: PASS; 9 locations, idempotent rerun, existing asset location values preserved.
- TypeScript, changed-file lint, route check, and git diff check: PASS.

Production safety:
- Production database, releases, service, RBAC, and secrets: unchanged.
- Production deployment: not started.

Next:
- Commit and push feature branch, open one PR, wait for CI artifact, then run the approved migration-first deployment gates.
## Database Management V1 — local foundation continuation

Current Phase: Phase 1 foundation implementation; local validation
Current Task: complete server API contracts and local migration verification

Completed:
- Added additive catalog/schema migrations for 5 top-level groups and 47 record types.
- Added server-only record repository, dynamic form catalog API, ACL resolver and private local file adapter.
- Added detail/update/soft-delete/restore/ACL/file upload/download routes with no-store responses and checksum verification.
- Added functional local pages for record entry, search, list and detail; added database navigation entry.

Validation:
- Database management focused tests: 12/12 PASS.
- TypeScript: PASS.
- Touched-file ESLint: PASS with only existing AppNav warnings.
- git diff --check: PASS.
- Route manifest: PASS.
- Production-like build with build-only local placeholders: PASS; no production secrets used.

Blockers:
- Full local Supabase startup/reset reaches the historical September duty-roster seed but remains blocked by legacy fixture incompatibility. The original `actor_id` failure is reproduced and locally unblocked in a disposable bootstrap: baseline demo tasks omit `created_by`, `20260817050000_phase3_additive_task_schema.sql` maps one to `assigned`, and `20260826200000_harden_direct_assignment.sql` inserts that NULL into NOT NULL `task_status_events.actor_id`. The bootstrap also documents the next legacy roster fixture mismatch without changing historical migrations. No database was modified outside disposable attempts; no production database was accessed.

Production safety:
- Production database, VPS, releases, service and canonical branch: unchanged.

Next:
- `scripts/local-database-bootstrap.mjs` provides a disposable local-only compatibility copy and preserves the production migration set. Migration chain is still FAIL at the legacy September roster fixture (`ineligible duty assignee`) after the actor compatibility fix; do not claim full-chain or runtime E2E PASS. Do not deploy or apply production migration.
- Branch pushed: `codex/database-management-v1-foundation` (`3bf06b3`, includes `9a304c0`, `ab62181`, `c7856e8`).

## Database Management V1 — local integration recovery checkpoint (2026-10-17)

- `HISTORICAL_FULL_CHAIN: FAIL`. The original `actor_id = NULL` failure is reproduced and handled only in the disposable bootstrap. A bounded compatibility fixture also resolves the September duty roster mismatch, but the historical chain then reaches additional legacy online-work/leave fixture dependencies; no historical migration was changed.
- `CSDL_ISOLATED_SCHEMA: PASS`. A disposable copy of official migrations through the verified backend/RBAC baseline plus the two Database V1 migrations validates 12 V1 tables, RLS on `db_records`, service-role grants, 44 active record types and 44 published forms.
- `CSDL_RUNTIME_E2E: BLOCKED`. Unauthenticated HTTP contract checks return 401 as expected. Authenticated runtime could not be completed because the legacy fixture chain stops at `20260911110000_enable_deputy_department_assignment.sql` when `leave_requests` is absent; continuing to patch historical fixture dependencies is out of scope.
- Security hardening: server forces actor department/ownership and draft status on create; validates dynamic metadata types/options/rules; ignores expired ACLs; preserves explicit deny precedence; filters ACL before final list limit; compensates best-effort on history failure; supports ACL expiry timestamps.
- Form progress: `44/44` catalog definitions and `44/44` published baseline forms verified. Specialized business metadata remains unverified because the catalog currently supplies a shared skeleton only.
- Local pages: source routes exist for list, search, create and detail; browser acceptance was not claimed without an authenticated runtime.
- Local runtime URL used: `http://localhost:3107` (stopped after unauthenticated checks). Production/VPS/database: `UNCHANGED`.
- Supabase warning retained for owner review: legacy `public.task_completion_scores` has RLS disabled in the isolated baseline. No remediation was applied because enabling RLS without approved policies could block existing access.
- Focused tests after hardening: `14/14` Database Management tests PASS; TypeScript PASS; required routes PASS; diff check PASS. Isolated runner contract test PASS. No deployment or production migration performed.

## Database Management V1 — authenticated local runtime recovery (2026-10-17)

- `HISTORICAL_FULL_CHAIN: FAIL` remains unchanged. Legacy September fixture incompatibilities are not rewritten or bypassed.
- `CURRENT_APP_CSDL_RUNTIME: PASS` on a disposable PostgreSQL/Supabase baseline built from an explicit allowlist of official migrations, including account personalization, leave/audit dependencies, `20260911150000_lock_task_completion_scores.sql`, RBAC V2 (`20261015100000` plus scope fix), and Database V1 migrations.
- Baseline verification: 44 active record types, 44 published forms, `api_list_effective_permissions(uuid)`, service-role execute grant, `leave_requests`, audit, password lifecycle, `db_records` RLS, and `task_completion_scores` RLS/service-role select all verified.
- Authenticated HTTP runtime: PASS for synthetic local login/session/RBAC, catalog, create/read/update/search, private file upload, soft-delete and restore. Browser E2E was not claimed because the local browser daemon was unavailable on this Windows host.
- ACL lifecycle correction: composite-key upsert now permits repeated deny/allow updates; local HTTP replay passed expired deny, active deny, repeated deny, allow, and owner delete/restore paths.
- Disposable RLS assessment: `task_completion_scores` is protected by the lock migration. Ten unrelated legacy tables remain RLS-disabled in the disposable baseline; no remediation was applied without approved policies. This is not evidence of production state.
- Production/VPS/database: `UNCHANGED`. No production credentials, data, migration, deployment, restart, or activation used.

## Database Management V1 — CP2 functional completion and acceptance (2026-10-17)

Current Phase: CP2 local functional completion and browser acceptance
Current Task: source-backed specialized metadata, 44-type matrix, and read-only legacy RLS assessment

Completed:
- Added source-backed specialized fields for `van_ban_den`, `hop_dong_nghiep_vu`, and `ho_so_su_kien` only.
- Added typed dynamic form controls for text, long text, date, datetime, number, URL, select, multi-select, country, department and person-compatible fields.
- Added a 44-type matrix and disposable legacy RLS assessment report.

Validation:
- Database/API contract tests: 19/19 PASS.
- 44-type matrix test: PASS; catalog/forms remain 44/44.
- Isolated catalog migration replay: PASS; specialized field counts 16/16/17.
- TypeScript source-only check (excluding generated `.next` types): PASS.
- Required route manifest and diff check: PASS.
- Browser E2E: BLOCKED; Browser Use daemon has no active connection and no browser package was installed under low RAM.

Blockers:
- Specialized business metadata for 41/44 types lacks an approved source contract; fields are intentionally not guessed.
- Historical full migration chain remains FAIL for legacy fixtures; unchanged and out of CP2 scope.
- Disposable RLS finding: `task_quick_report_idempotency` has anon/authenticated table grants; no remediation applied.

Production safety:
- Production/VPS/database: UNCHANGED. No merge, deploy, production migration, or infrastructure change.

Next:
- Push the three existing verified commits plus CP2 changes to the feature branch only after final owner review.
- Browser/manual acceptance can use the existing local URL when the isolated runtime is started.

## Database Management V1 — CP2-B business forms and local acceptance (2026-10-17)

Current Phase: CP2-B local business-form completion
Current Task: optional metadata groups, 44-type classification, and disposable RLS security proposal

Completed:
- Added additive migration `20261017110000_database_management_v1_cp2b_optional_fields.sql`.
- Added bounded optional metadata groups for 40 record types; all fields are non-required and do not widen permissions.
- Kept 4 sensitive/legal record types on the common skeleton with `OWNER_REQUIRED` status.
- Added the RLS hardening proposal for `task_quick_report_idempotency`; no grant/RLS remediation was applied.

Validation:
- CP2-B contract and Database Management tests: 22/22 PASS.
- Catalog/forms: 44/44 remain published.
- Disposable CP2-B migration replay: PASS; 40 distinct record types received optional field groups.
- Source-only TypeScript check excluding generated `.next` types: PASS.
- Required routes and diff check: PASS.

Blockers:
- Browser E2E remains BLOCKED because Browser Use has no active daemon connection; no heavy browser install was attempted.
- Historical full-chain fixture failure remains unchanged.
- `task_quick_report_idempotency` hardening is OWNER_REQUIRED; proposal only.

Production safety:
- Production/VPS/database: UNCHANGED. No production migration, grant change, deploy, merge, or restart.

Next:
- Push CP2-B commit to the feature branch only.
- Owner may approve the separate RLS hardening proposal and provide source confirmation for sensitive forms.

## Database Management V1 — CP2-C runtime acceptance and security completion (2026-10-17)

Current Phase: CP2-C local runtime acceptance
Current Task: server-side sensitive policy, bounded search, source-backed form options, and disposable RLS verification

Completed:
- Added server-side default deny for the four sensitive/legal record types (`ho_so_dang`, `chi_hoi_nha_bao`, `doan_thanh_nien`, `giay_phep_quan_ly_bao_chi`). Technical admin permissions and per-record ACL cannot override this policy; an explicit `record.sensitive.access` permission is required and remains owner-controlled.
- Filtered sensitive types from catalog/forms, list/search and detail access; create is rejected with HTTP 403.
- Bounded list scanning to authorized record-type IDs and a finite window before ACL filtering; this removes the prior unbounded full-table scan behavior, while full database/RPC predicate pushdown remains a follow-up.
- Catalog now supplies live department/person options and a bounded country option set; number inputs submit numbers and person fields use real staff options.

Validation:
- Database Management focused tests: 18/18 PASS.
- Source-only TypeScript check excluding generated `.next/dev` types: PASS.
- Touched-file ESLint: PASS.
- `git diff --check`: PASS.
- Disposable isolated schema: PASS (44 active record types, 44 published forms, RLS and service-role grants verified).
- Authenticated local HTTP matrix: 40/40 non-sensitive types created, read, updated, searched, soft-deleted and restored successfully.
- Sensitive policy runtime: PASS; technical admin catalog exposes 40/44, sensitive create returns 403.
- Disposable Quick Report grant hardening: PASS; anon direct table access denied and service-role direct access succeeds. Proposal remains unapplied to production.

Not claimed:
- HTTP runtime coverage for the four `OWNER_REQUIRED` types: intentionally blocked by policy; disposable privileged fixtures were not used to claim business approval.
- Browser E2E: not run; owner manual acceptance remains required because Browser Use daemon is unavailable.
- Full AND/OR/NOT metadata query language and DB-side ACL predicate/RPC: not implemented in this bounded CP2-C patch.
- Historical full migration chain: remains FAIL at legacy fixture incompatibilities and was not changed.

Production safety:
- Production/VPS/database/release/policy: UNCHANGED. No production migration, grant/RLS change, deploy, merge, restart or canonical branch update performed.

Next:
- Owner can manually accept the local UI at `http://localhost:3107` after starting the disposable runtime and Next.js with local-only credentials supplied by the fixture runner.
- Separate owner approval is required before applying the Quick Report grant hardening or any sensitive record permission.

## Database Management V1 — CP3 + CP4 advanced search and record management (2026-10-17)

Current Phase: CP3/CP4 implementation and disposable validation
Current Task: PostgreSQL authorization-predicate search and record-management acceptance

Completed:
- Added additive migration `20261017130000_database_management_v1_cp3_search_rpc.sql` with `api_search_database_records(...)`.
- Search authorization now executes in PostgreSQL before count/window pagination, preserving explicit deny, ACL expiry, owner/department fallback and the four-type sensitive deny policy.
- Repository list/search no longer performs the prior unbounded batch scan and in-memory ACL filter; it calls the service-role RPC with bounded limit/offset.
- Search query complexity is bounded and the RPC is unavailable to `public`, `anon` and `authenticated` roles.
- Isolated runner allowlist and contract tests include the CP3 migration.

Validation:
- Database Management and CP3 contract tests: 21/21 PASS.
- Source-only TypeScript: PASS.
- Touched-file ESLint: PASS (no errors).
- `git diff --check`: PASS.
- Docker/disposable migration replay: BLOCKED by Docker Desktop `DockerLifecycleInspectError` while inspecting the isolated database container; no SQL runtime PASS is claimed for CP3.

CP4 status:
- Existing server routes for detail, update, soft-delete/restore, ACL and private file upload/download remain in place and covered by contract tests.
- Full UI acceptance for edit, file/link/history/ACL/export controls and advanced filter persistence remains pending; no browser E2E was claimed.

Blockers:
- Restart Docker Desktop or restore its local engine API, then rerun the disposable migration and RPC matrix. This is the only current runtime blocker for CP3.
- Local `npm run build` is blocked by the repository release-lineage guard on the feature branch; direct `npx next build` compiles and type-checks but stops during page-data collection because runtime Supabase environment variables are intentionally absent. The existing `.next` artifact therefore remains stale for artifact-route verification.
- Historical migration chain remains FAIL on legacy fixtures; unchanged.
- Browser Use daemon remains unavailable.

Production safety:
- Production/VPS/database/release/policy: UNCHANGED. No production migration, grant/RLS change, deploy, merge, restart or canonical branch update performed.

Next:
- After Docker health returns, run the CP3 RPC matrix with interleaved denied/allowed fixture rows, count/pagination checks and expired/explicit deny regressions.
- Then complete CP4 UI controls and local manual acceptance without exposing the development server publicly.

## Database Management V1 — CP3–CP6 integration candidate (2026-10-18)

Current Phase: COMPLETE; local integration candidate ready for owner review
Current Task: migration-first integration and bounded validation

Completed:
- Candidate branch `review/database-v1-integration-20261018` is based on CP6 SHA `9bd37fb6e5583a3e806f28eae1ff9029f895654d`; canonical `integration/production` remains an ancestor.
- CP3 search/RBAC/ACL/sensitive controls, CP4 CRUD/private files/history, CP5 backup and hardening, and CP6 audit outbox/benchmark changes are included without merging directly into `integration/production`.
- Added CP6 audit outbox to strict sandbox, isolated migration, and standalone migration provenance in timestamp order.
- Corrected audit event identity: independent download/export actions receive distinct keys; retries remain idempotent when callers provide an explicit key.
- CP6 GitHub evidence reused from run `39110392819`: SUCCESS with SQL/security gates PASS and recorded evidence exceptions for HTTP average and exact post-run disk free.

Validation:
- Focused Database V1, CP3/CP4, audit outbox, migration, packaging-contract, and release compatibility tests: to be run on this candidate.
- No benchmark rerun, production migration, build, push, merge, dispatch, deployment, or runtime cleanup APPLY performed.

Blockers:
- Production rollout remains NO-GO pending owner approval for migration/deploy, production backup/checkpoint, storage root, and immutable artifact gates.
- Local C: free space is 16.78 GiB; build/packaging is intentionally not run under the 20 GiB warning budget.

Next:
- Owner review of this local candidate; push or PR creation requires separate approval.
# Database V1 Self-Approval Release Check (2026-10-24)

Current Phase: release validation complete; owner approval pending
Current Task: DATABASE_V1_SELF_APPROVAL_RELEASE_READY

Completed:
- Source commit `562878334ef83227204aa647dbdc9bbfd6642cc9` pushed to `feature/database-v1-self-approval-local-first`.
- Self-approval authorization now fails closed when `record.self_approve` effective scopes are missing or empty.
- Isolated migration runner includes workflow ambiguity and self-approval migrations.
- Local webpack build, standalone packaging, manifest/checksum, secret scan, and VPS verify-only passed.

Validation:
- Targeted authorization/database workflow suite: 95/95 non-browser tests passed.
- TypeScript, changed-file ESLint, and `git diff --check`: PASS.
- Browser fixture: BLOCKED because `/tmp/thoidai-approval-browser/node_modules/playwright/index.mjs` is absent.
- Isolated PostgreSQL runner: BLOCKED because Docker daemon is unavailable and registry access is restricted.
- Artifact manifest SHA-256: `ea75a70f364bdff9970ed7e981784d449aa338f42c19a11c0f6128ededa0ab53`.
- VPS external artifact verification: PASS (verify-only).

Production safety:
- Production database, migration ledger, grants, releases, pointers, service, and health: unchanged.
- No migration applied, restart, activation, or cleanup APPLY performed.
- Migration-first decision: old database without `20261024110000_database_management_v1_self_approval.sql` is NO-GO for activation; owner must approve migration-first rollout separately.

Next:
- Wait for owner approval and an available isolated PostgreSQL/Docker runtime before claiming runtime migration matrix PASS.
# Attendance organization notes fix

Current Phase: implementation complete; pre-production validation
Current Task: complete approved leave, personal schedule, leadership event, and online-work note coverage without whole-organization query caps

Completed:
- Added stable paginated reads for attendance logs, admin notes, approved leave, active online schedules, and approved schedules.
- Added approved personal business/event schedule notes while preserving leadership assignment and multi-day event behavior.
- Excluded pending, rejected, cancelled, and out-of-range sources; preserved actor/organization visibility filtering and admin notes.
- Added source metadata so attendance summaries count leave and business days from source records rather than note prefixes.

Validation:
- Focused attendance suite: 46/46 PASS.
- TypeScript, changed-file ESLint, and `git diff --check`: PASS.
- Production data, migration, service, and release pointers: unchanged.

Next:
- Commit and push the feature branch, create a Linux-compatible artifact, and run VPS verify-only. Owner approval is required before production activation.

# Attendance table UI hotfix

Current Phase: UI implementation complete; owner review pending
Current Task: keep organization attendance status and notes inside their table cells

Completed:
- Added an organization-table width profile with horizontal scrolling preserved on small screens.
- Allowed the long no-attendance-log status label and multi-line/admin notes to wrap within their own cells.
- Kept personal attendance table proportions and all attendance/business rules unchanged.

Validation:
- Attendance UI/scroll/admin-note/date tests: PASS.
- TypeScript (`--incremental false`): PASS.
- Changed-file ESLint: PASS.
- Webpack production build with non-production placeholders: PASS.
- Browser smoke reached the local login page; authenticated attendance data was not used.

Production safety:
- Production database, releases, service, and pointers: unchanged.
- No migration, deploy, restart, or activation performed.

Next:
- Owner review, then commit/push the UI hotfix feature branch. Do not merge/deploy without approval.

# Attendance page layout final hotfix

Current Phase: implementation complete; pre-production validation
Current Task: ATTENDANCE_PAGE_LAYOUT_FINAL_READY

Completed:
- Prevented the attendance page content grid from forcing a wider-than-viewport track by adding `min-width: 0` and `minmax(0,1fr)`.
- Preserved intentional table overflow with a bounded `table-scroll` wrapper and disabled the mobile page-level clipping rule only for `/attendance`.
- Kept the existing status and note wrapping behavior unchanged.

Validation:
- Attendance layout/table regression tests: 10/10 PASS.
- TypeScript: PASS.
- Changed-file ESLint: PASS (globals.css ignored by repository configuration).
- `git diff --check`: PASS.
- Local webpack production-like build: PASS with non-production placeholders.
- Browser: local `/attendance` redirects to `/login` without an authorized session; authenticated viewport acceptance is not claimed.

Production safety:
- Production database, active release, service, and rollback pointers unchanged.
- No migration, deploy, restart, activation, or cleanup APPLY performed.

Next:
- Commit and push the feature branch, package the exact source SHA, and run VPS verify-only. Owner approval is required before production activation.

# H-04 + H-05 Policy Gate Checkpoint (2026-10-26)

- C-01 applied to production on 2026-10-26 through PR #51.
- C-02 automatic backup and restore rehearsal PASS through PR #52.
- VPS cleanup completed: stopped the hanging backend DB, 18 orphaned `next-server` processes, 13 test containers, and removed 2 openclaw cron jobs.
- This branch handles H-04 and H-05.

## H-03 Ledger Reconciliation

Current Phase: implementation complete; local validation
Current Task: read-only migration ledger reconciliation tooling

Completed:
- Added read-only `checks`, `report`, and `backfill-sql` commands with later-drop filtering and all-object APPLIED gating.
- Added temporary-directory fixture coverage and `H03_REPORT.md` usage/limitations/workflow.

Validation:
- `node --test scripts/production/ledger-reconcile.test.mjs`: PASS (5/5).
- `git diff --check`: PASS.
- Changed-file ESLint: PASS (0 errors, 0 warnings).

Production safety:
- No SSH, Docker, network, database, migration, deployment, or commit performed.
