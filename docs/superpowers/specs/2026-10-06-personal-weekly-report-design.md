# Personal Weekly Work Report Design

**Status:** Owner-approved design and migration proposal

**Scope:** Phase 1 employee self-service weekly report, next-week plan, and Word export. Production deployment is out of scope.

## Goal

Allow each employee to prepare one Friday-to-Friday report containing current-week results, next-week plans, and difficulties/recommendations, while reusing canonical Tasks, Department Plan links, Quick Reports, and the existing Personal Plan approval flow.

## Existing Canonical Model

- Standard work remains in `public.tasks`, with participants in `public.task_assignees` and Department Plan linkage through `public.department_plan_items.linked_task_id`.
- Quick Reports remain canonical `tasks` with `workflow_type = 'REPORT_ONLY'`, owned by the authenticated employee and dated by `report_work_date`.
- Department Plan continuation metadata is read from the existing linked item/task fields (`period_relation`, `carry_forward`, `recurrence_rule_id`, and canonical task status).
- New employee-entered next-week work is created through `work_schedules` with `schedule_scope = 'personal'` and the existing create/review approval RPCs. It never creates a fake assigned Task.
- Weekly boundaries use `src/lib/departmentPlanPeriod.ts`: Friday start through the following Friday boundary. The report displays the same canonical dates used by planning.
- Existing `/reports/work` is management-scoped and remains unchanged. The new employee route has separate self-only authorization.
- Existing `docx` utilities are reused; export receives the same report view model used by the UI.

## Alternatives Considered

1. **One report row plus JSON draft/snapshot (selected).** Minimal schema, preserves exact historical content, and keeps Task/Plan data canonical.
2. Normalized report header, result rows, and plan rows. More joins and mutation surface without a Phase 1 benefit.
3. `audit_logs` as report history. Rejected because it cannot safely provide employee self-only reads, draft editing, or a stable report dataset.

## Data Model

Add `public.personal_weekly_reports`:

- `id uuid primary key`
- `employee_id` and `department_id` foreign keys
- `period_start`, `period_end`
- `status` in `DRAFT` / `COMPLETED`
- `draft_payload jsonb` for editable period-specific commentary, selected continuation rows, new-plan references, and difficulties
- `snapshot_payload jsonb` populated only when completed
- `difficulties`, `completed_at`, `created_at`, `updated_at`
- unique `(employee_id, period_start, period_end)`
- check requiring `COMPLETED` rows to have a snapshot and completion timestamp, while drafts do not
- index by employee and newest period

The snapshot stores employee/department labels, period boundaries, current-week rows, next-week rows/proposal references, difficulties, and completion time. Each result row contains canonical identifiers plus the displayed title/source/deadline/status and period-specific commentary. This prevents later Task edits from rewriting a completed report.

## Server API and Authorization

- `GET /api/reports/weekly`: derive employee from the authenticated session; never accept a client `user_id`. Load the current period, existing draft or completed snapshot, and a bounded history list.
- `POST /api/reports/weekly`: create/update the actor's draft through a server-side RPC. Reject edits to completed reports.
- `POST /api/reports/weekly/complete`: in one transaction, revalidate ownership and period, build the canonical view model, persist the immutable snapshot, and mark the report completed. Repeated completion is idempotent and does not rewrite the snapshot.
- `GET /api/reports/weekly/docx`: export the same completed snapshot/view model returned to the UI. Do not query live Task fields for a completed report.
- RPCs are `SECURITY DEFINER`, callable only by the server role; direct table/RPC access for anonymous/authenticated clients is revoked.
- Read/list/update/export predicates require `employee_id = p_actor` and active staff membership.

## Current-Week Aggregation

1. Query active canonical Tasks relevant to the actor and the Friday-to-Friday period.
2. Include Department Plan-linked Tasks and `REPORT_ONLY` Quick Reports whose canonical report date is inside the period.
3. Include tasks through `task_assignees` and the legacy owner/assignee columns, excluding watcher-only memberships.
4. Deduplicate by canonical `task_id`, preferring the richest Department Plan/Task row while retaining source labels.
5. Exclude cancelled work from current result rows only when existing Work Report semantics exclude it; never alter the Task.
6. Allow period-specific result text/commentary in the report payload, never in canonical Task title/status/description fields.

## Next-Week Plan

- Reuse the same canonical `task_id` for active `LONG_RUNNING` and `CARRY_OVER` work.
- Exclude canonical `done` and `cancelled` tasks.
- Include recurrence only when the existing recurrence rule is valid for the next period; do not manufacture recurrence.
- New work is submitted through the existing Personal Plan `work_schedules` proposal/approval flow. The report stores the resulting proposal reference and display snapshot; it does not assign a Task.
- Duplicate task IDs are removed before save and completion.

## UI and Navigation

Add one employee-facing `Báo cáo tuần` entry alongside the existing personal schedule/report affordances without restructuring the sidebar. The page has three sections: current results, next-week plan, and difficulties/recommendations. Draft actions are `Lưu nháp` and `Hoàn thành báo cáo`; completed reports expose `Xuất Word`. History is newest-first with bounded pagination. On narrow screens, rows become cards or a horizontally scrollable table while actions remain reachable.

## Migration and Immutability

The migration adds only `personal_weekly_reports`, its index/constraints, the bounded RPCs, and grants/revokes needed for server-only access. A completed row is immutable through the completion RPC guard and a database trigger/RLS policy that rejects updates/deletes after completion. No existing Task, Department Plan, Quick Report, Personal Plan, or attendance schema is changed.

## Testing

Before implementation code, tests cover cases A-N: five assigned tasks, two REPORT_ONLY rows, source deduplication, LONG_RUNNING/CARRY_OVER reuse, completed/cancelled exclusion, Personal Plan proposals, cross-user denial, immutable snapshot, UI/export dataset equality, exact Vietnamese text, Friday-to-Friday dates, and mobile layout. Regression suites cover Task Center, Work Report, Department Plan summaries, Personal Plan/approval, Quick Report, Attendance and late exceptions, LONG_RUNNING/CARRY_OVER, bulk cancel, and Task/Plan cancellation sync. TypeScript, changed-file lint, diff-check, and production-like build are required. No production deployment is performed in Phase 1.

## Self-Review

- All requested data sources reuse existing canonical entities.
- Snapshot immutability is explicit and cannot be satisfied by `audit_logs` alone.
- Self-only access is enforced from the session actor, not client input.
- The migration is limited to the new report persistence and its server guards.
- No management reporting, RBAC redesign, or production mutation is included.
