Current Phase: Workflow access hardening
Current Task: COMPLETE — harden admin edits against assigned-task completion bypass

Completed:
- Organization evaluation summary remains readable by every signed-in employee.
- Personal attendance is served through a server-guarded API and scoped to the signed-in employee.
- Organization-wide attendance is available only to admin accounts.
- `/attendance` and `/my-attendance` enforce authentication server-side.
- Workflow document downloads require a signed-in employee and read from private runtime storage.
- Assigned-task approval requires a completion score from the current submission attempt; returning a task clears the previous score.
- Approved assigned tasks persist `progress_percent=100`.
- Admin edits cannot move assigned regular tasks directly to `pending_review` or `done` without the canonical submission/fresh-score flow.
- Reopening an approved assigned task clears its completion timestamp and stale completion score.

Validation:
- Attendance, duty, workflow hardening regression tests: PASS.
- ESLint and TypeScript: PASS.
- Production build: PASS.
- Production smoke tests: unauthenticated attendance API returns 401; unauthenticated attendance pages redirect to `/login`.
- Workflow download regression test and direct/encoded-path smoke tests: PASS (unauthenticated requests do not receive document bytes).
- Fresh-score workflow regression test: PASS.
- Admin-edit workflow contract test: PASS.
- Targeted workflow tests: PASS.
- Production migrations `20260829100000`, `20260829110000`, `20260829120000`, `20260829130000`: PASS on internal Supabase DB.

Blockers:
- none

Follow Up:
- The production database does not currently contain `attendance_logs`; the UI keeps the existing server-generated DEMO fallback until the attendance migration is provisioned.
- Legacy seeded assigned tasks may remain in `new` status; they are outside the new assignment flow and should be triaged separately if users report them.
- Four seeded assigned tasks remain `pending_review` without a completion score and require triage or a fresh assignee submission before approval.

Next:
- Await the next user-requested workflow task.
