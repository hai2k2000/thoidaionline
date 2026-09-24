# Task Approval Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add manager approval gates for self-created tasks and completion without replacing the existing Task model.

**Architecture:** Add additive `tasks.approval_required` metadata and reuse `waiting`, `pending_review`, `in_progress`, `done`, and `rejected`. Extend existing RPC/repository/handler layers and add manager queue views in the current Task Center.

**Tech Stack:** Next.js, TypeScript, Supabase PostgreSQL RPC migrations, Node test runner.

**Spec:** User-approved Task Approval Workflow specification in the conversation.

## Global Constraints

- Existing tasks default to `approval_required=false`; no retroactive conversion.
- Existing self-claim `waiting` semantics remain unchanged.
- No parallel approval table, Task model, or duplicate API family.
- Server-side scope and self-approval guards are authoritative.
- Journalism scope and existing regressions remain unchanged.
- Do not deploy production.

### Task 1: Contract Tests and Migration

**Files:**
- Create: `supabase/migrations/20260924120000_task_approval_gates.sql`
- Create: `src/lib/taskApprovalWorkflow.test.mjs`

- [ ] Write failing source-contract tests for additive column, queue predicates, transitions, scope, audit/status events.
- [ ] Run the focused test and confirm failure.
- [ ] Add idempotent migration with additive column and updated existing RPCs.
- [ ] Run focused test and confirm pass.

### Task 2: Repository and Server Handlers

**Files:**
- Modify: `src/lib/taskContracts.ts`
- Modify: `src/lib/taskRepository.ts`
- Modify: `src/lib/taskHandlerFactory.ts`
- Modify: `src/app/api/tasks/claim/review/route.ts`
- Create: `src/app/api/tasks/approval/route.ts`

- [ ] Add approval metadata to DTO and repository projection.
- [ ] Add manager-scoped queue reads and existing-RPC review mutations.
- [ ] Add server handlers for assignment/completion approval actions with reason validation.
- [ ] Preserve old self-claim review route behavior.

### Task 3: Manager Queue UI

**Files:**
- Modify: `src/app/tasks/page.tsx`
- Modify: `src/components/TaskCenterShell.tsx`
- Modify: `src/components/TaskDetailShell.tsx`

- [ ] Add approver capability and server-loaded queue data.
- [ ] Add `Chờ duyệt giao việc` and `Chờ duyệt hoàn thành` tabs with scoped rows/actions.
- [ ] Replace completion action label for approval-required assignees with `Gửi duyệt hoàn thành`.
- [ ] Show approval status labels without changing normal/Journalism separation.

### Task 4: Regression and Release Validation

**Files:**
- Modify: `src/lib/taskApprovalWorkflow.test.mjs`
- Modify: relevant task UI tests if needed.

- [ ] Run focused workflow tests and all requested regressions.
- [ ] Run TypeScript, canonical baseline, route manifest, standalone build and artifact verification.
- [ ] Commit feature and create experimental artifact only.
