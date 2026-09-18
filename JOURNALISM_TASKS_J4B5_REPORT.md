# JOURNALISM TASKS J4B-5 REPORT

Date: 2026-09-18
Status: FINAL INTEGRATION / POLISH / REGRESSION COMPLETE ON ISOLATED BRANCH

## A. Provenance resolution

- J4B-4 application commit: `1387efa4042d221c4e011d61b6c681e4cc9b22ec`.
- J4B-4 report/provenance baseline: `1019e7577089219d02acf5f5d0207db034bda886`.
- Commits after `1387efa...` in the baseline were report-only.
- J4B-5 application commit: `e5f726dedd480929b6424db55fc083cd6a4afb26`.
- Production remains on J3; no production tree was used or modified.

## B. Branch / worktree

- Branch: `journalism-tasks-j4b5-final-polish`.
- Worktree: `/opt/worktrees/journalism-tasks-j4b5-final-polish`.
- Worktree was clean before implementation and is clean after commit/push.
- Remote branch matches local HEAD.

## C. Authoritative application baseline

The authoritative J4B-4 application tree was taken from `1387efa...`; the inherited report-only commits were preserved as provenance. J4B-5 is limited to one UI duplicate-submit guard and integration contract coverage.

## D. Files changed

- `src/components/JournalismMetadataEditor.tsx`: added a ref-based in-flight guard so one user click sequence produces at most one metadata PATCH.
- `src/lib/journalismJ4b5Integration.test.mjs`: added six integrated source/contract checks.
- No backend route, migration, schema, RPC, grant, RLS, permission catalog, production data, systemd configuration, or unrelated module changed.

## E. Integrated flow review

The reviewed flow remains: Task Center -> Journalism list/detail -> Journalism create -> server DTO detail -> independent metadata/publication controls -> authoritative refresh. Create remains atomic through `POST /api/tasks/journalism/assign`; detail does not depend on client-only temporary state or a reload hack.

## F. Normal Task compatibility

Normal Tasks retain the existing list/detail/create path, recurrence behavior, workflow status, filters, pagination, count, and ordering. Journalism sections and mutation controls are rendered only when `task.journalism` exists; Journalism create fields are not sent by normal mode.

## G. Permission integration

Metadata and publication capabilities are independently authorized on the server with effective permission/resource checks plus the existing Task view guard. The integrated matrix is fail-closed:

- view-only: neither mutation control;
- metadata-only: metadata control only;
- publication-only: publication controls only;
- both: both controls;
- normal Task: no Journalism mutation controls;
- unknown authorization: read-only behavior.

No client role-name shortcut is used.

## H. Create integration

`/tasks/assign` remains normal Task mode; `/tasks/assign?kind=journalism` enables Journalism mode. Journalism create includes active work kind and optional planned time/location/editorial notes, excludes recurrence and publication mutation fields, and submits only the atomic Journalism endpoint. The initial publication status remains informational (`Chưa xuất bản`).

## I. Metadata integration

Metadata remains a separate editor with partial PATCH semantics for only changed approved fields: `workKindId`, `plannedPublicationAt`, `location`, and `editorialNotes`. Published/withdrawn planned time stays locked; unchanged inactive historical work kinds are not re-submitted. The J4B-5 guard prevents duplicate PATCH requests.

## J. Publication integration

Publication remains a separate state-control section. Valid actions are: not published -> schedule/publish; scheduled -> cancel/publish; published -> withdraw; withdrawn/unknown -> no mutation. The UI does not claim CMS synchronization or perform CMS actions.

## K. State-machine UI

Publication status is distinct from Task workflow status and uses the approved Vietnamese labels. Unknown states are read-only.

## L. Payload allowlists

- Schedule: `{ status, plannedPublicationAt }`.
- Cancel: `{ status }`.
- Publish: `{ status, articleUrl }`.
- Withdraw: `{ status, reason }`.
- Metadata: changed approved metadata fields only.

No actor, role, scope, permission, version, etag, expected timestamp, published timestamp, or client-selected authorization fields are sent.

## M. Timezone consistency

Create, metadata edit, publication scheduling, and read-only display use deterministic Vietnam-local behavior (`Asia/Ho_Chi_Minh`, UTC+07:00). Tests cover machine-timezone-independent conversion and schedule serialization without changing backend timestamp semantics.

## N. Work-kind consistency

Active work kinds are selectable for new values. Inactive historical values remain readable and are labelled `(Ngừng sử dụng)`. Unrelated metadata edits do not silently re-submit an inactive current value. Work-kind data is loaded through the existing server path; the browser does not query Supabase directly.

## O. Error consistency

Journalism errors map to safe Vietnamese messages for forbidden, not found, invalid request/date/URL, inactive work kind, withdrawal reason, conflict, and unexpected failures. Raw SQL, PostgREST, RPC names, stack traces, and internal secrets are not shown.

## P. 409 behavior

Publication conflicts close the stale dialog, show conflict feedback, call `router.refresh()`, and render authoritative state. There is one request and no automatic retry.

