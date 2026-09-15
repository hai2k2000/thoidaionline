Current Phase: Attendance bridge operations
Current Task: COMPLETE — leave requests and attendance notes

Current Task Update: IN PROGRESS — employee leave history month/status filters

Latest Security Hardening: COMPLETE — web login attempts are rate-limited per client and account

Latest Network Hardening: COMPLETE — Next.js binds to localhost behind Nginx

Latest Remote Access Hardening: COMPLETE — WireGuard server provisioned with three independent peers

Current Task Update: COMPLETE — department deputy task assignment enabled

Latest Task: COMPLETE — approved leave and online work notes

Latest Update: COMPLETE — approved leave and online work are shown in attendance notes

Latest Authentication Fix: COMPLETE — first-login accounts now use the documented default password

Latest Attendance Workflow Update: COMPLETE — business-trip requests are clearly available beside leave requests

Latest Work Schedule Privacy: COMPLETE — regular employees can only view their own plans

Completed:
- Employee leave history now has independent month/all-time and status filters, scoped to the authenticated user's own requests.
- Closed unused IPv6 ingress for WireGuard UDP 51820 because all provisioned peers use IPv4 endpoints.
- Provisioned `wg0` on the VPS at `10.66.0.1/24` over UDP 51820 with three unique split-tunnel peers (`10.66.0.2`–`10.66.0.4`), persistent startup, and explicit firewall rules preserving WireGuard and SSH recovery access.
- Bound the production Next.js listener to `127.0.0.1:3001`; Nginx remains the only public application entry point.
- Added the same bounded request validation and five-attempt/15-minute throttle used by mobile login to the web login endpoint; successful authentication clears the counter and blocked requests return HTTP 429 with `Retry-After`.
- Restricted employee work-schedule queries, pages, and navigation so regular employees only receive their own plan; organization and leadership schedules remain available to authorized leaders and admin.
- Enabled task assignment for the `pho_truong_phong` role; department deputies are scoped to assigning within their own department.
- Clarified the existing business-trip request flow in employee, approval, and admin attendance views; approved trips continue to populate attendance notes and use the same date-range and approval rules as leave.
- Repaired 21 active first-login accounts that still used the previous default and aligned future account creation with `Thoidai@123456`; accounts with changed passwords were excluded.
- Disabled the Wise Eye minute Scheduled Task because the 32-bit zkemkeeper COM host creates `conhost.exe` even with hidden launch flags; realtime polling and daily reconciliation remain enabled.
- Replaced the four-position duty roster with exactly three positions: Xuất bản, Biên tập, Phóng viên.
- Added authenticated leave requests with leadership approval, conflict checks, cancellation, and audit history.
- Attendance notes now derive from approved leave and active online-work schedules; no matching context leaves the note blank.
- Added `/api/leave-requests` for authenticated employee submissions, leadership approvals/rejections, pending cancellation, conflict prevention, and audit history.
- Attendance pages now include an employee leave form, personal request history, and a leadership approval queue.
- Merged legacy Biên tập bước 1/2 rows into one Biên tập row, retaining the step 2 assignee when both existed and recording cancellation events for redundant rows.
- Added a hidden Python launcher and updated the reusable task installer for any future task re-enablement.
- Updated both Wise Eye scheduled-task actions to use `-WindowStyle Hidden` and the explicit bridge working directory; the realtime Startup launcher was already hidden.
- Added the reusable Windows task-update script under `bridge/windows` so future task registration preserves silent execution.
- Imported the supplied September 2026 duty roster: 120 active tasks across 30 dates and four positions per date.
- Mapped the source "Biên tập" row to both editor steps and kept the supplied publisher/reporter rotation unchanged.
- Allowed Hồng Ninh in the approved duty-editor rotation and exempted duty tasks only from the system-admin participant guard so Mai Anh can retain her reporter duty.
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
- Leave-history helper tests pass 3/3; TypeScript check, targeted ESLint, and production build pass before deployment.
- IPv6 UDP 51820 is explicitly dropped by the persisted port guard; WireGuard IPv4 listener, three peers, SSH fallback, and public application smoke checks remain healthy.
- WireGuard interface and UDP listener are active, three peers are loaded, server/client configuration permissions are restricted, firewall rules persist through `vps-port-guard`, public SSH 24700 remains available, and production `/login` remains HTTP 200.
- Production binding contract test passed; after a backed-up unit change, direct port 3001 access was refused, public `/login` returned HTTP 200, protected attendance API returned HTTP 401, and all related services stayed active.
- Web-login rate-limit test passed after a verified RED/GREEN cycle; targeted auth tests passed 5/5, changed-route ESLint passed, production build passed, and the sixth invalid login attempt returned HTTP 429 while the service and login page remained healthy.
- Work-schedule privacy TypeScript check and 3 targeted authorization tests PASS; production employee smoke returned zero rows instead of four organization rows and direct `/work-schedule` access redirected to `/work-schedule/staff`.
- Deputy assignment migration applied after a production database backup; `hongninh` and `leson` both resolve to Phòng Nội dung with `can_assign_task=true`, production build PASS, service active, and `/login` returns HTTP 200.
- Authentication repair migration dry-run matched 21 targets and rolled back cleanly; production migration then updated 21 accounts, left zero active hashes matching `123456`, and recorded 21 audit entries without storing password values.
- Production login smoke test for `bachduong` with the documented first-login password returned HTTP 200; service remained active and `/login` returned HTTP 200.
- Backed up task XML definitions before launcher changes at `C:\WiseEyeOn39\bridge\backup-launcher-20260909153830`.
- After disabling minute polling, a 70-second process monitor observed no Wise Eye/PowerShell/conhost launches; daily reconciliation remains scheduled for 18:30.
- Backed up both scheduled-task XML definitions under `C:\WiseEyeOn39\bridge\backup-hidden-20260909152603` before changing them.
- Both registered actions now contain `WindowStyle Hidden`; the manual polling run returned result `0`, the next minute run also returned `0`, and realtime remained active.
- Pre-change full database backup created at `/opt/thoidai-work/backups/pre-september-duty-20260909150633/database.dump` with SHA-256 manifest.
- Production query confirms 120 active September duty tasks, 30 dates, four positions per date, and no incomplete dates.
- Source image was re-read directly; the September 5 editor was corrected to Ngô Trí Đường before final validation.
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

Security milestone 2026-09-14: Supabase Kong, Mailpit, and PostgreSQL bindings restricted to 127.0.0.1. Rollback containers and inspect snapshots retained. Database readiness, schema dump, service health, and production login smoke checks passed. Dependency remediation passed npm audit with zero vulnerabilities; security tests 21/21.
