# JOURNALISM TASKS J4B-2 REPORT

## A. Branch and worktree

- Branch: `journalism-tasks-j4b2-create-ui`
- Worktree: `/opt/worktrees/journalism-tasks-j4b2-create-ui`
- Exact J4B-1 baseline: `0ec436b86decccb45ed6b3b50d6cb31444511a26`
- Production baseline remains `de5063c5155e3f25b10fdfa11271fc298370f1cb`.
- No production checkout, systemd unit, database, migration, RBAC, grant, or RPC was changed.

## B. Create-mode implementation

- Existing `/tasks/assign` remains the entry point.
- Normal mode is the default with no special query parameter.
- Journalism mode is explicit at `/tasks/assign?kind=journalism`.
- The selected mode is shown as an accessible, keyboard-navigable link choice with `aria-current`.
- Existing parent task fields and authorized assignment controls are reused.
- Journalism v1 keeps individual assignee, collaborator, and watcher behavior; recurrence is the only parent feature excluded from Journalism mode.

## C. Journalism fields and master data

- `Loại nghiệp vụ` is required and loaded server-side from `listJournalismWorkKinds`.
- Only active work kinds are selectable for create.
- If the master-data load fails or returns no active options, the form shows a safe error and disables Journalism submission.
- Optional fields: planned publication date/time, location (maximum 500), and editorial notes (maximum 10,000, line breaks preserved, no HTML rendering).
- Initial publication text is informational only: `Trạng thái ban đầu: Chưa xuất bản`.
- No publication status selector, published timestamp, article URL, withdrawal reason, or mutation control was added.

## D. Request DTO and recurrence exclusion

- Journalism submits only to `POST /api/tasks/journalism/assign`.
- The parent payload preserves title, description, department, assignee, due date/time, priority, evaluation criteria, collaborators, and watchers.
- The Journalism object contains only `workKindId`, `plannedPublicationAt`, `location`, and `editorialNotes`.
- No recurrence, publication mutation, actor, role, permission, or scope metadata is sent.
- Atomic creation remains the existing J3 backend responsibility; no parent-then-detail client sequence was introduced.

## E. Planned-time serialization

- A Vietnam local date/time pair is converted deterministically to the J3 ISO timestamp contract using UTC+07:00 arithmetic.
- A partial or invalid pair is rejected rather than silently converted to `null`.

## F. Loading, validation, errors, and success

- Submit is disabled while pending and guarded with a ref against duplicate requests.
- Validation covers required work kind, date/time validity, location length, and editorial-notes length.
- Field-level `aria-invalid`, `aria-describedby`, and inline messages are provided for Journalism fields.
- Errors are mapped to safe user-facing messages without exposing database/PostgREST/RPC internals.
- Existing success navigation goes to the authoritative returned Task detail; Journalism success text is `Đã tạo công việc nghiệp vụ báo chí.`
- Existing normal Task endpoint, payload behavior, recurrence, attachment flow, and success path remain unchanged.

## G. Responsive and accessibility

- Existing TaskAssignShell layout is reused; Journalism fields stack naturally on narrow screens.
- Visible labels, required indication, keyboard-accessible mode links, field descriptions, status text, and safe mobile controls are present.
- No horizontal-scroll redesign or separate Journalism page was introduced.

## H. J4B-1/J3 regression and tests

- Focused J4B-2 + J4B-1 + J2/J3 + assignment suite: **38/38 PASS**.
- New helper/UI tests cover DTO allowlist, no recurrence/publication fields, UTC+07:00 serialization, validation limits, error mapping, active options, mode navigation, and duplicate-submit guard.
- Existing full source-inspection suite still contains baseline failures outside this checkpoint, including stale AppNav/layout expectations; those were not modified.

## I. Static and build gates

- `npm ci`: PASS, 0 vulnerabilities.
- `npx tsc --noEmit`: PASS.
- Changed-file ESLint: PASS, 0 errors.
- `git diff --check`: PASS.
- Production-safe build:

```text
NEXT_PUBLIC_SUPABASE_URL=https://example.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key SESSION_SECRET=dummy-session-secret TASK_RBAC_V2_ENABLED=false npx next build --webpack
```

- Build: **PASS, exit code 0**; compile, TypeScript, static generation 92/92, and optimization completed.

## J. Known limitation / risk

- The unchanged J3 route currently maps the SQL inactive-work-kind error to the generic `invalid_request` response. The UI keeps the approved inactive-work-kind message mapping ready, but no backend route/RPC change was made because J4B-2 explicitly forbids backend contract changes.
- Full legacy source-inspection tests retain unrelated baseline failures; no focused J4B-2/J4B-1/J2/J3 test failed.

## K. J4B-3 recommendation

**GO for owner review only.** Do not start metadata editing or publication controls automatically. J4B-3 requires a separate explicit owner approval.