## Q. Double-submit

Create retains its existing submit ref guard; publication retains its in-flight ref guard; metadata now has the same ref guard. Pending controls are disabled and no optimistic publication state is written.

## R. URL safety

Published URLs accept only bounded absolute `http`/`https` URLs without credentials. Read-only URLs use safe text rendering, `target="_blank"`, `rel="noreferrer"`, and mobile-safe wrapping. URL correction is not exposed.

## S. CMS-semantic safety

Copy describes publication tracking inside Thời Đại Work only. It does not claim upload, website publishing, deletion, or synchronization with an external CMS.

## T. Responsive findings

Existing J4 layouts retain stacked mobile controls, viewport-fitting scrollable dialogs, wrapped URLs/notes, reachable footer actions, and no J4-specific horizontal overflow identified in static review.

## U. Accessibility findings

Existing J4 dialogs retain visible labels, keyboard-operable buttons, focus-on-open, `aria-modal`, labelled headings, `aria-invalid`, `aria-describedby`, pending/disabled semantics, and visible action names. No broad accessibility rewrite was performed.

## V. Performance / N+1

Task list uses the existing server DTO. Task detail loads Journalism work kinds once for the detail. No per-row Journalism fetch, publication fetch on render, browser Supabase query, or J4-specific N+1 pattern was found in static review.

## W. Security scan

J4 client code contains no service-role key, `service_role`, direct Journalism table mutation, direct RPC call, role-string authorization shortcut, raw audit rendering, or `dangerouslySetInnerHTML`. Build validation used only non-secret dummy values.

## X. Cleanup performed

One narrow cleanup was authorized and applied: metadata editor duplicate-submit protection. No broad refactor was performed.

## Y. Focused J4 test counts

- New J4B-5 integration checks: **6/6 PASS**.
- Integrated J4/J3/J2/RBAC focused command: **124/124 PASS**.
- `git diff --check`: **PASS**.

## Z. J3 / J2 / RBAC regression

Existing J3 atomic-create, metadata authorization/partial behavior, publication transitions, URL/reason validation, conflict/concurrency and audit-contract coverage passed within the integrated suite. J2 Journalism read/filter coverage, including `journalism=is.null`, work kind, publication status, planned range, pagination/count/order and nested detail contracts, passed. Phase 1A/RBAC/task authorization coverage passed.

## AA. Module regression

Relevant attendance, leave, schedule, online work, duty roster, evaluation, users/admin, and permission tests were included in the repository run. No J4-specific module regression was introduced.

## AB. Full-suite classification

Full repository command:

`find src -name '*.test.mjs' -print | sort > /tmp/j4b5-tests.txt && xargs -a /tmp/j4b5-tests.txt node --test`

Result: **441 tests, 409 pass, 32 fail**. The baseline before J4B-5 was **435 tests, 403 pass, 32 fail**. The six-test increase is the new J4B-5 integration coverage; the exact 32 failing test names are unchanged from baseline and are classified as known unrelated baseline failures (sidebar/navigation, legacy UI contracts, evaluation/personnel legacy contracts, login/API/document expectations). No category-A new J4 regression was observed.

## AC. TypeScript / lint / diff / build

- `npm ci --ignore-scripts`: PASS.
- `npx tsc --noEmit`: PASS.
- Changed-file ESLint for `JournalismMetadataEditor.tsx` and `journalismJ4b5Integration.test.mjs`: PASS, 0 errors.
- `git diff --check`: PASS.
- Production-safe validation command:

  `NEXT_PUBLIC_SUPABASE_URL=https://example.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key SESSION_SECRET=dummy-session-secret TASK_RBAC_V2_ENABLED=false npx next build --webpack`

  Build completed successfully, including static generation `92/92`; only external font retry messages appeared. No production `.env` or secret was copied.

## AD. Production = UNCHANGED

No deploy, restart, migration, schema/RPC/grant/RLS change, production data mutation, systemd change, or `/opt/thoidai-work` modification was performed. Production remains on J3 commit `de5063c5155e3f25b10fdfa11271fc298370f1cb` and its approved release.

## AE. Known limitations

Production activation remains a separate owner-approved J4C checkpoint. CMS integration, audit/history UI, URL correction, topics/series, notifications, KPI/AI, recurrence, new states/permissions, and normal Task -> Journalism conversion remain intentionally out of scope. The repository retains the documented 32 unrelated baseline test failures and pre-existing lint warnings outside changed files.

## AF. Final GO / NO-GO recommendation

**J4B-5 = DONE**

**JOURNALISM J4 IMPLEMENTATION = READY FOR OWNER PRODUCTION REVIEW**

This is a GO for owner review of controlled J4 production activation only. Do not start J4C, deploy, restart production, or activate any feature flag from this checkpoint.

## Final commits

- Application commit: `e5f726dedd480929b6424db55fc083cd6a4afb26` (`chore: finalize journalism ui integration`).
- Report commit: recorded after this validation; application tree remains unchanged after the report-only commit.
