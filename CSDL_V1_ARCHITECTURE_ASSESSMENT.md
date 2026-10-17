# CSDL V1 - Architecture Assessment

**Project:** Thoi Dai Work 3.0  
**Scope:** CP0-A read-only architecture assessment for the Database Management Module V1  
**Assessment date:** 2026-10-17  
**Repository:** `hai2k2000/thoidaionline`  
**Canonical local branch/HEAD:** `integration/production` / `d4d773dd6fa8e7b544eebf95b067009337a0e4e0`  
**Production release observed:** `/opt/releases/thoidai-work/thoidai-artifact-d4d773dd6fa8e7b544eebf95b067009337a0e4e0`

This document is an architecture survey and recommendation only. No application code, migration, database, storage, deployment configuration, or production state was changed.

## 1. Executive conclusion

### RECOMMENDED ARCHITECTURE

Build Database Management V1 as an additive module inside the existing Thoi Dai Work application and PostgreSQL/Supabase project:

- Reuse the existing Next.js App Router, server API route, session, RBAC, Supabase query, audit, storage-signing, CI, immutable-release, health-check, rollback, and disk-guard patterns.
- Add module-specific tables and RPCs to the existing PostgreSQL database. Keep the first version in the existing database namespace with a clear `db_`/`record_` naming convention and explicit ownership, rather than introducing a second application or database.
- Enforce record-level authorization through one shared policy model at API, RPC/database, search, preview, export, and download boundaries. A software administrator is not automatically allowed to read every restricted record.
- Keep Word/PDF/Excel business files in a private VPS storage root outside releases, builds, and worktrees. Treat Google Drive as a future adapter for independent image/audio/video objects and links; do not connect it during CP0-A.
- Implement V1 metadata search with PostgreSQL indexes and bounded full-text search. Defer OCR, vector search, and AI retrieval to a later phase.

### CP0-A: PASS

The current architecture is suitable for an additive module. CP0-A is complete for architecture review, with the policy/configuration conflicts and unresolved production facts listed in Sections 12 and 13.

### NEXT STEP: OWNER ARCHITECTURE REVIEW

Owner decisions are required before CP1 design/implementation begins. No CP1 work is authorized by this report.

## 2. Evidence baseline

| Area | Evidence | Finding |
|---|---|---|
| Source baseline | `package.json`, `next.config.ts`, Git `integration/production` at `d4d773d` | Next.js standalone application with a stable canonical baseline |
| Production | VPS `systemctl show thoidai-work`, release pointers, `PROJECT_STATUS.md` | Service is active; systemd uses `/opt/releases/thoidai-work/current`; public entry is Nginx |
| Release provenance | `/opt/releases/thoidai-work/*/.release-meta` | Production is artifact/release based; release metadata is the provenance source |
| Database | `supabase/migrations/`, 175 migration files | PostgreSQL/Supabase schema evolves through additive, ordered migrations and RPCs |
| Auth/session | `src/lib/serverSession.ts`, `src/lib/sessionToken.ts` | Application HMAC session cookie or bearer token; server-side user lookup and session-version invalidation |
| RBAC | `src/lib/rbac/authorization.ts`, `src/lib/rbac/repository.ts`, RBAC migrations | Catalog-driven permissions, scopes, user allow/deny overrides, explicit deny precedence |
| Storage | `src/lib/taskHandlers.ts`, `src/app/api/hr/upload/route.ts`, storage migrations | Private Supabase buckets/signed URLs plus guarded VPS runtime storage for legacy HR files |
| Audit | `src/lib/serverAudit.ts`, `src/lib/services/audit.ts`, `public.audit_logs` migrations | Server-side audit writes are used by business mutations and RPCs |
| Deployment | `scripts/production/deploy-external-artifact.sh`, `deploy-gate.sh`, `release-retention.sh` | Verify-only handoff, immutable release promotion, atomic pointers, rollback and retention controls |

Important baseline discrepancy: the VPS source checkout is dirty and on `feature/asset-management-v21-quantity-import`, while production runs from the immutable release above. The checkout must not be treated as production provenance. The release `.release-meta` and artifact manifest are authoritative for a deployment.

## 3. Current architecture

### Stack and application shape

