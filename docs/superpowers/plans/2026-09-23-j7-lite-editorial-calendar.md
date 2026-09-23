# J7 Lite Editorial Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a content-department-only editorial day/week/month calendar for Journalism Tasks with safe planned-publication-date editing, without CMS integration.

**Architecture:** Reuse the existing Journalism task repository, scope helpers, Topic/Series relations and publication status model. Add a focused calendar query/DTO layer, read and PATCH routes, and a server-rendered page with simple date/status controls; no drag/drop, webhook, polling or CMS assumptions.

**Tech Stack:** Next.js App Router, TypeScript, Supabase server repository, existing Tailwind UI, Node test runner.

**Spec:** User-approved J7 Lite design and requirements in the conversation dated 2026-09-23.

## Global Constraints

- Scope is Phòng Nội dung only; other departments receive redirect/403 and never see calendar data.
- No MasterCMS integration, CMS sync, CMS status polling, webhook or automatic reconciliation.
- Preserve J6/J6G, Personal Plan, Event Assignment and Online Work behavior.
- Preserve canonical-baseline, required-route and managed-release guards.
- Build from the current standalone baseline and stop before production deployment.

---

### Task 1: Calendar domain contracts and filtering

**Files:**
- Create: `src/lib/journalismCalendar.ts`
- Create: `src/lib/journalismCalendar.test.mjs`

**Interfaces:**
- `CalendarView = "day" | "week" | "month"`.
- `JournalismCalendarQuery` contains `view`, `anchorDate`, `reporterId`, `publicationStatus`, `topicId`, `seriesId`.
- `classifyCalendarTask(task, today)` returns `unplanned | overdue | scheduled | published | withdrawn`.
- `calendarRange(view, anchorDate)` returns inclusive ISO `from`/`to` dates.

- [ ] Write failing tests for date ranges, status classification, filter parsing and content-only scope.
- [ ] Run `node --test src/lib/journalismCalendar.test.mjs` and confirm failure because the module is absent.
- [ ] Implement pure calendar range/classification/filter helpers without database or CMS dependencies.
- [ ] Run the focused tests and confirm all pass.
- [ ] Commit `test: define J7 Lite calendar rules` and `feat: add J7 Lite calendar domain helpers`.

### Task 2: Calendar repository and planned-date mutation

**Files:**
- Create: `src/lib/journalismCalendarRepository.ts`
- Create: `src/lib/journalismCalendarRepository.test.mjs`
- Modify: `src/lib/taskRepository.ts` only if an existing scoped helper must be reused.

**Interfaces:**
- `loadJournalismCalendar(actor, query): Promise<RepositoryResult<JournalismCalendarResult>>`.
- `updatePlannedPublicationDate(actor, taskId, plannedPublicationAt): Promise<RepositoryResult<...>>`.
- Both functions require `canUseJournalism`, force Journalism-only reads, apply department/assignment scope, and use existing Topic/Series/publication fields.

- [ ] Write failing repository contract tests for leadership department scope, reporter assigned scope, filters and rejection of other departments.
- [ ] Run the focused tests and confirm they fail before implementation.
- [ ] Implement read query using existing task repository fields/relations and bounded date ranges; do not add CMS calls.
- [ ] Implement PATCH mutation through the existing server Supabase client/RPC or narrowly scoped update, changing only `planned_publication_at` on a Journalism task.
- [ ] Run repository tests and confirm pass.
- [ ] Commit `feat: add scoped J7 Lite calendar repository`.

### Task 3: Calendar API routes and route guards

**Files:**
- Create: `src/app/api/journalism/calendar/route.ts`
- Create: `src/app/api/journalism/calendar/[id]/route.ts`
- Modify: `src/lib/requiredProductionRoutes.mjs`
- Create: `src/lib/journalismCalendarRoutes.test.mjs`

**Interfaces:**
- `GET /api/journalism/calendar` parses query filters and returns calendar DTOs.
- `PATCH /api/journalism/calendar/[id]` accepts `{ plannedPublicationAt: string | null }` and returns the updated summary.
- Unauthenticated requests return existing auth status; unauthorized departments return 403; malformed dates/task IDs return 400.

- [ ] Write failing route tests for auth, route existence, filter forwarding, method payload validation and 403 department isolation.
- [ ] Run the route tests and confirm failure.
- [ ] Implement routes using existing session/auth and journalism scope patterns.
- [ ] Add both routes to required production route manifest.
- [ ] Run route tests and `npm run check:routes`.
- [ ] Commit `feat: expose J7 Lite calendar routes`.

### Task 4: Editorial calendar UI

**Files:**
- Create: `src/app/journalism/calendar/page.tsx`
- Create: `src/components/JournalismCalendarShell.tsx`
- Create: `src/components/JournalismCalendarShell.test.mjs`
- Modify: existing journalism navigation only where the current navigation pattern requires a calendar link.

**Interfaces:**
- Page loads the scoped calendar and redirects non-Journalism users to the existing safe destination.
- UI supports day/week/month, reporter/status/Topic/Series filters, badges for five classifications, and a simple date/time form for planned date edits.

- [ ] Write failing UI/source tests for view controls, all filters, status badges, no drag/drop/CMS strings, and edit form payload.
- [ ] Run focused UI tests and confirm failure.
- [ ] Implement accessible calendar/table layout with explicit empty/loading/error states and ordinary forms/buttons.
- [ ] Run focused UI tests and confirm pass.
- [ ] Commit `feat: add J7 Lite editorial calendar UI`.

### Task 5: Full validation and standalone artifact

**Files:**
- Modify: `scripts/check-required-routes.mjs` only through the manifest source list.
- Use: existing standalone packaging scripts and managed-release metadata scripts.

- [ ] Run focused J7 tests.
- [ ] Run Journalism, Personal Plan, Event Assignment and Online Work regressions.
- [ ] Run `npm run check:baseline`, `npm run check:routes`, TypeScript/build checks and standalone packaging.
- [ ] Verify artifact metadata and required route manifest include the new calendar routes.
- [ ] Record artifact size/path and leave production untouched.
- [ ] Commit any final test-only adjustments and report readiness; do not deploy.
