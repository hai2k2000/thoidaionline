# Journalism J6A.2 — Private MasterCMS Contract Acquisition

**Scope:** owner-authorized, read-only acquisition attempt for the private MasterCMS technical contract used by `thoidai.com.vn`.

**Status:** J6A.2 complete as an acquisition attempt. No private MasterCMS contract was available on the authorized surfaces inspected. This report records the negative result; it does not invent or promote a public-site observation into a private API contract.

**Safety:** No Work or MasterCMS file was edited, no service was restarted, no database was queried or changed, no credential was created or rotated, no API key/token/session value was used or recorded, and no CMS mutation request was sent.

## Acquisition boundary and evidence classification

- **CONFIRMED:** The starting J6A.1 baseline is commit `f8216ad` on branch `journalism-j6a1-mastercms-discovery`; J6A itself remains `97640a26fc21f8c8d1174386aa651f3618f0971b`.
- **CONFIRMED:** The only owner-authorized private surface available in this session was read-only SSH access to the Work VPS at `103.216.118.49:24700` and the local Codex browser inventory.
- **CONFIRMED:** No authenticated MasterCMS admin browser tab/session was available; the browser inventory contained no tabs.
- **CONFIRMED:** No owner-supplied MasterCMS source repository, deployment directory, API/OpenAPI/Swagger document, read-only CMS service credential, vendor/internal technical document, or trusted-system integration code was identified on the inspected VPS paths.
- **UNKNOWN:** Whether the owner has such a private source elsewhere. This checkpoint did not guess, scrape private systems, or use unprovided credentials.

## A. Evidence source

- **CONFIRMED:** Read-only path/process/name inspection covered the VPS root deployment surfaces relevant to this request, including `/opt`, `/etc/nginx`, `/etc/systemd/system`, `/var/www`, `/srv`, `/home`, and `/root` (with secret values excluded).
- **CONFIRMED:** Matching directory/file-name searches found the Work J6A/J6A.1 worktrees and unrelated generic CMS skill directories, but no MasterCMS source or deployment directory.
- **CONFIRMED:** Process inspection showed Work/Node, nginx, Docker/Supabase, and unrelated services; no `mastercms` process or MasterCMS application was identified.
- **CONFIRMED:** The prior public discovery report remains the only evidence for public MasterCMS branding. It is not private contract evidence.
- **UNKNOWN:** Any private source/API/admin surface not mounted or disclosed on this VPS/session.

## B. MasterCMS version/build

- **CONFIRMED (public only, not private contract):** `thoidai.com.vn` publicly renders MasterCMS Ultimate Edition v2.9 / 2026 branding.
- **UNKNOWN:** Private application build, source revision, vendor patch level, runtime/framework version, and deployment artifact digest.
- **UNKNOWN:** Whether the public branding exactly matches the private API server/version used for integration.

## C. API base/version

- **CONFIRMED:** No private API base URL, hostname, path prefix, or version was supplied or found in the inspected VPS configuration/source names.
- **UNKNOWN:** Production and staging API base URLs, API version, media type, and documented operation IDs.
- **CONFIRMED:** Public `apiservice@/`/frontend strings were not treated as an API contract.

## D. Authentication

- **CONFIRMED:** No MasterCMS authentication configuration or read-only service credential was available to inspect.
- **UNKNOWN:** API key, bearer token, Basic Auth, OAuth, session cookie, signed request, mTLS, internal trust, or another scheme.
- **UNKNOWN:** Secret store/name, scope, expiry, rotation, revocation, and IP allowlist.
- **CONFIRMED:** No credential value was printed, transmitted, created, or rotated.

## E. Content entities

- **CONFIRMED:** No private model/entity source or API schema was acquired.
- **UNKNOWN:** Exact entities and relationships: article/news, video, gallery, edition, localized content, media, syndication copy, publication instance, or revision.
- **UNKNOWN:** Required fields for title, slug, canonical URL, status, timestamps, author, taxonomy, language, archive/deletion, and media variants.
- **CONFIRMED:** No private content record was opened or exported.

## F. Stable content ID

- **CONFIRMED:** No private ID field/type or lookup contract was acquired.
- **UNKNOWN:** Whether the authoritative identifier is a stable article/content root, a revision, a publication instance, a language variant, or a media variant.
- **J6B gate:** A stable identifier suitable for `unique(provider, cms_content_id)` is not confirmed. Do not implement the proposed link schema.

## G. Revision/version model

- **CONFIRMED:** No private revision/version model or concurrency contract was found.
- **UNKNOWN:** Revision IDs, version tokens, `updated_at`, ETag, `If-None-Match`, `If-Match`, row versions, draft/publish versions, and whether revisions receive separate IDs.
- **CONFIRMED:** No conditional request or version probe was issued.

## H. Cardinality

- **CONFIRMED:** No private content model was available to establish cardinality.
- **UNKNOWN:** Whether one editorial deliverable can create one record or multiple independently published records for article/gallery/video, language, device, edition, syndication, or revisions.
- **Decision:** The J6A one-to-one proposal remains unconfirmed; owner approval is still required before schema work.

## I. Status enumeration

- **CONFIRMED:** No private status enum/constants or endpoint was acquired.
- **UNKNOWN:** Literal provider status values and meanings, including draft, scheduled, published, archived, deleted, withdrawn, failed, and terminal/non-terminal behavior.
- **CONFIRMED:** No status was normalized or mapped to Work publication state.

## J. Canonical URL

- **CONFIRMED:** No private response field or URL-generation contract was acquired.
- **UNKNOWN:** Canonical URL field name/type, pre-publication behavior, redirect/slug-change behavior, URL mutability, and URL-to-ID resolution.
- **CONFIRMED:** Public URL patterns from J6A.1 are not used as private identity or schema evidence.