- Next.js `16.3.4`, React `19.2.3`, TypeScript `^5` (`package.json`).
- App Router under `src/app`; server API routes under `src/app/api`; reusable client/server UI under `src/components` and `src/lib`.
- `next.config.ts` uses `output: "standalone"`; production artifacts contain the standalone server and manifest files.
- Styling uses Tailwind CSS 4/PostCSS and project fonts from `src/app/layout.tsx` (`Be_Vietnam_Pro`, `Geist_Mono`).
- There is no ORM. Queries use `@supabase/supabase-js` through `serverSupabase` and repository/service modules.

### Current system diagram

```text
User browser
    |
    | HTTPS (edge/CDN/WAF layer not independently verified)
    v
Nginx on VPS (thoidai.online)
    |
    +--> 127.0.0.1:3001  thoidai-work Next.js standalone service
    |        |
    |        +--> server session + RBAC checks
    |        +--> Supabase JS service-role query/RPC layer
    |        +--> private Supabase Storage signed URLs
    |        +--> private VPS runtime file storage (selected legacy paths)
    |
    +--> 127.0.0.1:54331  Supabase/PostgREST path observed in Nginx config
             |
             +--> PostgreSQL schema, RPCs, RLS, audit_logs
```

Cloudflare/CDN/WAF ownership and behavior were not proven by the available repository or VPS evidence. Nginx and local upstreams were verified; the edge provider remains an owner/operations question.

## 4. Reusable components

The following should be reused rather than recreated:

1. **Application shell:** `src/app/layout.tsx`, `AppNav`, existing page shells, Tailwind tokens and responsive table/dialog patterns.
2. **Session:** `getSessionUser()` and `serverSession.ts`; do not create a second login, cookie, or token issuer.
3. **Authorization:** `src/lib/rbac/authorization.ts`, `rbac/repository.ts`, `permissionCatalog.ts`, and the existing scope/deny model. Add new permission catalog entries through the same mechanism.
4. **API boundary:** `requireReadActor`, `requireMutationActor`, `isSameOriginRequest`, `apiJson`, `apiError`, and server-only route modules.
5. **Data access:** repository/service separation, `serverSupabase`, RPC-first guarded mutations, additive migrations, and the existing migration test/rehearsal approach.
6. **Audit:** `logServerAudit`, `services/audit.ts`, and `audit_logs`; all create/update/approve/delete/restore/export/ACL changes should use the existing audit contract.
7. **Files:** private Supabase buckets, signed URLs, MIME/signature/size validation, and guarded download routes. The task-private storage path is the closest reusable pattern.
8. **Delivery:** GitHub Actions artifact build, `.release-meta`, manifest/checksum/secret scan, `deploy-external-artifact.sh`, `deploy-gate.sh`, atomic release pointers, health checks, rollback and retention dry-run.

## 5. Database and query architecture

The repository contains 175 ordered migrations. The baseline and later migrations define departments, roles, users, tasks, documents, assets, schedules, performance, attendance, permissions, audit, attachments, and related workflow tables. Examples include:

- Identity/organization: `departments`, `roles`, `role_permissions`, `staff_users`, `job_titles`, `employee_profiles`.
- Work and history: `tasks`, `task_assignees`, `task_comments`, `task_status_events`, `task_deadline_history`, `task_attachments`, `task_progress_reports`.
- Existing document/asset domains: `official_documents`, `document_assignments`, `assets`, `asset_assignments`, `asset_locations`, `asset_service_records`.
- Authorization/audit: `permissions`, `role_permission_grants`, `user_permission_grants`, `audit_logs`.

The query layer is direct Supabase/PostgREST access from server-only repositories. High-value mutations are delegated to security-definer RPCs with explicit grants and audit writes. There are existing indexes for department/status/due-date, assignment, audit time, document deadlines, asset custody/location, and other module-specific access paths.

### RLS and security interpretation

The earliest baseline contains permissive anonymous policies, but the later hardening migration (`20260901095000_backend_security_hardening.sql`) enables RLS, revokes business-table access from `public`, `anon`, and `authenticated`, removes legacy public storage policies, and grants access to `service_role`. The application then performs its own HMAC-session and RBAC checks before using the server-only service-role client.

This is an important compatibility constraint: a new module must not expose direct browser Supabase access. New record tables and storage objects should follow the hardened server-only pattern, with RPCs/policies tested on an isolated database fixture before any production migration.

### Backup and restore

Backup/restore and disposable PostgreSQL rehearsal procedures are documented in `docs/operations/`, `docs/PHASE8_RLS_HARDENING_RUNBOOK.md`, and the project status/readiness reports. The VPS has separate `ops-backups`/evidence areas and release rollback pointers. A fresh production backup and restore verification were not rerun for CP0-A; doing so would exceed the read-only architecture-survey scope.

