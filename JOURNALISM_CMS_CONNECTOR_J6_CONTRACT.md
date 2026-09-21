# Journalism MasterCMS Connector — J6 Contract

Status: J6A design and characterization only. This document is a proposed contract, not an implementation approval.

## A. Terminology

- **Work**: Thời Đại Work, the internal task and newsroom-operations system.
- **MasterCMS**: the external publishing/content system operated for `thoidai.com.vn`.
- **Journalism Task**: a Work `tasks` row with a corresponding `journalism_task_details(task_id)` row.
- **CMS content item**: one externally identified MasterCMS record. Its concrete types and lifecycle are still unknown.
- **CMS link**: the Work-side relationship between one Journalism Task and one CMS content item.
- **Cached metadata**: the bounded CMS fields retained in Work for display and reconciliation; it is not a copy of the article body.
- **Editorial publication state**: the existing Work-side J3/J4 workflow state.
- **CMS publication state**: the state reported by MasterCMS. It must remain distinct from the Work state.

## B. Systems of record

| Concern | System of record | Work behavior |
|---|---|---|
| Task title as assignment title, instructions, owner, assignee, reviewer, department, deadline, priority, workflow status | Work | Never overwritten by CMS metadata |
| Comments, attachments, evaluation, Topic and Series membership, internal notes | Work | Remain internal Work data |
| CMS provider and content identifier | MasterCMS identity, referenced by Work | Work stores the opaque identifier; no URL/title matching |
| Public CMS title/body/SEO, category/taxonomy, CMS author/byline, revisions | MasterCMS | Work may cache only explicitly approved display metadata |
| CMS publication state and timestamps | MasterCMS | Read/sync into separate CMS fields; never silently overwrite Work state |
| Canonical public URL | MasterCMS | Cached through the connector link; legacy `article_url` remains compatibility data |

## C. Goals

1. Link an authorized Journalism Task to a MasterCMS item without turning Work into a second CMS.
2. Read and display bounded CMS metadata without blocking Task management on CMS availability.
3. Preserve the meaning and history of the existing J3/J4 publication workflow.
4. Make link, unlink, sync, visibility, failure, and audit semantics explicit before implementation.
5. Prevent duplicate links, arbitrary CMS archive disclosure, secret leakage, and accidental CMS writes.

## D. Non-goals for J6 v1

- No CMS article creation, body editing, publish, unpublish, withdraw, delete, or revision editing in Work.
- No schema, migration, RPC, API route, UI, worker, webhook consumer, polling job, RBAC grant, or production deployment is authorized by J6A.
- No full article-body mirror, fuzzy URL/title auto-linking, or automatic legacy backfill.
- No implicit mapping between Work Topics/Series and CMS categories/tags.
- No global CMS search for ordinary users and no browser-to-CMS credential flow.

## E. Cardinality

### Proposed J6 v1

One Journalism Task maps to zero or one CMS item, and one CMS item maps to zero or one Journalism Task. A Task may be unlinked; a CMS item may exist independently in MasterCMS.

The link is not silently replaceable. If a Task is linked to item A and a request names item B, return a conflict and require an explicit unlink first. A future explicit replace operation would require a separate approval.

### Not yet confirmed

MasterCMS may have articles, media posts, galleries, videos, editions, localized versions, revisions, or content variants. J6B must characterize whether these are separate publishable records or one content item with child versions. If one editorial deliverable legitimately produces several records, the owner must approve a new cardinality contract before schema work.

## F. CMS-link schema proposal (not implemented)

Prefer a dedicated table rather than adding CMS-specific columns to `journalism_task_details`:

```text
journalism_cms_links
  id uuid primary key
  task_id uuid not null references journalism_task_details(task_id)
  provider text not null default 'mastercms'
  cms_content_id text not null
  cms_content_type text null
  cms_title text null                         -- optional display cache
  raw_status text null                        -- lossless CMS state
  canonical_url text null
  cms_created_at timestamptz null
  cms_published_at timestamptz null
  cms_updated_at timestamptz null
  cms_version text null                       -- if CMS supplies one
  etag text null                              -- if CMS supplies one
  last_synced_at timestamptz null
  sync_status text not null
  last_sync_error_code text null
  created_at timestamptz not null
  updated_at timestamptz not null
```

