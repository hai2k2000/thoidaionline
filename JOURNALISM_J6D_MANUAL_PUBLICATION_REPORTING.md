# Journalism J6D — Manual Publication Reporting v1

## 1. Purpose

J6D records that a Journalism Task was published manually, using metadata entered by an authorized Work user. It is Work-owned reporting data and does not connect to, identify, query, verify, or mutate MasterCMS.

J6B and J6C remain **NO-GO** because the private MasterCMS contract is still unavailable.

## 2. Scope

Included:

- one active manual publication report for a Journalism Task;
- reported URL, optional published title, published time, optional note, reporter, and timestamps;
- Task-detail display and permission-aware create/update form;
- server-side URL/time/text validation and task-scoped authorization;
- optimistic concurrency for updates and existing audit-log reuse.

Excluded:

- MasterCMS API/client/authentication, CMS IDs/statuses/revisions/ETags;
- URL fetching, redirect resolution, scraping, backlink verification, or analytics;
- create/publish/unpublish/delete/schedule operations on any external CMS;
- Journalism Task state-machine changes, publication-status changes, Topics/Series changes, dashboard, or advanced verification history.

## 3. Architecture

The browser calls one same-origin Work route:

`POST /api/tasks/[id]/journalism/publication-report`

The route obtains the authenticated actor from the existing session, loads Task access, reuses `journalism.publication.manage`, validates the payload, and calls the server-only RPC. The browser never sends `reported_by`; the RPC receives the server-derived actor ID. The normal Task detail query includes the report with the reporter display name, so read access follows the existing Task visibility boundary.

There is no browser-to-CMS path and no CMS provider abstraction in J6D.

## 4. Data model

Migration: `supabase/migrations/20260919110000_journalism_manual_publication_reporting.sql`

Table: `public.journalism_publication_reports`

| Field | Semantics |
|---|---|
| `id` | Work report UUID |
| `task_id` | Journalism Task relation; one active report per Task via `unique (task_id)` |
| `publication_url` | User-reported absolute `http://` or `https://` URL; not provider identity |
| `published_title` | Optional snapshot title; never overwrites Task title |
| `published_at` | Required `timestamptz`, using the existing project convention |
| `note` | Optional bounded internal note |
| `reported_by` | Server-derived authenticated staff user |
| `created_at`, `updated_at` | Existing timestamp convention; update trigger maintains `updated_at` |

The one-report-per-Task rule is **Work manual-reporting cardinality only**. It is not a claim about MasterCMS content cardinality. No `cms_content_id`, `mastercms_*`, provider status, revision, ETag, or provider payload field exists.

The table is additive, RLS-enabled, and service-role-only like the existing server-owned Journalism tables. It references `journalism_task_details` and is deleted with the Task detail; it does not alter existing columns.

## 5. Server mutation and concurrency

RPC: `api_upsert_journalism_publication_report_v1`.

- Calls `api_assert_journalism_access` with existing `journalism.publication.manage`.
- On create, requires no `expectedUpdatedAt`.
- On update, requires the current report `updated_at`; stale or missing update tokens return a conflict.
- Updates keep the report as the same Work entity and preserve its original `reported_by` attribution. The audit event preserves the authenticated update actor and old/new metadata; note contents are represented by length only in audit JSON.
- No delete/reset action is exposed in v1. “Cập nhật thông tin xuất bản” is an internal Work action, never an external unpublish action.

## 6. Authorization

J6D adds no permission and no grant. It reuses `journalism.publication.manage`, which already checks both Task visibility and the scoped RBAC grant. Users without the permission can still see a report when they can view the Task, but do not receive the edit form. There is no client-controlled reporter identity.

## 7. Validation

The client and server both enforce the relevant shape:

- trim whitespace;
- absolute `http://` or `https://` only;
- reject `javascript:`, `data:`, relative URLs, URL userinfo, and overlong URLs;
- required valid date/time converted through the existing Vietnam-local input convention to UTC `timestamptz`;
- published title max 500 Unicode characters;
- note max 5,000 Unicode characters;
- no server-side URL fetch, redirect resolution, scrape, or verification.

The database repeats URL and bounded-text invariants. The title and report URL are snapshots; they do not become Task or provider identity.

## 8. UI behavior

Task detail renders a `Xuất bản` card for Journalism Tasks:

- no report: `Chưa ghi nhận xuất bản`;
- report: published title when present, clickable reported URL, published time, reporter, note, and last updated time;
- authorized action: `Ghi nhận xuất bản` or `Cập nhật thông tin xuất bản`;
- loading, validation, success, forbidden, not-found, and stale-conflict feedback follow existing same-origin UI patterns;
- no delete button, “Unpublish” wording, CMS status, CMS ID, or MasterCMS label.

The existing Journalism publication state controls remain separate and unchanged. A manual report does not set `journalism_task_details.publication_status` and does not overwrite `article_url`.

## 9. Audit/history

The existing `audit_logs` table and insert convention are reused for create/update events. This is not the J6E verification/audit history model. The report has stable identity and timestamps so J6E can add richer history or verification later without rewriting the manual reporting workflow.

## 10. Tests

Focused coverage in `src/lib/journalismManualPublicationReporting.test.mjs` checks:

- safe provider-independent URL validation;
- rejection of unsafe schemes and URL userinfo;
- Vietnam-local timestamp conversion and invalid dates;
- title/note bounds;
- stale conflict/permission/error UI mapping;
- server-derived actor and reuse of the existing Journalism permission;
- separate schema, one active report per Task, service-role boundary, and absence of CMS fields;
- Task-detail rendering, no client reporter spoofing, and no delete/CMS operation.

Existing J3/J4/J5 Journalism tests remain part of the regression set.

## 11. Migration

The migration is additive and was not applied locally or in production in this checkpoint. No `supabase db push`, `supabase db reset`, or production migration action was used.

## 12. Future J6B/J6C compatibility

Manual reporting deliberately stores only a Work URL snapshot and Work metadata. A later approved CMS connector can coexist with it by adding a separate provider-link/read model after stable CMS identity, cardinality, and API contract are known. No migration or UI in J6D needs to be rewritten to infer a CMS ID from this URL.

## 13. Known limitations and next checkpoint

- One active Work report per Journalism Task is a UX/product choice, not CMS evidence.
- There is no delete/reset operation in J6D v1.
- There is no verification that the reported URL exists or matches a CMS record.
- Full audit/history, verification/approval, and reporting dashboard are deferred.

Recommended next checkpoint after owner review: **J6E — Publication Verification & Audit**. Do not start J6E automatically.

**MasterCMS API called: NO. MasterCMS mutation: NO. MasterCMS credential used: NO. MasterCMS schema assumed: NO. J6B implemented: NO. J6C implemented: NO.**
