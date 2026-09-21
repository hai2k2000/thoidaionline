# Event Assignment v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add server-authorized leadership-created organization events with normalized reporter assignments and calendar visibility, without touching Personal Plans, Tasks, Online Work, or J6.

**Architecture:** Extend `work_schedules` additively with leadership-event metadata and keep a normalized assignment relation authoritative. Dedicated security-definer RPCs provide atomic create/update/status operations; a dedicated API and focused UI call those RPCs while legacy organization and Personal Plan routes remain separate.

**Tech Stack:** Next.js 16, TypeScript, Supabase/PostgreSQL PL/pgSQL, Node test runner, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-21-event-assignment-v1-design.md`

## Global Constraints

- Do not apply the migration or activate a production artifact.
- Preserve Personal Plan approval, Online Work, Tasks, J6, and organization schedule authorization.
- Use Asia/Ho_Chi_Minh civil date/time validation without UTC date shifting.
- Do not create Task rows or call Task RPCs.
- Server-side authorization is authoritative.

---

### Task 1: Domain And Security Tests

**Files:** Create `src/lib/eventAssignment.test.mjs` and `src/lib/eventAssignmentValidation.ts`.

**Interfaces:** `validateEventAssignmentInput(input)` returns `{ ok: true }` or `{ ok: false, reason: string }`.

- [ ] Write role, scope, reporter, duplicate, multi-day HH:mm, authorization, visibility, and isolation tests.
- [ ] Run focused tests and confirm RED because contracts are absent.
- [ ] Implement the minimal pure validator with `validateLocalPlanInterval`.
- [ ] Re-run focused tests and confirm GREEN.

### Task 2: Additive Migration And RPCs

**Files:** Create `supabase/migrations/20260921150000_event_assignment_v1.sql` and extend the focused tests.

**Interfaces:** RPCs `api_create_event_assignment`, `api_update_event_assignment`, and `api_set_event_assignment_status`.

- [ ] Add columns, constraints, indexes, assignment table, and grants/revokes.
- [ ] Implement creator/reporter scope, duplicate rejection, row locking, participant projection, revision, and audit snapshots.
- [ ] Cover all six required audit actions.
- [ ] Run migration contract tests and a transactionally rolled-back SQL smoke test.

### Task 3: Repository And API

**Files:** Create `src/app/api/work-schedule/events/route.ts`; modify `src/lib/workScheduleRepository.ts`, validator, and tests.

**Interfaces:** Repository methods `listEventAssignments`, `saveEventAssignment`, and `setEventAssignmentStatus`; GET/POST/PATCH event API.

- [ ] Write API/repository contract tests and confirm RED.
- [ ] Implement strict parsing, bounded ranges, revision handling, and RPC error mapping.
- [ ] Merge assigned events into reporter calendar reads without weakening the organization route.
- [ ] Run focused tests and confirm GREEN.

### Task 4: Leadership And Reporter UI

**Files:** Create `src/components/EventAssignmentPanel.tsx`; modify `WorkSchedulePageShell.tsx` and the three work-schedule pages.

**Interfaces:** Leadership panel renders the form/list. Assigned rows include event discriminator, status, type, creator, and participants.

- [ ] Write UI contract tests and confirm RED.
- [ ] Implement the focused leadership panel with multi-select and status controls.
- [ ] Render `Duoc phan cong`, assigner, description, and status in reporter calendar cards.
- [ ] Confirm UI tests GREEN.

### Task 5: Verification And Artifact

**Files:** Modify `PROJECT_STATUS.md`.

- [ ] Run focused Event Assignment tests.
- [ ] Run organization schedule, Personal Plan, and Online Work regressions.
- [ ] Run TypeScript, scoped ESLint, and production build.
- [ ] Review diff and scan secrets/runtime files.
- [ ] Create a new immutable artifact without activation.
- [ ] Commit and push `feature/event-assignment-v1`.

## Definition Of Done

Required tests, TypeScript, ESLint, and build pass; migration is not applied; artifact is not activated; production is unchanged; branch is pushed and clean.