Recommended constraints are `unique(task_id)` and `unique(provider, cms_content_id)` for the v1 one-to-one model. `sync_status` is connector state, not CMS publication state. Unknown CMS statuses remain in `raw_status` and are not discarded. Whether unlink hard-deletes this row or retains link history is an owner decision; audit history must remain sufficient either way.

## G. Identity

`cms_content_id` is the only authoritative external identity. URLs, titles, slugs, and bylines are attributes and may change. The server must validate provider and identifier format using the real MasterCMS contract; it must not scrape the public site to infer an ID.

## H. Publication and status model

The existing Work values `not_published`, `scheduled`, `published`, and `withdrawn` are an internal editorial tracking state. They remain intact initially. A linked record has a separate lossless `raw_status` plus optional normalized connector status such as `known`, `unknown`, `missing`, or `error`; normalized values must be defined only after MasterCMS states are known.

Examples such as `draft` or `published` are illustrative only and must not be hardcoded without CMS documentation. If Work says `published` while CMS says draft, or the reverse, retain both values and show a non-destructive reconciliation warning. No automatic state transition is allowed in v1.

## I. URL semantics

Before a CMS link, `journalism_task_details.article_url` remains the existing manual publication URL. After a healthy link, the connector's cached `canonical_url` is the authoritative linked public URL for display. Keep `article_url` as legacy compatibility data; do not maintain two competing canonical values without documenting this priority. Do not silently overwrite the Work Task title from a CMS title.

## J. Authorization

CMS metadata is visible only when the actor can view the parent Journalism Task. The link must never bypass Task visibility or expose a side-channel to the CMS archive.

Proposed mutation permission: `journalism.cms.link`, scoped exactly like the authorized Journalism structure-management decision after owner review. A minimal starting matrix is leadership and department managers; adding `phong_vien` with `assigned` scope is an explicit newsroom-workflow decision, not an automatic grant. A separate `journalism.cms.sync` permission is unnecessary if refresh is a server-controlled operation on an already authorized linked Task; introduce it only if manual refresh is intentionally restricted.

No `cms.publish`, `cms.unpublish`, or `cms.delete` permission belongs in v1. J6A does not change the current 21/140 RBAC catalog.

## K. CMS client boundary

The browser calls same-origin Work APIs only. A future server-only client owns endpoint construction, authentication, TLS validation, bounded response parsing, redaction, and provider-specific status translation. Credentials are never returned in DTOs, logs, browser bundles, or error messages. No CMS endpoint is asserted by this contract until owner-supplied documentation confirms it.

## L. Sync model

Recommended progression:

1. Manual or exact-ID lookup plus read-only metadata synchronization.
2. An explicit refresh operation against one authorized link.
3. Webhook or bounded polling reconciliation only if MasterCMS supports a verifiable contract.
4. Any CMS draft creation or publishing action only in a later separately approved checkpoint.

The direction is CMS to Work metadata. Work must not push article body or publication commands in v1. An external CMS read occurs before the DB link transaction; the transaction then revalidates Task type, actor scope, uniqueness, and current link state. External network calls must not hold a DB transaction open.

## M. Caching and freshness

Task lists use cached Work metadata only and never call MasterCMS once per row. Task detail prefers cached link data and remains available during CMS outage. On-demand refresh is explicit or asynchronous; a normal Task render must not wait on a live CMS request. `last_synced_at`, `sync_status`, and a safe error code communicate freshness without exposing raw provider responses.

## N. Webhook and polling requirements

Webhook feasibility is unknown. If supported, require the actual CMS signature/authentication method, timestamp/replay protection where provided, event-ID idempotency, bounded bodies, rate limiting, server-only processing, and audit/operational telemetry. Do not invent an HMAC scheme or header name.

