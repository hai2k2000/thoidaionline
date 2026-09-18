# JOURNALISM TASKS J4B-1 REPORT

## A. Branch and worktree

- Branch: `journalism-tasks-j4b-ui`
- Worktree: `/opt/worktrees/journalism-tasks-j4b-ui`
- Production checkout was not modified or deployed.

## B. Code baselines

- Runtime application baseline: `de5063c5155e3f25b10fdfa11271fc298370f1cb`
- J4A documentation baseline / implementation branch HEAD: `f804c7aadd134ccd7cce24ec356b01ade548db38`
- The runtime-to-J4A comparison was documentation-only before implementation.

## C. Files changed

- `src/app/tasks/page.tsx`
- `src/components/TaskCenterShell.tsx`
- `src/components/TaskDetailShell.tsx`
- `src/components/JournalismSummary.tsx`
- `src/components/JournalismDetailSection.tsx`
- `src/lib/journalismUi.mjs`
- `src/lib/taskFilters.mjs`
- `src/lib/taskRepository.ts`
- Focused tests under `src/lib/journalism*test.mjs`

No schema, migration, RBAC, grant, RPC, systemd, package, or production files changed.

## D. Component reuse and UI behavior

- Reused the existing Task Center desktop table, mobile cards, native controls, URL-driven forms, pagination, empty states, and detail layout.
- Added a compact read-only Journalism summary to Journalism rows/cards only.
- Existing Task workflow status remains separate from publication status.
- Publication labels are exactly: `Chưa xuất bản`, `Đã lên lịch`, `Đã xuất bản`, `Đã gỡ`.
- Planned publication is shown only when present and is not a new table column.
- Added a read-only `Nghiệp vụ báo chí` detail section only when Journalism data exists.
- Optional fields are omitted when absent; notes preserve whitespace and wrap safely.
- Article URLs accept only absolute HTTP(S) URLs without credentials and render with `target="_blank" rel="noreferrer"`.
- Inactive historical work kinds remain readable as `(Ngừng sử dụng)`.

## E. Filter implementation and URL semantics

- Existing server query names are preserved: `journalism`, `workKind`, `publicationStatus`, `plannedFrom`, `plannedTo`.
- `journalism=exclude` selects normal Tasks; `journalism=only` selects Journalism Tasks.
- Journalism subfilters imply `journalism=only`.
- Switching to normal or all clears hidden Journalism subfilters.
- Filters remain server-side; no client-side filtering of paginated results was added.
- Browser/query state is synchronized across soft navigation and back/forward.
- Existing count, ordering, pagination, and `journalism=is.null` exclusion alias behavior remain server-driven.

## F. Active work-kind options

- Options load server-side through `listJournalismWorkKinds`.
- Active values are offered normally.
- If the current URL references an inactive historical value, it is retained and labeled so the URL remains representable; inactive values are not added as ordinary choices otherwise.
- No browser direct-table access or service-role exposure was added.

## G. Normal Task compatibility, responsive behavior, and accessibility

- Normal Tasks render without Journalism placeholders or detail sections.
- Existing desktop filter grid density was preserved for all Task modes.
- Mobile cards contain the compact Journalism summary without horizontal overflow.
- Detail fields use responsive one/two-column layouts, visible labels, safe wrapping, and text-based publication status.
- No Journalism mutation controls, role checks, create forms, or publication actions were added.

## H. J2/J3 regression and verification

- Focused J4/J2/J3 suite: **24/24 PASS**.
- `npx tsc --noEmit`: **PASS**.
- Changed-file ESLint: **0 errors**, 10 pre-existing warnings in existing Task shells.
- `git diff --check`: **PASS**.
- Production-safe build command:

```text
NEXT_PUBLIC_SUPABASE_URL=https://example.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key SESSION_SECRET=dummy-session-secret TASK_RBAC_V2_ENABLED=false npx next build --webpack
```

- Production-safe build: **PASS, exit code 0**; compile, TypeScript, static generation (92/92), and optimization completed.
- Full legacy `node --test src/lib/*test.mjs`: 345 passed / 14 failed. The 14 failures are pre-existing baseline source-inspection/UI expectations outside J4B-1; no J4B-1 focused test failed.

## I. Production and security status

- Production remains unchanged at `de5063c5155e3f25b10fdfa11271fc298370f1cb`.
- No production secrets were copied into the worktree or report.
- No deployment, restart, migration, RBAC change, grant change, RPC change, or data mutation was performed.

## J. Risks and blockers

- The repository retains the documented 14 unrelated baseline test failures; they should be handled in their owning checkpoints, not by changing J4B-1 behavior.
- No J4B-1 security or data-access blocker was found in review.

## K. J4B-2 recommendation

**GO for owner review only.** J4B-2 must remain a separate approved checkpoint. Do not start create, metadata edit, or publication mutation UI from this branch automatically.
