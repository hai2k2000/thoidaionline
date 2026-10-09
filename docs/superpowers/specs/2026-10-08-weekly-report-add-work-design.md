# Weekly Report Add-Work Design

## Goal

Allow an employee to add eligible existing canonical Tasks or a new `REPORT_ONLY` Quick Report item to a reopened weekly-report draft, without changing completed version history or next-week planning semantics.

## Scope

- Reuse the existing `personal_weekly_reports.draft_payload` and `snapshot_payload` contracts.
- Reuse canonical Task hydration and `task.quick_report.create` authorization.
- Add server-side candidate filtering and draft allow-list validation.
- Add draft-only add/remove controls in Section II of the weekly report UI.
- Preserve shared UI/DOCX view-model behavior and immutable version snapshots.

## Non-goals

- No migration unless an implementation test proves the existing JSON/RPC contract cannot represent the feature.
- No changes to canonical Task semantics, Department Plan, Personal Plan, Attendance, or Quick Report business rules.
- No production deployment in this phase.

## Data and security rules

- The server derives the actor from the authenticated session and never trusts browser `user_id` or `employee_id`.
- Existing Task candidates must be owned by or actively assigned to the actor, fall within the canonical Friday-to-Friday period, and not be cancelled or watcher-only.
- Candidate Task IDs are validated against the server-loaded allow-list before draft save or completion.
- Existing Task commentary is report-local; canonical Task fields are never updated.
- Removing a row changes only the current report draft. It never deletes, cancels, or unlinks a canonical Task or Quick Report.
- Quick Report creation uses the existing service/RPC and creates only `workflow_type = REPORT_ONLY`; its work date must be inside the edited period.
- Completed Version 1 is read only. Re-completion creates Version 2 through the existing completion path and snapshots the newly selected rows.

## View-model contract

The weekly report load adds an `addableCurrentRows` collection and a `canCreateQuickReport` boolean for the current authenticated employee. Existing `currentRows` remains the canonical/selected display source. Draft rows retain `taskId` plus report-local commentary fields.

## API contract

- `GET /api/reports/weekly` returns the existing load model plus candidate rows and Quick Report capability.
- `POST /api/reports/weekly` and `/complete` accept the existing draft payload shape; the service validates current rows against the server allow-list before invoking existing RPCs.
- A new narrow authenticated route may proxy the existing Quick Report service for the selected period only; it must reject dates outside the period and must not accept actor IDs from the client.

## UI contract

In DRAFT, including reopened DRAFT, Section II shows `+ Thêm công việc`. The modal offers `Chọn từ công việc đã có` and `Thêm việc phát sinh`. Existing Tasks support multi-select and report-local commentary. Newly selected rows can be removed with `Bỏ khỏi báo cáo`. Completed and historical views remain read-only.

## Validation

Cases A-K from the owner request must pass, plus existing weekly report/reopen/version, Quick Report, and Personal Plan regressions. Run TypeScript, changed-file lint, `git diff --check`, route checks, and a production-like build only if the disk gate permits. Production remains unchanged.
