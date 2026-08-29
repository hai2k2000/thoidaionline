Current Phase: Workflow access hardening
Current Task: Protect the workflow document download

Completed:
- Organization evaluation summary remains readable by every signed-in employee.
- Personal attendance is served through a server-guarded API and scoped to the signed-in employee.
- Organization-wide attendance is available only to admin accounts.
- `/attendance` and `/my-attendance` enforce authentication server-side.
- Workflow document downloads require a signed-in employee and read from private runtime storage.

Validation:
- Attendance, duty, workflow hardening regression tests: PASS.
- ESLint and TypeScript: PASS.
- Production build: PASS.
- Production smoke tests: unauthenticated attendance API returns 401; unauthenticated attendance pages redirect to `/login`.
- Workflow download regression test and direct/encoded-path smoke tests: PASS (unauthenticated requests do not receive document bytes).

Blockers:
- none

Follow Up:
- The production database does not currently contain `attendance_logs`; the UI keeps the existing server-generated DEMO fallback until the attendance migration is provisioned.

Next:
- Continue the next workflow-risk review after this task is closed.
