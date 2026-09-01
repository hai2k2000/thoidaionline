Current Phase: Backend security hardening
Current Task: COMPLETE — protect HR/assets/documents data paths and storage

Completed:
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
- Targeted leadership assignment contract and participant-selection tests: PASS (7/7).
- Supabase migration `20260830100000_fix_leadership_assignment_scope`: PASS on internal Supabase DB.
- Leadership smoke-check confirms active department heads are accepted for leadership assignment.
- One legacy Phase 6 UI contract test remains stale: it expects a `description` form field while the current form uses `requirements`.
- Backend security hardening build: PASS (`npm run build`).
- Backend security hardening tests: PASS (5/5).
- Targeted lint: PASS (0 errors, 1 warning before dependency fix; PASS after dependency fix).
- Migration `20260901095000_backend_security_hardening`: PASS with database backup and anon probes returning 401/42501.

Blockers:
- none

Follow Up:
- Password fallback `123456` remains unchanged by explicit user instruction for active accounts `admin`, `thanhhai`, `maianh`, and `quangthien`.
- Existing legacy HR files under `public/uploads/hr` should be migrated manually if any are found; new HR files use guarded runtime storage.
- Service still runs as root and deploy process should be moved to an atomic non-root release workflow in a separate change.
- The production database does not currently contain `attendance_logs`; the UI keeps the existing server-generated DEMO fallback until the attendance migration is provisioned.
- Legacy seeded assigned tasks may remain in `new` status; they are outside the new assignment flow and should be triaged separately if users report them.
- Four seeded assigned tasks remain `pending_review` without a completion score and require triage or a fresh assignee submission before approval.
- Update the stale Phase 6 UI contract test to assert `requirements` instead of `description`.

Next:
- Monitor production smoke checks after service restart; then handle non-blocking dependency/lint/test follow-ups.
