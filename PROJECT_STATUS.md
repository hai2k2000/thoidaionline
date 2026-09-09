Current Phase: Attendance reporting views
Current Task: COMPLETE — notification proxy load fix

Latest Task: COMPLETE — seed September 2026 foreign-language online work schedule

Latest Update: COMPLETE — weekends default to full-team online work

Completed:
- Changed notification event queries to process task ID batches sequentially, preventing proxy 502/notification 500 errors for accounts with large task lists.
- Batched participant-task lookups and notification-read keys so long UUID/key filters stay below the VPS proxy limit.
- Duty schedule viewer now distinguishes loading, API failure, and a genuinely empty schedule instead of silently rendering empty cards after a failed request.
- Limited Wise Eye realtime reads and pending-request polling to 07:30–09:30 and 16:30–18:30; admin requests created outside those windows wait for the next window or the 18:30 reconciliation.
- Moved the daily reconciliation task to 18:30 and updated the attendance page schedule guidance.
- Fixed the work schedule table identity columns so “STT” and “Họ và tên” keep readable widths instead of wrapping one character per line; day columns remain horizontally scrollable.
- Removed Saturday/Sunday assignments from the September foreign-language schedule; weekends are intentionally left blank as the default full-team online days.
- Viewer now labels empty weekend cards “Mặc định cả tổ / Cả tổ ngoại ngữ” instead of “Chưa phân công”.
- Added the September 2026 online foreign-language schedule from the supplied spreadsheet: 28 active days and 72 assignments.
- Chinese-language days include both Chinese reporters; “Các tổ làm online” days include all six foreign-language reporters.
- Added a long-running Windows bridge that polls Wise Eye logs every 5 seconds, sends only unseen punches, and spools failed requests for retry.
- Added token-protected realtime punch API that upserts punches and recomputes the employee's daily first/last times.
- Configured per-user Windows Startup launch because Scheduled Task creation requires administrator rights on this workstation.
- Sync requests now carry the selected period and date range; the Windows bridge filters device punches to that range before import.
- Daily scheduled sync continues to request the current local day.
- Removed any persisted demo attendance rows (none remained in production); real Wise Eye rows are preserved.
- Attendance API and page now support day, week, and month periods using the selected date as the anchor.
- Wise Eye On 39 bridge reads the device through the 32-bit zkemkeeper SDK and imports punches through a token-protected API.
- Admin attendance page has an accessible “Đồng bộ ngay” action with live sync status and a daily 18:00 schedule indicator.
- Attendance migration creates punch/request/log tables and maps 24 confirmed staff codes; Thanh Ngọc/code 10 and six absent device users are skipped.
- Duplicate active sync requests are prevented and bridge failures mark requests as failed.
- Organization evaluation summary remains readable by every signed-in employee.
- Personal attendance is served through a server-guarded API and scoped to the signed-in employee.
- Organization-wide attendance is available only to admin accounts.
- `/attendance` and `/my-attendance` enforce authentication server-side.
- Workflow document downloads require a signed-in employee and read from private runtime storage.
- Assigned-task approval requires a completion score from the current submission attempt; returning a task clears the previous score.
- Approved assigned tasks persist `progress_percent=100`.
- Admin edits cannot bypass the assigned-task submission/fresh-score flow.
- Leadership assignment now accepts mapped department heads consistently in UI/server/database.

Validation:
- Notification load fix: targeted service-role reproduction passes across all task/read batches; production build PASS; service active; authenticated production smoke returns HTTP 200 for notifications and duty schedule.
- Attendance window rollout: PowerShell bridge parse PASS; outside-window `-Once` exits without device/API work; one realtime process running; daily task scheduled at 18:30; production build PASS; service active after restart.
- Work schedule table layout fix: production build PASS; service active after restart; production route responds (HTTP 307 authentication redirect).
- September schedule RPC cancelled 48 weekend assignments and kept 24 weekday assignments unchanged.
- Pre-change database backup created; production query confirms weekend rows are empty.
- Pre-change database backup created.
- Schedule RPC completed successfully and audit entries were written.
- Production query confirms 72 active September assignments across 28 dates.
- Realtime bridge PowerShell parse PASS and process stays running; existing 8 punches remain deduplicated.
- Production build PASS, service healthy, commit pushed.
- Month-range validation sync PASS: 6 punches imported for July 2026, 4 matched users, 5 daily logs; duplicate-safe upsert preserved existing rows.
- Demo cleanup query completed with zero demo rows remaining.
- Production build PASS after period filter changes.
- Service restarted and healthy.
- Production database backup created before migration.
- Migration applied successfully; 24 staff mappings verified.
- Production build PASS; service restarted and healthy.
- Windows scheduled tasks created: polling every minute and daily sync at 18:00.
- End-to-end demo sync PASS: 8 punches received, 4 matched users, 6 daily logs, code 10 excluded.
- Targeted leadership assignment contract and participant-selection tests: PASS (7/7).
- Supabase migration `20260830100000_fix_leadership_assignment_scope`: PASS on internal Supabase DB.
- Leadership smoke-check confirms active department heads are accepted for leadership assignment.
- One legacy Phase 6 UI contract test remains stale: it expects a `description` form field while the current form uses `requirements`.
- Backend security hardening build: PASS (`npm run build`).
- Backend security hardening tests: PASS (5/5).
- Targeted lint: PASS (0 errors, 1 warning before dependency fix; PASS after dependency fix).
- Migration `20260901095000_backend_security_hardening`: PASS with database backup and anon probes returning 401/42501.
- Runtime dependency audit: PASS (`npm audit --omit=dev --audit-level=high`, 0 vulnerabilities) after upgrading Next.js to 16.3.4 and Supabase JS to 2.112.4.
- Production dependency/build smoke: PASS (Next.js 16.3.4, service active, protected APIs return 401, security headers present).

Blockers:
- Windows Scheduled Task registration is denied for the current non-admin account; Startup launch is configured instead.

Follow Up:
- Password fallback `123456` remains unchanged by explicit user instruction for active accounts `admin`, `thanhhai`, `maianh`, and `quangthien`.
- Existing legacy HR files under `public/uploads/hr` should be migrated manually if any are found; new HR files use guarded runtime storage.
- Service still runs as root and deploy process should be moved to an atomic non-root release workflow in a separate change.
- The production database does not currently contain `attendance_logs`; the UI keeps the existing server-generated DEMO fallback until the attendance migration is provisioned.
- Legacy seeded assigned tasks may remain in `new` status; they are outside the new assignment flow and should be triaged separately if users report them.
- Four seeded assigned tasks remain `pending_review` without a completion score and require triage or a fresh assignee submission before approval.
- Update the stale Phase 6 UI contract test to assert `requirements` instead of `description`.
- Full audit still reports four high dev-tooling vulnerabilities (`brace-expansion`, `flatted`, `js-yaml`, `picomatch`) and one low advisory; remediate in a separate dependency-maintenance task.

Next:
- Monitor the first scheduled 18:30 reconciliation run and reconcile any additional device users if the hardware roster changes.
- Existing dev-tooling audit findings, stale UI contract test, and non-root service follow-up remain separate tasks.
