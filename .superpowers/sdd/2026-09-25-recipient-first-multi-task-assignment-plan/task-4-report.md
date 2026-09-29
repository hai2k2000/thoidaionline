# Checkpoint 4 report

Status: PASS

Commit: pending

Files:
- `src/components/TaskAssignShell.tsx`
- `src/app/tasks/assign/page.tsx`
- `src/lib/taskAssignmentRepository.ts`
- `src/lib/taskAssignmentScope.mjs`
- `src/lib/taskAssignmentScope.test.mjs`
- `src/lib/taskAssignmentRecipientFirst.test.mjs`

Recipient-first UI:
- General assignment opens with `CHỌN NGƯỜI NHẬN VIỆC`; the task form remains disabled until a recipient is selected.
- The selected recipient is shown once; `Đổi người` changes only participant state and leaves task fields mounted so entered content is preserved.
- The general form no longer exposes a second department or primary-assignee selector. The selected department and assignee are submitted through hidden fields.
- Journalism mode retains its existing department/assignee controls and payload path.

Scope:
- `truong_phong` and other non-global actors receive a canonical own-department scope.
- `tong_bien_tap`/`pho_tong_bien_tap` default to the canonical `leadership` department and can explicitly choose another visible department.
- `admin` retains global scope without an invented default department.
- Server-side `resolveParticipants()` remains the authoritative participant/scope check; no permission is broadened.

Spec review: PASS. Checkpoint 4 changes only recipient-first presentation and scope derivation, preserves the existing single-task payload/API, and does not touch Journalism, Event Assignment, approval, summary, Personal Plan, or Attendance workflows.

Quality review: PASS. Scope IDs come from active department data, no IDs are hard-coded, form state is not reset on recipient changes, disabled controls cannot submit an unselected recipient, TypeScript/lint are clean, and the route manifest remains unchanged.

Tests:
- `node --test src/lib/taskAssignmentScope.test.mjs src/lib/taskAssignmentRecipientFirst.test.mjs` — 8/8 pass.
- Relevant assignment, batch, approval, Event Assignment, Task Summary, and Journalism suite — 184/184 pass.
- `npx tsc --noEmit` — pass.
- Touched-file ESLint — pass.
- Required-route manifest — PASS.
- `git diff --check` — pass.

DB impact: No migration or database change. Production unchanged.