## 6. Database option comparison

| Option | Reuse | Isolation | Authorization | Migration/backup | Complexity | Assessment |
|---|---|---|---|---|---|---|
| **A. More tables in current PostgreSQL** | Highest; same app, connection, RPC, audit and backup path | Logical isolation by table/module and permissions | One RBAC/RPC model; easiest to enforce consistently | One migration ledger and backup; simplest rollback unit | Lowest | **Recommended for V1** |
| **B. Separate schema in same PostgreSQL** | Good, but requires schema-qualified queries, grants, search path and tooling changes | Stronger namespace boundary | Requires careful PostgREST/exposure and cross-schema grant design | Same database backup, but schema-specific restore/testing is more involved | Medium | Viable if owner requires namespace isolation |
| **C. Separate database, shared application** | Lowest; new connection, health, migration and backup lifecycle | Strongest physical/database isolation | Risk of a second permission/data path and cross-database consistency gaps | Separate backup/restore/PITR and deployment gates | Highest | Not justified for V1; reserve for scale/compliance evidence |

**Recommendation:** Option A, with an explicit module table prefix and a strict repository boundary. Option B can be revisited if a compliance requirement demands schema-level ownership separation; it should not be selected merely to make tables look cleaner.

## 7. Proposed V1 data model

The following is a conceptual design only; no tables or migration were created in CP0-A.

```text
record_categories
  id, parent_id, code, name, active, sort_order

records
  id, category_id, record_code, title, summary, status,
  department_id, owner_id, created_by, created_at, updated_at,
  discoverability, retention_class, search_document

record_metadata
  record_id, metadata_schema_version, common_fields_json,
  typed_fields_json, indexed_text, updated_at

record_files
  id, record_id, storage_backend, storage_key, original_name,
  mime_type, size_bytes, sha256, media_kind, preview_status,
  created_by, created_at

record_keywords
  record_id, keyword

record_relations
  record_id, related_record_id, relation_type

record_acl
  record_id, principal_type, principal_id, capability,
  effect, scope, granted_by, expires_at

record_history
  id, record_id, actor_id, action, old_data, new_data, created_at
```

Recommended V1 boundary:

- Include categories, record identity, common metadata, typed metadata for the first approved record types, files, keywords, relations, status, ACL, history, and search filters.
- Keep `common_fields_json`/`typed_fields_json` bounded and schema-versioned; do not turn V1 into an ungoverned arbitrary JSON database.
- Do not replace MasterCMS, accounting, or any specialist system. Store links/identifiers where another system remains the system of record.
- Defer workflow automation, OCR extraction, semantic indexing, bulk reclassification, and external Drive synchronization to V2 unless an owner decision explicitly narrows V1.

## 8. Record-level authorization model

### Capabilities

Add catalog entries to the existing RBAC system, for example:

| Capability | Meaning |
|---|---|
| `record.discover` | The user may know that a matching record exists |
| `record.metadata.view` | The user may see allowed metadata fields |
| `record.preview` | The user may obtain a preview/thumbnail/converted view |
| `record.download` | The user may download the original file |
| `record.create` / `record.edit` | Create or update records within the permitted scope |
| `record.approve` | Approve/release a record |
| `record.delete` / `record.restore` | Soft-delete or restore |
| `record.export` | Export metadata or files |
| `record.acl.manage` | Grant/revoke record-specific access |

### Decision order

1. Reject inactive users and inactive roles.
2. Resolve the existing role grants and user override through `api_list_effective_permissions`.
3. Apply explicit user `deny` before role or department grants.
4. Evaluate record ACL and ownership/department scope.
5. Apply field-level restrictions for sensitive metadata.
6. Return only the minimum result needed for the requested operation.

Search must filter unauthorized records before pagination/counts are returned. Download and preview must repeat the same decision immediately before issuing a short-lived signed URL or reading a VPS file. An administrator or permission manager may manage the system without automatically receiving `record.download` for restricted records.

The same decision contract must be represented in:

- API route guards and server repositories;
- security-definer RPCs and database grants/RLS;
- search predicates and count/pagination queries;
- preview/export/download handlers;
- audit records for ACL and sensitive-file access.

## 9. Storage architecture

### VPS private storage

