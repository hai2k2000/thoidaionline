# Journalism J6A MasterCMS Connector Review

Status: **J6A = DONE** — design/characterization only
Next status: **J6B = READY FOR OWNER REVIEW** (implementation is not approved)

## 1. Exact inspected source baseline

The isolated worktree was created from report-only J5 closure commit `21dcabf619e57b7512c39f8c5e3f5432ef9069e8`, whose application ancestor is `078199d865a00ee216d429a1b1a3caad43da997d`. The inspected branch is `journalism-j6a-cms-connector-contract`.

Relevant existing Journalism files include:

- `src/app/api/tasks/[id]/journalism/publication/route.ts`
- `src/components/JournalismPublicationControls.tsx`
- `src/lib/journalismMutationValidation.ts`
- `src/lib/journalismJ4b5Integration.test.mjs`
- `src/lib/journalismPublicationUi.test.mjs`
- `supabase/migrations/20260918100000_journalism_tasks_j2_schema.sql`
- `supabase/migrations/20260918120000_journalism_tasks_j3_mutations.sql`

The J2 schema confirms the current Work-side fields `publication_status`, `planned_publication_at`, `published_at`, `article_url`, and the four allowed publication states. J3 mutation RPCs validate and audit those Work-side transitions. J4 UI controls call same-origin Work routes and handle conflicts without an automatic retry.

## 2. Production J5 baseline

J5 is closed and production-complete. The active release is:

`/opt/releases/thoidai-work/078199d865a00ee216d429a1b1a3caad43da997d-j5f-20260919T013220Z`

Application commit: `078199d865a00ee216d429a1b1a3caad43da997d`
J5 report closure commit: `21dcabf619e57b7512c39f8c5e3f5432ef9069e8`
RBAC: 21 permissions / 140 grants
Canonical hash: `99b3a0991ffd411825e188a5acbc1b67390c96763ff86b58c7197347f0148c3a`
Flag: `TASK_RBAC_V2_ENABLED=true`

J6A does not change this baseline, production, systemd, database, migration ledger, schema, RBAC, or release.

## 3. Existing CMS-related source/config characterization

### CONFIRMED FROM SOURCE/DOCS

- No file in the inspected `src/`, `supabase/`, `ops/`, or repository documentation contains a MasterCMS connector, `mastercms` identifier, `thoidai.com.vn` API integration, CMS content ID, CMS webhook, CMS client, or CMS-specific external ID.
- No CMS API route, background CMS worker, scheduled CMS job, CMS lookup, CMS sync, or CMS mutation exists.
- No CMS environment variable name is present. Existing names include Supabase, session, Telegram, Resend, attendance bridge, recurrence, and feature flags; their values were not printed.
- HTTP calls are direct `fetch` calls in isolated features (for example Telegram/Resend notification routes and browser-side Work APIs). There is no shared server-side external HTTP client abstraction.
- There is no shared CMS timeout/retry/backoff policy. Existing safe patterns include `AbortController` for browser request cancellation, bounded UI refresh behavior, rate-limit `Retry-After` for authentication, and no automatic retry for J4 publication/association conflicts.
- Logging is sparse structured `console.error`/`console.warn` with safe codes/statuses; no CMS response-body or credential logging convention exists.
- Scheduled jobs in the repository are Work evaluation/recurrence jobs, not CMS synchronization workers.

### INFERRED FROM CURRENT ARCHITECTURE

- Work is the canonical internal operations system: `tasks` plus `journalism_task_details`, Topics, Series, comments, attachments, workflow, and scoring.
- The existing publication state is a Work-side editorial tracking contract, not proof of MasterCMS state.
- Same-origin Work APIs and server-only Supabase access are the established security boundary. A future CMS client should follow that boundary.
- Existing J5 visibility patterns imply CMS metadata must inherit parent Task visibility; a separate global CMS read path would be a side-channel.

## 4. MasterCMS capability characterization

### CONFIRMED FROM SOURCE/DOCS

None. No local MasterCMS API documentation, client, endpoint, webhook specification, content model, status list, credential configuration, staging environment, or CMS contract was found.