If polling is required, use a bounded batch, real CMS cursor or timestamp, connect and overall timeouts, rate limits, retry backoff, stale/error states, and per-run metrics. Never put an unbounded sync batch in a user request. A v1 circuit breaker is likely unnecessary if requests are bounded and asynchronous, but outage counters/cooldowns should be reconsidered after real traffic characteristics are known.

## O. Failures and retries

Failure categories must distinguish timeout/network, 401/403, 404/missing, 409/version conflict, 429/rate limit, 5xx provider failure, malformed response, and unknown status. Work remains usable on all CMS failures; cached data stays readable and the UI shows a safe message such as `Không thể đồng bộ MasterCMS`.

The current repository has no generic server CMS HTTP client or shared external retry policy. J6B must choose bounded values from the confirmed CMS SLA and existing operational conventions rather than inventing unbounded retries. Retry only transient network/429/5xx failures; do not retry authentication, validation, missing-content, or version conflicts automatically.

## P. Audit and logging

User-visible link/unlink operations belong in existing `audit_logs` with actions such as `link_mastercms_content` and `unlink_mastercms_content`; unlink explicitly means “remove only the Work relationship, never delete or unpublish CMS content.” Routine sync success/failure is operational telemetry unless an owner requires an audit event. Structured logs may include provider, Task ID, CMS content ID, operation, duration, HTTP status class, result, and redacted error code. Never log tokens, authorization headers, secrets, or full provider bodies.

## Q. Secrets and network security

Current source uses server environment variables for Supabase, session, Telegram, Resend, attendance bridge, recurrence, and feature flags. No MasterCMS variable name or secret exists in the repository. Proposed names such as `MASTERCMS_BASE_URL` and `MASTERCMS_API_TOKEN` are placeholders only and must not be committed until the real deployment secret pattern and CMS authentication are confirmed.

Use HTTPS and normal certificate verification. Do not add insecure TLS fallbacks. Determine whether MasterCMS is public or private, which firewall/allowlist is required, and whether staging/sandbox exists. Never test CMS writes against production; if no sandbox exists, keep implementation read-only until explicit owner approval.

## R. DTO contract proposal

Journalism detail may eventually expose:

```json
{
  "cms": {
    "provider": "mastercms",
    "contentId": "opaque-string",
    "contentType": null,
    "title": null,
    "rawStatus": null,
    "canonicalUrl": null,
    "cmsPublishedAt": null,
    "cmsUpdatedAt": null,
    "lastSyncedAt": null,
    "syncStatus": "never_synced"
  }
}
```

The object is `null` for an unlinked or historical Journalism Task, never an empty fake object. Normal Tasks continue to return `journalism = null`. Task lists carry only a compact cached summary such as `cmsLinked` and a status; they do not embed large CMS metadata.

## S. Future UI implications

J6A adds no UI. A later Task-detail section may show linked/unlinked state, CMS title, raw/normalized status, canonical URL, CMS update time, and last sync time. Actions are permission-aware `Liên kết bài CMS`, `Đồng bộ lại`, and `Bỏ liên kết`. There are no Publish, Unpublish, Delete, or body-edit buttons in the first connector. Divergence is a clear, non-destructive warning.

## T. Legacy behavior

Existing Journalism Tasks have `cms = null`. Do not backfill links from `article_url`, Task title, or Work publication status. Current production characterization reports zero Journalism detail rows in the active target; that is a statement about the current target, not a general assumption about historical environments.

## U. Taxonomy and author mapping

Work Topics/Series are internal editorial concepts. CMS categories/tags are public taxonomy and must not be equated. A future explicit mapping layer may map one internal concept to zero or more CMS terms; no automatic mapping belongs in v1.

CMS author identity may be staff ID, user ID, author ID, email, username, or byline text. Do not match by display name alone. A `staff_users` to CMS-author mapping is optional and must not block link/read synchronization unless the owner makes it a requirement.

## V. Future test contract

Tests must cover schema uniqueness and Journalism-only checks; parent Task visibility and scope; secret isolation; exact-ID/link/unlink/conflict races; CMS success, timeout, 401/403, 404, 409, 429, 5xx, malformed response, unknown status, TLS failure, and stale-version handling; idempotent sync; URL/status changes; missing content; cached reads; no live CMS call in lists; no N+1; safe errors; and J3/J4/J5/normal-Task regressions.

