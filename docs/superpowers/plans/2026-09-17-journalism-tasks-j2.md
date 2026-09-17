# Journalism Tasks J2 Schema and Read Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved Journalism Tasks v1 schema, controlled work-kind data, and parent-authorized server read composition/filtering without adding any Journalism mutation, UI, grant, or deployment.

**Architecture:** `tasks` remains the only Task resource and authorization boundary. `journalism_task_details` is an optional one-to-one extension; row existence is the sole Journalism discriminator. Reads compose one joined/nested journalism object inside existing list/detail repository queries so pagination and Task scope remain database-side and no N+1 query is introduced.

**Tech Stack:** PostgreSQL/Supabase migrations, Next.js 16 route handlers, TypeScript, Node test runner, ESLint.

**Spec:** `JOURNALISM_TASKS_J1_CONTRACT.md`

## Global Constraints

- Start from commit `3b7f865b7722e9a67e17a7a4d845f1ccc8ede407` on branch `journalism-tasks-j2-schema-read`.
- Do not run `supabase db push` or `supabase db reset`; do not replay unresolved legacy migrations.
- Do not apply the J2 migration to production and do not deploy.
- Do not add a Journalism create/update/publication endpoint, RPC, UI, recurrence support, RBAC permission, or grant.
- Do not add `task_domain`, `task_kind`, `content_format`, `source_contact_notes`, CMS fields, topic/series IDs, or related-task IDs.
- Normal tasks remain unchanged and compose `journalism: null`.
- Parent Task authorization is mandatory before returning Journalism metadata.
- Run all production-code work test-first and capture red/green evidence.

---

### Task 1: Add J2 contract tests and additive migration

**Files:**
- Create: `src/lib/journalismTaskSchema.test.mjs`
- Create: `supabase/migrations/20260917190000_journalism_tasks_j2_schema.sql`

**Interfaces:**
- Produces tables `journalism_work_kinds` and `journalism_task_details` plus the exact ten approved seed rows.
- Produces no mutation RPC and no direct public table API.

- [ ] **Step 1: Write failing source-contract tests**

Test the migration text for the exact columns, absence of forbidden columns, seed codes/names/order, FK `ON DELETE RESTRICT`, publication checks, length checks, minimal HTTP(S) URL DB check, indexes, RLS/revokes, service-role grants, and no mutation RPC.

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --test src/lib/journalismTaskSchema.test.mjs`

Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Implement the migration**

Create the two approved tables, constraints, indexes, RLS/privileges, timestamps, and idempotent controlled seed upsert. Keep URL DB validation minimal (`http://` or `https://`, length <= 2048); document robust parsing as a future service-layer requirement.

- [ ] **Step 4: Run the new test and verify GREEN**

Run: `node --test src/lib/journalismTaskSchema.test.mjs`

- [ ] **Step 5: Validate SQL without production application**

Inspect the production migration ledger read-only, record unresolved versions, compute the migration checksum, and validate the exact file on an isolated scratch PostgreSQL/Supabase environment if available. If no safe database is available, use explicit SQL/source validation and record that limitation; do not touch production.

### Task 2: Add DTOs, query parsing, and repository read composition

**Files:**
- Create: `src/lib/journalismTaskRead.test.mjs`
- Modify: `src/lib/taskContracts.ts`
- Modify: `src/lib/taskHandlerFactory.ts`
- Modify: `src/lib/taskRepository.ts`

**Interfaces:**
- Adds `JournalismWorkKindDto`, `JournalismTaskListSummaryDto`, and `JournalismTaskDetailDto`.
- Adds `journalism: ... | null` to Task list/detail DTOs.
- Adds optional query fields for Journalism classification, work kind code, publication status, and planned-publication date bounds.

- [ ] **Step 1: Write failing read-contract tests**

Test that list/detail selects compose the nested detail/work-kind object, list filtering stays in the database query, the detail handler authorizes the Task before loading detail, no direct Journalism route exists, and no per-item query loop is introduced.

- [ ] **Step 2: Run the read test and verify RED**

Run: `node --test src/lib/journalismTaskRead.test.mjs`

- [ ] **Step 3: Implement DTOs and query parsing**

Use nullable additive fields. Reject malformed work-kind/status/date filters with existing parser behavior; allow only the four approved publication values.

- [ ] **Step 4: Implement one-query list/detail composition**

Extend Supabase select strings with the one-to-one detail and work-kind relation. Apply Journalism/normal/work-kind/publication/planned-time filters after the existing authorization scope and before `.range()`. Do not fetch all tasks or perform client-side filtering.

- [ ] **Step 5: Run read and existing task tests**

Run the new read test plus task filter/repository/handler authorization suites and confirm GREEN.

### Task 3: Validate isolated schema behavior and regression gates

**Files:**
- Modify only test/support files if a validation defect is found; follow a new red-green cycle for every correction.

- [ ] **Step 1: Run schema and read security tests**

Verify one-to-one FK, invalid work kind, delete restriction, publication-state constraints, optional field lengths, URL semantics, inactive historical reads, direct anon/authenticated denial, normal-task null composition, authorized Journalism composition, pagination, and no N+1.

- [ ] **Step 2: Run critical regression suites**

Run Phase 1A RBAC/task workflow suites and focused attendance/leave/schedule suites. Record exact counts.

- [ ] **Step 3: Run static gates**

Run `npx tsc --noEmit`, changed-file ESLint, and `git diff --check`.

- [ ] **Step 4: Run production-safe Webpack build**

Use the established non-secret production-safe public configuration and `npx next build --webpack`. Do not copy production `.env` into the worktree.

### Task 4: Produce the J2 report and finish the branch

**Files:**
- Create: `JOURNALISM_TASKS_J2_REPORT.md`

- [ ] **Step 1: Write the report**

Include sections A-Q required by the owner, exact migration checksum, schema/seed/constraint/index rationale, RLS/grants, query behavior, test commands/counts, build results, `NOT APPLIED` production state, rollback design, and J3 recommendation.

- [ ] **Step 2: Verify the report against fresh evidence**

Re-run or quote only commands whose outputs were captured after the final code change. Scan for secrets and placeholders.

- [ ] **Step 3: Commit and push**

Commit all scoped files, push `journalism-tasks-j2-schema-read`, and verify local HEAD equals remote HEAD with a clean worktree.

- [ ] **Step 4: Stop**

Do not apply the migration, deploy, start J3, add RBAC grants, or implement UI.
