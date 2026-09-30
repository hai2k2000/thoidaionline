# Global Creator-Until-Approval Mutation Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce creator-only edit/cancel before approval, admin-only edit/cancel after approval, and immutable cancellation for Tasks, Journalism Tasks, Leave Requests, and Personal Work Schedules across UI, server, service, and database RPC layers.

**Architecture:** Add one shared TypeScript lifecycle authorization helper plus module adapters that map native statuses to `PENDING`, `APPROVED`, or `CANCELLED`. Keep Department Plans, Leadership Event Assignments, Journalism publication transitions, Online Work, Attendance, sync, and audit/history outside this phase. Add additive fail-closed RPC guards and audit logging for supported mutations.

**Tech Stack:** Next.js/TypeScript, Supabase/PostgreSQL security-definer RPCs, Node test runner, existing authorization and repository patterns.

**Spec:** Owner-approved `GLOBAL MUTATION POLICY AUDIT` and decisions in the task conversation.

## Global Constraints

- No production deployment in this phase.
- Do not modify `/opt/thoidai-work`, Docker volumes, backups, attendance/sync/audit records, or excluded workflows.
- Migration changes are additive and fail closed.
- Direct API/RPC calls must enforce the same policy as the UI.
- Cancelled records are immutable.

### Task 1: Shared policy and module adapters

**Files:**
- Create: `src/lib/creatorMutationPolicy.ts`
- Test: `src/lib/creatorMutationPolicy.test.mjs`
- Modify: `src/lib/authorization.ts`

- [ ] Write failing tests for pending creator, approved creator, approved non-creator, admin override, cancelled immutable, and null creator fail-closed.
- [ ] Run the focused test and confirm failure because the shared helper is absent.
- [ ] Implement normalized lifecycle state and strict `canEdit`/`canCancel` helpers.
- [ ] Route task edit/cancel decisions through the helper while preserving stricter workflow rules.
- [ ] Run the focused test and existing authorization tests.

### Task 2: Task and Journalism Task server enforcement

**Files:**
- Modify: `src/lib/taskHandlerFactory.ts`, `src/lib/taskHandlers.ts`, `src/lib/taskRepository.ts`
- Create: `supabase/migrations/20260930100000_global_creator_mutation_policy.sql`
- Test: `src/lib/globalMutationPolicy.integration.test.mjs`

- [ ] Add failing source-contract tests covering every task edit/cancel entry point and journalism task inheritance.
- [ ] Run them red.
- [ ] Update server authorization and repository mutation paths to use creator/state policy.
- [ ] Add additive RPC guards for task update, personal edit/cancel, assigned cancel, and deadline mutations with row locking and audit logs.
- [ ] Verify direct RPC bypass tests cover creator, non-creator, admin, approved, pending, and cancelled cases.

### Task 3: Leave request edit/cancel

**Files:**
- Modify: `src/app/api/leave-requests/route.ts`
- Create/modify: `src/lib/leaveRequestRepository.ts`
- Modify: `supabase/migrations/20260930100000_global_creator_mutation_policy.sql`
- Test: `src/lib/leaveMutationPolicy.test.mjs`

- [ ] Add failing tests for pending creator edit/cancel, approved admin edit/cancel, approved creator denial, cancelled denial, and direct RPC enforcement.
- [ ] Add edit API/RPC with strict field validation, row lock, state check, and audit log.
- [ ] Extend cancel RPC for admin override while retaining creator pending-only access.
- [ ] Run focused leave tests and existing leave workflow tests.

### Task 4: Personal Work Schedule enforcement

**Files:**
- Modify: `src/lib/workScheduleRepository.ts`, `src/app/api/work-schedule/personal/route.ts`, related personal schedule handlers
- Modify: `supabase/migrations/20260930100000_global_mutation_policy.sql`
- Test: `src/lib/personalWorkScheduleMutationPolicy.test.mjs`

- [ ] Add failing tests for pending creator edit/cancel, approved creator denial, approved admin override, cancelled denial, and direct RPC enforcement.
- [ ] Enforce policy in personal schedule update/cancel RPCs and API path.
- [ ] Keep Leadership Event Assignment and organization schedule workflow unchanged in this phase.

### Task 5: UI consistency and regression matrix

**Files:**
- Modify: task, leave, and personal work schedule UI components discovered by the audit.
- Test: `src/lib/globalMutationPolicyUi.test.mjs`

- [ ] Add failing tests that action visibility follows the shared policy and never grants assignee/reviewer/manager/TBT/PTBT mutation solely by role.
- [ ] Update UI action guards and disabled/error states.
- [ ] Run focused tests, full regression suite, lint, TypeScript, and `git diff --check`.

### Task 6: Review and commit

- [ ] Inspect migration for additive/fail-closed behavior and excluded modules.
- [ ] Verify worktree status and diff.
- [ ] Commit implementation without pushing or deploying.
- [ ] Report exact test evidence and `READY FOR DEPLOY APPROVAL: YES/NO`.
