# Production Smoke Cleanup + Recipient-First Compact Picker

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
