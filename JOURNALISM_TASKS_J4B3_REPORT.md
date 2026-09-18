# JOURNALISM TASKS J4B-3 REPORT

Date: 2026-09-18
Status: IMPLEMENTED ON ISOLATED BRANCH; NO PRODUCTION ACTION

## A. Branch / worktree

- Branch: `journalism-tasks-j4b3-metadata-ui`
- Worktree: `/opt/worktrees/journalism-tasks-j4b3-metadata-ui`
- Worktree started clean from the approved J4B-2 baseline.
- Production worktree and service were not touched.

## B. Exact J4B-2 baseline

- Baseline commit: `3500b90c29a5141cfb62f89ff581adb4549d6078`
- Production baseline remains `de5063c5155e3f25b10fdfa11271fc298370f1cb`.

## C. Files changed

- `src/app/tasks/[id]/page.tsx`
- `src/components/TaskDetailShell.tsx`
- `src/components/JournalismMetadataEditor.tsx`
- `src/lib/journalismMetadataEdit.mjs`
- `src/lib/journalismMetadataEdit.test.mjs`
- `src/lib/journalismMetadataEditUi.j4b3.test.mjs`
- `JOURNALISM_TASKS_J4B3_REPORT.md`

No schema, migration, RPC, grant, RBAC, publication route, or production file changed.

## D. Effective-permission implementation

The server task-detail page reuses `authorizeJournalismPermission(user, task, "journalism.metadata.update")`. The helper requires the existing parent-task `view` access and the effective scoped permission. No role-name shortcut or client-only authority was added.

## E. Edit control behavior

`Chỉnh sửa thông tin` is rendered only for a Journalism Task when effective metadata-update authorization is true. Normal Tasks and view-only/publication-only users do not receive the control. The backend remains authoritative on submit.

## F. Metadata dialog/form

The dialog edits only work kind, planned publication time, location, and editorial notes. It uses the existing same-origin session and the existing J3 PATCH route. Article URL, publication status, published time, withdrawal reason, and publication action controls are absent.

## G. Partial PATCH / diff algorithm

`buildJournalismMetadataPatch` compares initial and current values and sends only changed approved fields. A true no-op sends no request. Clearing optional location/notes sends `null`; changed work kind sends only `workKindId`; changed planned time sends only `plannedPublicationAt`.

## H. Inactive historical work kind

The selected historical inactive kind is displayed with `(Ngừng sử dụng)`, is not offered as an active replacement, and is omitted from the PATCH when unchanged. A work-kind loading failure is visible and disables replacement selection without hiding the safe metadata form.

## I. Planned-date state rules

- `not_published`: planned time is optional and editable.
- `scheduled`: planned time is editable and required; clearing it blocks submit with the approved message.
- `published` / `withdrawn`: planned time is disabled, communicated in text, and excluded from PATCH; other approved metadata remains editable.

## J. Timezone serialization

The edit path reuses deterministic Vietnam-local display conversion and serializes selected values with the J3-compatible `+07:00` offset. Clearing either date or time produces an empty value instead of an invalid timestamp.

## K. Loading / no-op / double-submit behavior

Save is disabled while PATCH is pending, duplicate submits are prevented, and cancel remains available when not busy. True no-op closes without a PATCH. Work-kind load errors are surfaced safely.

## L. Error handling

The UI maps forbidden, not-found, invalid-request, and unexpected failures to safe Vietnamese messages. SQL, PostgREST, RPC, stack traces, credentials, and secrets are not exposed. No backend error mapping was changed.

## M. Success / refresh behavior

On HTTP 200 the UI shows `Đã cập nhật thông tin nghiệp vụ báo chí.`, closes the dialog, and calls `router.refresh()` so rendered values come from the authoritative server DTO.

## N. Accessibility / responsive

The native dialog has explicit `role="dialog"`, `aria-modal="true"`, labelled title, focus-on-open behavior, keyboard-operable buttons, visible labels, field-level `aria-invalid`/`aria-describedby`, and a textual locked-state explanation. Existing responsive utility classes stack fields on narrow screens and keep actions reachable.

## O. J4B-1 / J4B-2 regression

Focused Journalism read/filter/create and UI contract suites pass. Existing active-work-kind loading, recurrence exclusion, atomic create payload, and UTC+07 behavior remain unchanged.

## P. J3 / backend regression

Existing metadata mutation, authorization, publication, audit, task-read, and atomic-create contract coverage was rerun through the focused regression suite. No backend source or contract was changed.

## Q. Tests

- J4B-3 focused helper/UI tests: **10/10 PASS**.
- Combined J4B-1/J4B-2/J3/task authorization regression suite: **90/90 PASS**.
- `git diff --check`: **PASS**.

## R. TypeScript / lint / build

- `npm ci`: completed before verification.
- `npx tsc --noEmit`: **PASS**.
- Changed-file ESLint: **0 errors**; 8 pre-existing unused-variable warnings in `TaskDetailShell.tsx`.
- Production-safe command:

  `NEXT_PUBLIC_SUPABASE_URL=https://example.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key SESSION_SECRET=dummy-session-secret TASK_RBAC_V2_ENABLED=false npx next build --webpack`

- Build: **PASS**, static generation **92/92**, exit code **0**.

## S. Production = UNCHANGED

No deploy, restart, systemd change, production data mutation, schema change, migration, RPC change, grant change, or `/opt/thoidai-work` modification was performed. Production remains on the J3 release.

## T. Known limitations

- The existing J3 backend may return a generic `invalid_request` for a work kind deactivated between load and submit; this checkpoint intentionally preserves that backend contract and presents a safe generic message.
- Lint warnings listed above pre-date this checkpoint and are unrelated to the metadata editor.

## U. GO / NO-GO recommendation for J4B-4

**GO FOR OWNER REVIEW OF J4B-4 DESIGN ONLY.** J4B-3 metadata editing is complete on the isolated branch. Do not implement publication controls until separately approved.

## Final verification

- Feature commit: `c34e292` (`feat: add journalism metadata editing ui`).
- Branch was pushed to `origin/journalism-tasks-j4b3-metadata-ui`.
- The report-update commit below records the final verification state.
