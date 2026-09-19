# Journalism J6F — Reporting Dashboard v1

## Purpose and scope

J6F adds a read-only Journalism reporting page at `/journalism/reports`. It summarizes only Work-owned data from authorized Journalism Tasks, J6D manual publication reports, and J6E verification history. It has no create, edit, verify, delete, assignment, Topic/Series mutation, or CMS operation.

J6B remains **NO-GO** and J6C remains **NO-GO**. MasterCMS is completely disconnected.

## Authorization and data source

The page requires the existing authenticated session. The reporting repository reuses `getTaskScopeTerms` from the Task repository, which applies the same organization/department/related-task visibility rules used by Task Center. A department filter is rejected to an empty scoped result unless the actor has organization visibility or department-task visibility for that department. Aggregates are computed only from the authorized Journalism Task rows returned by that query; no company-wide service-role aggregate is exposed to the browser.

J6F does not add a reporting permission or RBAC grant. The navigation entry is visible to authenticated users because the page derives its data from their existing Task visibility. J6D/J6E permissions remain unchanged.

## Date and filters

The primary period is the Journalism Task `created_at` date, displayed in Asia/Ho_Chi_Minh. The default window is the current Vietnam calendar month through today. URL filters are allowlisted and validated: `from`, `to`, department, assignee, Topic, Series, Task status, Work publication status, and J6E verification status. Invalid UUIDs, dates, or enum values fall back safely. The query is bounded to 5,000 authorized rows and reports a warning if that safety cap is reached.

## Metric definitions

- `Tổng Journalism Task`: authorized, non-cancelled Journalism Tasks created in the selected window and matching filters; cancelled Tasks appear only when the explicit Task status filter is `cancelled`.
- `Đã ghi nhận xuất bản`: task has a J6D `journalism_publication_reports` row.
- `Chưa ghi nhận xuất bản`: total tasks minus tasks with a J6D report.
- `Đã xác minh`: a report whose newest current-version J6E decision is `verified`.
- `Chưa xác minh`: a report with no verification decision for its current report version and no prior history.
- `Bị từ chối`: a report whose newest current-version decision is `rejected`.
- `Cần xác minh lại`: a report with history but no decision matching the current report `updated_at`.
- `Quá hạn`: `due_date` is before the Vietnam current date and Task status is not `done` or `cancelled`, matching the existing Task Center overdue rule.

The assignee, department, Topic, and Series tables count each authorized Task once globally. For association tables, a Task is counted once per distinct Topic/Series association, so multiple associations do not inflate the global KPI totals. Assignee and department tables are operational workload tables, not performance rankings.

The recent-publication list is limited to 15 rows and the attention list to 20 rows. Attention rows are read-only links to Task detail for reports that are unverified/rejected/stale or overdue tasks without a report. Publication URLs are rendered as safe links only; they are never fetched or checked.

## Query architecture and performance

One bounded server-side Supabase query loads the Journalism Task/report/Topic/Series/verification graph after the existing Task scope lookups (the scope helper may perform its existing RBAC/assignment reads). Metrics are derived in one pure pass; there is no per-card RPC, per-task query, or browser-side unrestricted fetch. No migration, view, RPC, index, or materialized view is added.

J6F runtime requires the J6D and J6E database migrations to be applied before production activation. Those migrations, including the J6E RBAC grant preparation, remain unapplied in this checkpoint.

## UI

The page uses existing AppNav/layout conventions, summary KPI cards, URL-driven filters, responsive tables, empty/error states, bounded recent publications, and a read-only needs-attention section. It does not show CMS terminology, employee scores, rankings, grades, or mutation buttons.

## Tests and limitations

Focused tests cover metric derivation, duplicate Topic/Series handling, verification states, filter allowlisting/default window, authorization reuse, bounded lists, zero-data behavior, and read-only/CMS boundaries. J6E, J6D, J5E, Journalism regression, typecheck, lint, diff check, and build are run before commit.

The dashboard is an internal operational report. It does not prove that a reported URL is reachable or that an article exists in MasterCMS. If the safe 5,000-row cap is reached, all metrics and breakdowns are explicitly marked partial and the user is asked to narrow the date window.

## Next checkpoint

Recommend either **J6G — Manual Publication Reconciliation** or **J6 Release Preparation — J6D/J6E/J6F migration + production rollout plan**, depending on owner priority. Do not begin either automatically.