## W. Implementation phases

- **J6A**: characterization and this contract only.
- **J6B**: owner-approved link schema and cached read DTO; no CMS writes.
- **J6C**: server-only CMS client and read-only exact-ID lookup/refresh.
- **J6D**: link/unlink authorization, atomic uniqueness, and audit.
- **J6E**: webhook/polling reconciliation only if supported.
- **J6F**: permission-aware UI.
- **J6G**: controlled production activation and smoke.

This sequence is intentionally adjustable after MasterCMS capability discovery. J6B implementation is not approved by this document.

## X. Owner decisions

| Decision | Options | Recommendation | Impact |
|---|---|---|---|
| Task-to-CMS cardinality | one-to-one; one-to-many | one-to-one for v1 | unique Task and provider/content ID; multi-record model needs new contract |
| CMS writes in v1 | link/read/sync only; draft/publish/write | read/link/sync only | no CMS mutation permissions or rollback risk |
| Status ownership | Work-only; CMS replaces Work; separate states | separate Work and CMS states | preserves J3/J4 history; divergence is visible |
| URL | reuse `article_url`; dedicated link canonical URL with legacy compatibility | dedicated link canonical URL, retain `article_url` legacy | avoids competing semantics; no automatic backfill |
| Who can link | leaders/managers; include assigned reporters | leaders/managers first; owner decides reporter `assigned` | determines future grant matrix; no RBAC change in J6A |
| Sync trigger | manual; polling; webhook; hybrid | manual/read-only first, then hybrid only if supported | controls latency, operational load, and security surface |
| Cache CMS title | no; optional display cache | optional bounded cache | improves reference display without changing Task title |
| Unlink | remove Work relation; CMS-side deletion | Work relation only, never CMS mutation | safe, auditable, reversible at the relationship level |
| Taxonomy mapping | automatic in v1; explicit later mapping | no v1 mapping | prevents internal/public taxonomy drift |
| Legacy `article_url` | auto-link; leave unlinked | leave unlinked | avoids fuzzy matches and unintended production relationships |

## Y. Risks and mitigations

| Risk | Mitigation |
|---|---|
| CMS outage or latency affects Work | cached metadata, bounded server requests, explicit/asynchronous refresh, safe degradation |
| Stale cached status | `last_synced_at`, sync state, visible freshness warning, version/ETag when supported |
| Duplicate or concurrent links | unique provider/content and Task constraints, revalidate after external read, 409 on race |
| One Task legitimately produces multiple records | characterize content model first; owner approval before changing cardinality |
| URL changes or URL used as identity | opaque CMS ID is identity; canonical URL is mutable cache |
| Topics/Series confused with CMS taxonomy | separate namespaces and no implicit mapping |
| Work/CMS publication divergence | retain both states and show non-destructive reconciliation warning |
| Secret or response leakage | server-only client, redacted structured logs, bounded DTO/errors, no browser CMS credentials |
| Unrestricted CMS search | exact ID/URL lookup or tightly scoped recent search only; inherit Task visibility |
| Retry storm | finite timeouts, transient-only retry, backoff/rate limit, batch bounds |
| Webhook forgery/replay | use the actual CMS signature/event contract, timestamp/event idempotency, rate limits |
| CMS API/schema drift | strict adapter parsing, preserve raw status, contract fixtures, fail closed on malformed data |
| Accidental production CMS write | no write client/actions in v1; staging required for future mutation testing |
| Legacy `article_url` reconciliation | no automatic backfill; separate owner-approved reconciliation |
| N+1 external calls | list/detail use cache; refresh is explicit or background |

## Z. Unknown MasterCMS requirements

The repository contains no MasterCMS client, endpoint documentation, webhook contract, CMS env names, credentials, staging configuration, content-model documentation, status enumeration, ID format, author model, taxonomy model, rate limits, version/ETag behavior, or deletion/archive semantics. These must be supplied or safely characterized before J6B/J6C. J6A must not invent any of them.
