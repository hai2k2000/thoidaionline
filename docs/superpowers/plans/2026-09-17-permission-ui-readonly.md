# Phase 1A Permission UI Read-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the legacy mutation-heavy `/permissions` screen with a server-authorized, read-only RBAC matrix backed by `permissions` and `role_permission_grants`.

**Architecture:** A server layout checks the authenticated session actor's `permission.manage` grant. The GET route loads role metadata, permission catalog rows, and grants through the server Supabase client, then maps them into a complete role/module/permission/scope matrix; POST, PUT, PATCH, and DELETE return an explicit read-only rejection. The client page renders the returned matrix without mutation controls while preserving existing Thời Đại Work navigation and styling.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase server client, Node built-in test runner.

**Spec:** Owner-approved Permission UI read-only brief in `C:\Users\hai2k\.codex\attachments\28ab3979-0f9c-4378-9eda-3ee167bf929c\pasted-text.txt`.

## Global Constraints

- Work only in `/opt/worktrees/thoidai-work-phase1a-permission-ui-readonly` from commit `77ad72d443bc58c964a890ecd0fe2f391e473738`.
- Do not modify `/opt/thoidai-work`.
- Do not add migrations, RPCs, grants, schema changes, or RBAC behavior changes.
- Keep `TASK_RBAC_V2_ENABLED=true`; do not start Journalism Tasks.
- Permission UI is read-only; permission editing remains backlog.
- Never trust client actor, role, permission, or scope values.

### Task 1: Read-only authorization and matrix contract

**Files:**
- Create: `src/lib/rbac/permissionMatrix.ts`
- Create: `src/lib/permissionUiReadOnly.test.mjs`
- Modify: `src/app/api/permissions/route.ts`
- Create: `src/app/permissions/layout.tsx`

- [ ] Write failing tests for unauthorized access, missing `permission.manage`, authorized access, inactive roles, empty grants, multiple scopes, and explicit mutation rejection.
- [ ] Run `node --test src/lib/permissionUiReadOnly.test.mjs` and verify the failure is caused by missing read-only implementation.
- [ ] Add typed matrix mapping and server-only route authorization using the authenticated session actor and `loadRbacActor`.
- [ ] Return all roles, including inactive and roles with no grants; expose only role metadata and permission/module/description/scope data.
- [ ] Make POST/PUT/PATCH/DELETE return controlled 405 responses.
- [ ] Run the focused tests and verify they pass.

### Task 2: Read-only matrix UI

**Files:**
- Modify: `src/app/permissions/page.tsx`

- [ ] Replace mutation controls and legacy checkbox columns with grouped role/module/permission/scope rendering.
- [ ] Preserve existing AppNav, responsive table/card behavior, active/inactive badges, reload state, and unauthorized redirect behavior.
- [ ] Add a simple role/status/search filter without client-side authorization decisions.
- [ ] Run focused source/UI contract tests and TypeScript.

### Task 3: Regression and release gates

**Files:**
- Create: `PHASE1A_FINAL_REPORT.md`

- [ ] Run Permission UI tests, RBAC core tests, Checkpoint 3 tests, Checkpoint 3.5 characterization, task/security suite, existing critical suite, TypeScript, changed-file ESLint, and production-safe Webpack build.
- [ ] Build a clean release from the branch with real public production build configuration and scan client assets for dummy/example values and server-only secrets.
- [ ] Deploy only through the existing reversible clean-release mechanism with RBAC still enabled, then smoke admin/unauthorized `/permissions`, task flows, attendance/leave/schedule/admin, logs, and mismatch counters.
- [ ] Record exact evidence and stop after Phase 1A closeout.
