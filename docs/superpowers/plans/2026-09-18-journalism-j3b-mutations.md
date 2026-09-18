# Journalism J3B Mutations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement atomic Journalism creation, metadata mutation, publication mutation, approved RBAC grants, audit atomicity, and regression coverage without production action.

**Architecture:** Add one migration strictly after the repository's latest migration. Use server-only SECURITY DEFINER RPCs with fixed search paths and explicit service-role execution, while API routes authenticate and authorize the parent Task plus Journalism permission/scope before invoking them. Reuse `api_assign_task_v2` for parent creation and lock Journalism detail rows for mutations.

**Tech Stack:** Next.js App Router, TypeScript, Supabase/PostgreSQL PL/pgSQL, existing RBAC/task repository conventions, Node test harness.

**Global Constraints:** No production migration/deploy/restart; no J2/R2 replay; exactly two permissions and 12 grants; no Journalism UI/CMS/recurrence/conversion; preserve J2 read aliases and current 17/116 live baseline.

### Task 1: Baseline and migration contract

- [ ] Inspect latest migration filename and current function signatures.
- [ ] Add exactly two permission rows and 12 deterministic role tuples.
- [ ] Add server-only transactional RPCs with fixed `search_path` and revoke public/anon/authenticated execute.
- [ ] Verify isolated 19/128 counts and sorted tuple hash.

### Task 2: Red tests for API contracts

- [ ] Add failing tests for create DTO/active kind/recurrence rejection and atomic rollback.
- [ ] Add failing tests for metadata scope/state/date rules and minimized audit payload.
- [ ] Add failing tests for publication transitions, URL, withdrawal, row-lock race, and direct-table denial.

### Task 3: Server implementation

- [ ] Implement parent Task authorization plus Journalism permission/scope checks.
- [ ] Implement create route invoking one transactional RPC.
- [ ] Implement metadata route with allowed fields only and state-aware planned date rules.
- [ ] Implement publication route with locked state machine, server timestamps, URL and reason validation.
- [ ] Ensure audit failures roll back and no `task_status_events` are written.

### Task 4: Gate verification and report

- [ ] Run isolated DB/PostgREST, authorization, concurrency, J2 read, module, TypeScript, lint, diff-check, and build gates.
- [ ] Confirm production unchanged and record migration checksum/blob.
- [ ] Commit/push implementation, tests, migration, and report only after all gates pass.