## K. Read endpoint

- **CONFIRMED:** No exact-ID read endpoint, method, authentication requirement, or response contract was available.
- **UNKNOWN:** Exact lookup path, content detail/status route, query parameters, pagination, timeout expectation, 404/401/403/429/5xx behavior, and malformed-response rules.
- **J6C gate:** Server-to-MasterCMS exact-ID lookup is not implementable from the acquired evidence.

## L. Response contract

- **CONFIRMED:** No private JSON/XML/schema response was acquired.
- **UNKNOWN:** Envelope, content ID/type, title, canonical URL, raw status, timestamps, author, taxonomy, language, revision/version, ETag, pagination, and nullable/error fields.
- **CONFIRMED:** No private payload or production content sample is reproduced in this report.

## M. Error contract

- **CONFIRMED:** No provider error envelope or documented status mapping was acquired.
- **UNKNOWN:** 400, 401, 403, 404, 409, 429, 5xx behavior; provider error codes; retryability; redaction requirements; and version-conflict semantics.
- **CONFIRMED:** No assumed endpoint was exercised to manufacture error evidence.

## N. Rate limits

- **CONFIRMED:** No private rate-limit, quota, `Retry-After`, timeout, or SLA documentation was available.
- **UNKNOWN:** Per-token/IP quotas, bursts, concurrency, retry guidance, maintenance windows, and service-level objectives.
- **CONFIRMED:** No load test or retry loop was run.

## O. Webhooks

- **CONFIRMED:** No private webhook/event documentation, receiver code, subscription configuration, or event catalogue was found.
- **UNKNOWN:** Event names, payload, event ID, timestamp, authentication/signature, replay protection, retries, ordering, and subscription lifecycle.
- **CONFIRMED:** No subscription or receiver was created.

## P. Polling/incremental sync

- **CONFIRMED:** No private change feed, cursor, `updated_since`, `modified_at`, or incremental-read contract was acquired.
- **UNKNOWN:** Cursor/watermark semantics, pagination limits, deletion visibility, and efficient sync support.
- **CONFIRMED:** No polling worker, cron, or scheduler was implemented or changed.

## Q. Staging/sandbox

- **CONFIRMED:** No owner-authorized staging hostname, sandbox, test tenant, or representative test data was found.
- **UNKNOWN:** Whether a non-production MasterCMS environment exists, its base URL, data parity, and read/write test policy.
- **Decision:** Until a sandbox is provided, future work must remain read-only against production and require a separate approval for any broader action.

## R. Author identity

- **CONFIRMED:** No private author model or field mapping was acquired.
- **UNKNOWN:** Author ID, staff record, email, username, byline, service account, and identity stability.
- **CONFIRMED:** No display-name matching or Work staff mapping was implemented.

## S. Taxonomy

- **CONFIRMED:** No private category/tag/section/channel/topic model was acquired.
- **UNKNOWN:** Taxonomy IDs, hierarchy, lifecycle, localization, and assignment rules.
- **CONFIRMED:** No mapping was made to Work editorial Topics or Series.

## T. Secret/env variable names

- **CONFIRMED:** No MasterCMS-specific environment variable name was found in the inspected Work repository/deployment surfaces.
- **CONFIRMED:** Existing environment values and unrelated secrets were not printed.
- **UNKNOWN:** Secret names in an undisclosed MasterCMS deployment or vendor-managed secret store.
- **CONFIRMED:** No proposed MasterCMS variable was added to Work.

## U. Network/TLS

- **CONFIRMED:** The inspected VPS exposes Work/nginx/Docker/Supabase surfaces, not a discovered MasterCMS private service.
- **UNKNOWN:** Private MasterCMS host, network route, firewall/IP allowlist, mTLS, certificate chain, and server-to-server reachability.
- **CONFIRMED:** No TLS verification was disabled and no network configuration was changed.

## V. J6B GO/NO-GO

**NO-GO.** The mandatory stable identity, cardinality, required cached metadata, URL semantics, and unlink/history policy remain unresolved. No schema, migration, RPC, or read DTO was implemented.

## W. J6C GO/NO-GO

**NO-GO.** The real API base, auth scheme, exact read endpoint, response fields, error contract, and safe secret-storage plan remain unresolved. No client, route, worker, webhook, polling, or integration was implemented.

## X. Remaining owner decisions

1. Provide or explicitly authorize a MasterCMS source/deployment/API-doc/admin/read-only credential surface.
2. Confirm the stable content-root identifier versus revision/publication/language/media identifiers.
3. Confirm one-to-one versus one-to-many newsroom cardinality.
4. Confirm raw status literals and meanings without premature normalization.
5. Confirm canonical URL field and bounded cached metadata.
6. Provide exact read endpoint, response, error, rate-limit, timeout, and version/ETag contracts.
7. Confirm webhook/polling/manual synchronization choice.
8. Provide staging/sandbox details or explicitly retain read-only production-only constraint.
9. Decide link history: physical unlink plus audit history, or retained historical link state.
10. Decide link permission: leadership/managers only, or also `phong_vien` with assigned scope; do not change RBAC in this checkpoint.

## Final diff gate and disposition

- **CONFIRMED:** This J6A.2 checkpoint changes documentation only.
- **CONFIRMED:** `JOURNALISM_MASTERCMS_CAPABILITY_DISCOVERY.md` was not revised because no private evidence materially resolved its unknowns.
- **CONFIRMED:** No `src/`, `supabase/`, migration, package, RBAC, ops, systemd, database, environment secret, or MasterCMS file changed.
- **CONFIRMED:** Stop here. Do not start J6B or J6C.
