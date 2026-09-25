# Checkpoint 5 report

Status: PASS

Commit: pending

Files:
- `src/components/TaskAssignShell.tsx`
- `src/lib/taskAssignmentCards.mjs`
- `src/lib/taskAssignmentCards.test.mjs`
- `src/lib/taskAssignmentCardsUi.test.mjs`
- `src/lib/taskAssignmentBatchApiRuntime.test.mjs`
- `src/lib/taskHandlerFactory.ts`

Default card:
- General assignment starts with one blank card after a recipient is selected.
- Journalism creation remains on its existing dedicated form and API path.

Add/remove/renumbering:
- `+ Thêm việc` adds an independent stable-key card and focuses its title.
- `Xóa việc` removes a card, preserves at least one card, and display numbering follows array order.

Independent card state:
- Each card owns only mapped task fields: title, description, requirements, deadline, priority, recurrence, collaborators, watchers, and attachment.
- Recipient/department remain shared outside card state.
- No `Ghi chú`, `notes`, or `ghiChu` field was added.

Max-20 UI:
- Client cap is enforced by `MAX_TASK_CARDS = 20`; the server/RPC remains authoritative.

Recipient preservation/change:
- Changing recipient clears participant selections and batch identity but keeps mounted card contents intact.

Single submit:
- One card continues through the existing single-task `/api/tasks/assign` path, including department-group behavior and attachment upload.

Batch submit:
- Multiple cards submit explicit `mode: "batch"` payloads through `/api/tasks/assign` with one shared recipient and ordered cards.
- Multi-card attachment upload is intentionally deferred to Checkpoint 6 and is blocked with a clear message.

Batch ID lifecycle:
- One client `batchId` is generated per intended multi-card submission and retained for retry; card/recipient changes clear it.
- Duplicate-click protection uses the existing submitting ref.

Validation/taskIndex:
- Card validation reports one-based Vietnamese card numbers and field-specific errors, focuses the first invalid title, and prevents mutation.

Spec review: PASS. The implementation matches the approved recipient-first/card architecture, preserves Journalism and existing single-task behavior, and does not broaden permissions or schema.

Quality review: PASS. Stable React keys, immutable card updates, max-20 guard, explicit batch mode, retry identity preservation, and no notes field were verified in source and focused tests.

Tests:
- Focused and related suite: `node --test ...` — 191/191 pass.
- `npx tsc --noEmit` — pass.
- Touched-file ESLint — pass.
- `node scripts/check-required-routes.mjs` — PASS.
- `git diff --check` — pass.