Use a stable private path such as `/opt/thoidai-work-data/records` (exact path requires owner/operations approval), outside `/opt/releases/thoidai-work`, `.next`, Git worktrees, and build artifacts. Store only files and immutable metadata references there; keep the authoritative record metadata, hashes, ACL, and history in PostgreSQL.

Required adapter behavior:

- Generate a storage key from record ID and server-generated UUID; never trust a user path.
- Allow only approved MIME types/extensions, size limits, and content-signature checks where applicable.
- Store SHA-256 and byte size at upload; verify on backup/restore and optional integrity jobs.
- Serve files only through an authenticated, authorization-checked route; never expose the directory through Nginx static root.
- Keep upload/download outside release replacement and never delete files as part of release retention.
- Back up the data root separately from application releases and document restore order.

### Google Drive conceptual adapter

For images, audio, and video that are independent of the VPS document store, keep a provider-neutral `storage_backend`, `external_file_id`, link metadata, MIME/type, checksum when available, and last-verified timestamp. The adapter should:

- use a service account/shared-drive policy approved by the owner;
- keep credentials in runtime secret management only;
- re-check authorization and link expiry before returning a link;
- mark revoked/missing Drive objects as unavailable without deleting record metadata;
- support a future migration to another provider.

No real Google Drive connection, credential, or external file was used in CP0-A.

## 10. UI integration proposal

Reuse the existing `AppNav`, page shells, table/filter patterns, responsive overflow tables, dialogs, upload validation, and authenticated redirect behavior.

| Screen | Proposed route | Reusable patterns | V1 responsibilities |
|---|---|---|---|
| Data entry | `/database/records/new` | Existing document/asset forms, upload component, server action feedback | Category, code, title, common metadata, typed fields, keywords, files, initial ACL |
| Advanced search | `/database/search` | Existing filter bars, query-state controls, pagination/table patterns | AND/OR filters, exclusions, department/time/status/category, permission-filtered results |
| Record management | `/database/records` | Asset/document list tables, badges, bulk selection, dialogs | List, saved filters, soft-delete/restore, export, ACL/manage actions by permission |
| Record detail | `/database/records/[id]` | Existing detail pages, history panels, signed download controls | Metadata, file preview/download, relations, audit/history, ACL and status |

Mobile behavior should use the existing stacked/card fallback for dense tables, not a separate mobile application. The first UI milestone should be functional and accessible; visual polish must not introduce a parallel design system.

## 11. Search architecture

### V1

- Exact/prefix indexes for `record_code`, category, department, status, date and owner.
- Bounded `tsvector`/full-text search over title, summary, approved metadata labels and keywords, with a language configuration selected during implementation testing.
- Optional trigram matching only after confirming the extension and its index cost in the target PostgreSQL environment.
- Query builder with explicit AND/OR groups, exclusions, stable sort, cursor/offset bounds, and maximum result limits.
- Authorization predicate applied before result pagination, total counts, snippets, or highlights are emitted.
- Saved filters stored per user and scoped to the same authorization contract.

### Future extension points

```text
file -> text extraction/OCR -> normalized document text
     -> tsvector (V1/V2)
     -> embeddings/pgvector (future)
     -> semantic/AI retrieval with the same record authorization filter
```

OCR, vector storage, and AI search are not V1 acceptance criteria. They must not become a side channel that returns text from a record the caller cannot discover or download.

## 12. Local development proposal

Recommended Windows setup:

1. Windows host with WSL2 Ubuntu 24.04 for shell tooling and Docker integration.
2. A project-local Docker Compose/Supabase development stack or the existing Supabase CLI configuration, with an independent PostgreSQL database and storage fixture.
3. A separate `.env.local` containing only local placeholder/public values and a local `SESSION_SECRET`; never copy production `.env` or service-role keys.
4. Ordered migrations applied to the local database, plus deterministic seed users for admin, manager, ordinary employee, restricted-record user, and explicit-deny cases.
5. Local private storage root and fixture files with known MIME, size, checksum and failure cases.
6. Focused authorization, search, upload/download, audit, migration idempotency and restore tests before UI acceptance.

The current repository already supports `npm run dev`, Supabase migration files, Node test modules, and standalone packaging. A local Postgres/PostgREST-compatible path is preferable to a production database connection because it keeps the data and permissions testable and repeatable.

## 13. Future VPS deployment approach

After local acceptance and owner approval:

```text
feature branch
  -> focused tests / TypeScript / lint
  -> CI standalone artifact from exact canonical commit
  -> manifest + checksum + secret scan + route verification
  -> disk guard (hard floor 10 GiB; warning below 20 GiB)
  -> exact migration preflight on backup/restore fixture
  -> named production backup and migration approval (if schema changes)
  -> verify-only artifact handoff
  -> atomic immutable release activation
  -> service + HTTP health check
  -> rollback readiness verification
  -> bounded retention dry-run
```

Do not run a migration or activate production as part of CP0-A. Keep database/application data backups outside release retention. Keep staging outside the release root and use the existing cleanup safety checks. Authenticated smoke remains optional diagnostics under the current global policy; static/automated auth/RBAC checks, health, rollback and disk guards remain mandatory.

## 14. Risks and unresolved questions

### High-priority risks

- **Policy threshold wording conflict:** `AGENTS.md` and `docs/VPS_DISK_GUARD.md` define a 10 GiB hard floor and 20 GiB warning, while `docs/EXTERNAL_ARTIFACT_CI.md` contains wording that can be read as failing below 20 GiB. Owner/maintainer should normalize this before a new module deployment.
- **VPS checkout drift:** `/opt/thoidai-work` is dirty and on a feature branch. It is not currently the active release source, but it increases operational confusion and must not be used for provenance or ad-hoc builds.
- **Legacy baseline policies:** historical migrations include permissive anonymous policies; the hardening migration is relied upon to remove that exposure. New module migrations must be tested against the hardened state and must not replay the old baseline blindly.
- **Storage lifecycle:** the current code has both private Supabase buckets and a local HR runtime storage path. The new module needs one explicitly approved private storage root and a backup/restore contract before implementation.

### Owner decisions needed

1. Confirm Option A (current PostgreSQL, additive tables) as the V1 database boundary.
2. Approve the V1 record types, common metadata fields, retention classes and soft-delete semantics.
3. Approve whether restricted records hide existence (`discover`) or expose limited metadata to broader roles.
4. Approve the capability names/scopes and who may manage per-record ACLs.
5. Confirm the private VPS data root and backup/PITR owner; confirm whether Google Drive will be a V2 adapter.
6. Resolve the disk-policy wording conflict and identify the authoritative threshold text.
7. Confirm the required edge/WAF posture (Nginx only versus a verified Cloudflare/WAF contract).
8. Confirm whether V1 needs export of files or metadata only, and the maximum record/file volumes expected in year one.

## 15. V1 priority plan

### P0 - architecture and safety contract

- Freeze record types, metadata ownership, capabilities, ACL semantics, storage root, retention and audit events.
- Produce a schema/RPC contract and isolated fixture plan.

### P1 - foundation

- Add additive tables/RPCs and indexes.
- Add shared authorization resolver and server-only repositories.
- Add upload/download adapter with MIME, size, checksum and signed access.
- Add audit events and migration/idempotency tests.

### P2 - usable V1

- Build data-entry, search, management and detail screens using existing shells.
- Add permission-filtered pagination, saved filters, soft-delete/restore and export behavior approved by the owner.
- Run local role/deny/ACL, file-integrity, search and restore rehearsals.

### P3 - acceptance and release preparation

- Run focused tests, TypeScript/lint, artifact/secret/checksum verification, route verification and disk guard.
- Create a production backup/migration plan and verify-only artifact.
- Stop before activation until the separate owner deployment approval is granted.

## 16. Seven-day feasibility

**Feasible for a narrow V1 prototype/local acceptance; not feasible for a hardened production-grade archive in seven days without strict scope control.**

Reasonable seven-day target:

- one or two record types;
- common metadata plus a bounded typed-field form;
- private VPS/local file adapter without live Google Drive;
- role/department/record ACL with explicit deny;
- four screens with basic search, pagination, detail, audit and download;
- isolated database/storage fixture and focused regression tests.

Defer OCR, vector/AI search, broad data import, Drive synchronization, complex workflow, bulk reclassification, and historical data migration. A production rollout should be scheduled only after the local restore and authorization evidence is complete.

## 17. Final status

- **RECOMMENDED ARCHITECTURE:** Existing Thoi Dai Work Next.js + server-only Supabase/PostgreSQL, additive module tables/RPCs, shared RBAC, private VPS document storage, future provider-neutral Google Drive adapter.
- **CP0-A: PASS** — architecture survey complete; no application/database/production mutation performed.
- **NEXT STEP: OWNER ARCHITECTURE REVIEW** — approve the boundary, V1 scope, ACL semantics, storage/backup contract, and policy wording before CP1.