### UNKNOWN / OWNER INPUT REQUIRED

- Base URL, transport, authentication, TLS/allowlist requirements, staging/sandbox, and API version.
- Content types and cardinality: articles, media posts, galleries, videos, editions, localized variants, revisions, and whether a “content ID” identifies a root or a version.
- Exact ID format, URL lookup behavior, canonical URL rules, status values, publish/update timestamps, deletion/archive semantics, and version/ETag support.
- CMS author/byline identity, taxonomy/category model, webhook signature/replay contract, event IDs, polling cursor, rate limits, quotas, and SLA.
- Whether read-only lookup is permitted for a service identity and whether owner-controlled test content exists.

No external CMS URL was called and no credential was used. No CMS content was read, written, published, unpublished, deleted, or mutated.

## 5. Recommended architecture

Use a dedicated Work-side CMS-link relationship with one-to-one cardinality for v1, bounded cached metadata, and CMS-to-Work synchronization only. Keep the Work publication state separate. Work never becomes the article editor or publisher in the first connector.

The server-only connector boundary should perform exact-ID lookup, response validation, status preservation, redaction, timeout/retry handling, and safe error mapping. Task list/detail reads use cache; explicit refresh or an asynchronous reconciler performs external I/O. Unlink removes only the Work relationship and never calls CMS delete/unpublish.

## 6. Permission recommendation

Do not change RBAC in J6A. For a future J6D, start with one mutation permission `journalism.cms.link`, inheriting authorized Journalism Task visibility. Leadership and department managers are the conservative default. Adding reporters/staff with `assigned` scope is an owner workflow decision. A separate `journalism.cms.sync` permission is not required when sync is server-controlled for an already authorized link; add it only if manual refresh needs a distinct policy. Never add CMS publish/delete permissions in v1.

## 7. Data model recommendation

The contract proposes `journalism_cms_links` with `unique(task_id)` and `unique(provider, cms_content_id)`, raw CMS status, optional display title, canonical URL cache, CMS timestamps, optional version/ETag, last sync time/status, and safe error code. This is a design proposal only. It is not a migration and does not authorize schema work.

`journalism_task_details.article_url` remains a legacy/manual compatibility field. A healthy CMS link's cached canonical URL is authoritative for linked display. Existing historical Tasks remain unlinked; no title/URL/publication-status fuzzy backfill is allowed.

## 8. Contract decisions and blockers

Recommended decisions are recorded in the companion contract: one-to-one v1, read/link/sync only, separate publication states, dedicated link canonical URL with legacy `article_url`, leadership/managers first, manual read-only refresh before webhook/polling, optional cached CMS title, Work-only unlink, no taxonomy mapping, and no legacy auto-link.

Blockers before J6B implementation:

1. Owner confirmation of one-to-one cardinality against the real CMS content model.
2. Owner-supplied MasterCMS API/auth/content/status/webhook or polling documentation.
3. Decision on who may link and whether manual refresh needs its own permission.
4. Decision on link-history retention versus physical link removal.
5. Confirmation of staging/sandbox or explicit read-only-only constraint.

## 9. Risks

The companion contract analyzes CMS outage/latency, stale cache, duplicate links, multi-record deliverables, unstable URLs, taxonomy confusion, status divergence, secret leakage, unrestricted search, retry storms, webhook forgery/replay, API drift, production write risk, legacy URL reconciliation, and N+1 external calls with mitigations for each.

## 10. J6B recommendation

**NO-GO for J6B implementation today; GO for owner review of the J6B design gate.**

The architecture is sufficiently specified for review, but implementation must wait for the unknown MasterCMS contract and owner decisions above. When those inputs are supplied, J6B may implement only the approved link schema and cached read DTO, still without CMS writes or production activation.

## 11. Docs-only gate

J6A changes exactly these two documentation files:

- `JOURNALISM_CMS_CONNECTOR_J6_CONTRACT.md`
- `JOURNALISM_CMS_CONNECTOR_J6A_REVIEW.md`

No `src/`, `supabase/`, migration, package, ops, systemd, production DB, CMS, or RBAC change is part of J6A.
