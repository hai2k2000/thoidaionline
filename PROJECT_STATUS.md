Current Phase: Workflow access hardening
Current Task: COMPLETE — require fresh scoring for each assigned-task completion attempt

Completed:
- Organization evaluation summary remains readable by every signed-in employee.
- Personal attendance is served through a server-guarded API and scoped to the signed-in employee.
- Organization-wide attendance is available only to admin accounts.
- `/attendance` and `/my-attendance` enforce authentication server-side.
- Workflow document downloads require a signed-in employee and read from private runtime storage.
- Assigned-task approval requires a completion score from the current submission attempt; returning a task clears the previous score.

Validation:
- Attendance, duty, workflow hardening regression tests: PASS.
- ESLint and TypeScript: PASS.
- Production build: PASS.
- Production smoke tests: unauthenticated attendance API returns 401; unauthenticated attendance pages redirect to `/login`.
- Workflow download regression test and direct/encoded-path smoke tests: PASS (unauthenticated requests do not receive document bytes).
- Fresh-score workflow regression test: PASS.
- Production migration `20260829100000_require_fresh_task_score`: PASS on internal Supabase DB.
- Strict fresh-score correction `20260829110000_strict_fresh_task_score`: PASS; legacy pending-review rows without a submission timestamp cannot be approved with historical scores.

Blockers:
- none

Follow Up:
- The production database does not currently contain `attendance_logs`; the UI keeps the existing server-generated DEMO fallback until the attendance migration is provisioned.
- Legacy seeded assigned tasks may remain in `new` status; they are outside the new assignment flow and should be triaged separately if users report them.

Next:
- Await the next user-requested workflow task.
