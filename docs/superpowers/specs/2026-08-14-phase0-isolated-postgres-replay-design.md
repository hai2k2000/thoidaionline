# THỜI ĐẠI WORK Phase 0: Isolated PostgreSQL Replay Design

**Status:** Normative v5 corrective design for independent review. It supersedes every earlier forward-looking same-container or retained-log instruction while preserving the sealed Tasks 1–4 record as historical evidence only.

**Decision:** Quarantine the existing retained PostgreSQL container, volume, databases, secret, and Docker log without reading or mutating them. Build all further restore, diagnostic, fixture, and replay work in one newly named PostgreSQL 17 container and one newly named volume using the pinned image, Docker network mode `none`, zero published ports, log driver `none`, bounded resources, and PostgreSQL statement/error-statement logging disabled. Production stays SELECT-only; migration-history writes stay unreachable.

**Authority:** This document is design authority only. It neither authorizes Task 5 execution nor cleanup, service changes, production writes, staging, or commits. Execution is sequential through the Aylaspa-only operator after an approved committed handoff package passes the immutable pre-runtime gate.

## Normative v5 corrective addendum

This section has precedence over all sealed historical material and over every earlier design revision. The retained lane is quarantine evidence, not a replay lane:

- Never invoke a log-reading command for the retained container. Never read, copy, hash, print, delete, or truncate its Docker log.
- Never execute a command or database session inside the retained container. Never stop, restart, rename, remove, or otherwise mutate the retained container, volume, databases, or secret.
- Only host-side `docker inspect` and `docker volume inspect` metadata are permitted for the retained resources. Selected fields must exclude environment values, log content, database content, secret content, and private mount payloads.
- The former halted database is not used for rollback diagnostics. A new identity-free diagnostic clone in the new no-log lane replaces it.
- Both expected-negative `20260814130000` paths run only in the new lane and must yield the exact sanitized SQLSTATE `P0001`, the expected nonzero client status, and a byte-identical before/after fingerprint. Any other status, SQLSTATE, stderr shape, or fingerprint stops execution.
- A green replay never upgrades historical evidence. The production gate remains STOP because four versions are not `exact-applied`.

## 1. Purpose

Phase 0 determines the application status of eleven target migrations without blindly replaying production SQL or treating synthetic success as historical proof. It uses a sealed schema-only archive and sixteen SHA-locked migration sources to create three databases in a newly isolated PostgreSQL container:

1. a normalized, zero-row template;
2. an identity-free diagnostic clone;
3. a protected-shell successor clone.

The diagnostic and successor lanes remain separate. The diagnostic lane proves only rollback behavior without the protected precondition. The successor lane proves only technical replayability and idempotency with one synthetic shell. Neither lane authorizes production replay or a migration-history write.

## 2. Observed baseline

### 2.1 Pinned local image

The approved image is already present locally and must not be pulled or substituted:

| Field | Required value |
|---|---|
| Reference | `postgres@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d` |
| Image ID | `sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d` |
| PostgreSQL | 17.10 |
| OS / architecture | `linux/amd64` |

Image verification selects only ID, digest match/count, OS, architecture, and size. It must not dump image configuration, environment, or history.

### 2.2 Production compatibility metadata

The sealed production baseline is PostgreSQL 17.6, UTF8, ICU locale `en-US`, collation/type `en_US.UTF-8`, checksums off, and database owner `postgres`. The replay role named `postgres` is a non-superuser with the audited production attributes. The archive roles are `postgres`, `supabase_admin`, `anon`, `authenticated`, and `service_role`; built-in `pg_database_owner` is never recreated.

The scoped archive contains no extension objects. `plpgsql` and `pgcrypto` controls must exist in the pinned image. No extension may be downloaded, replaced, or silently omitted.

### 2.3 Sealed historical evidence

The evidence root `/opt/thoidai-reconciliation/phase0-20260814T135943Z` contains the Tasks 1–4 source manifest, schema-only archive, catalog/aggregate evidence, and retained resources. Those bytes are inputs only. The v4 review package and the root-only v4 pre-edit backup are independently checksummed before the v5 edit. The retained Docker log is expressly excluded from every verification and evidence manifest, regardless of any prior instruction that attempted to read or hash it.

The former Task-5 stop and its same-container measurements are historical facts, not authority to reuse the container. They explain why the old lane is quarantined and why v5 creates a new lane.

## 3. Goals

1. Invoke one manifest-sealed full immutable validator before any runtime object is created, again immediately before Task-5 completion, and again immediately before handoff publication.
2. Preserve production, the retained quarantine lane, Git state outside the authorized documentation commit, active provider/model, CLIProxyAPI, `9router`, services, routing, and active build.
3. Restore archive fidelity in a fresh isolated volume without production rows or credentials.
4. Contain the protected selector so it never reaches arguments, environment, generated files, terminal output, the Docker log stream, raw error evidence, or report text.
5. Require exact SQLSTATE evidence and rollback identity for both expected-negative paths.
6. Classify all targets with exactly the approved four-class taxonomy and enforce the all-or-nothing STOP.
7. Require an exact sealed role manifest for every bootstrap, archive, replay-owner, and supporting membership role, including attributes, connection limits, password-null state, memberships, forbidden-role absence, and non-superuser replay ownership.
8. Retain all new recovery resources for review; cleanup is outside this design.

## 4. Non-goals

- No production migration replay, history repair, history-row insertion, or history-row deletion.
- No production row copy and no production credential use in the isolated lane.
- No mutation of systemd, nginx, application source, provider/model selection, CLIProxyAPI, `9router`, active build, or production containers.
- No read or mutation of the retained container log, runtime, databases, volume, or secret.
- No automatic retry with broader privileges, weaker validation, a different image, networking, or a filtered archive.
- No stop, removal, database drop, cleanup, reboot, or service restart.

## 5. Architecture decision

### 5.1 Rejected paths

The following remain rejected: restore in the production cluster; shared-cluster restore with `--no-privileges`; filtered archive restore; direct privileged production-socket use; and reuse of the retained container. Earlier tests showed ownership/ACL/authentication failures, while independent review proved retained-log disclosure risk. These results are not rerun.

### 5.2 Approved new lane

The new lane has exactly these runtime controls:

| Control | Required state |
|---|---|
| Image | pinned digest above |
| Network | Docker mode `none` |
| Ports | zero published/exposed host bindings |
| Docker logging | driver `none` |
| CPU | 1 CPU |
| Memory / swap | 1 GiB / 1 GiB |
| PID limit | 256 |
| Privileged | false |
| Restart / auto-remove | `no` / false |
| Persistent mount | one newly named data volume |
| Secret mount | one new root-owned mode-0600 file, read-only |
| Scratch | bounded tmpfs; no source persistence |

PostgreSQL starts with:

- `log_statement=none`
- `log_min_error_statement=panic`
- `logging_collector=off`
- `log_destination=stderr`
- `log_error_verbosity=terse`

These settings are verified from a safe local session before any archive or migration source is streamed. Log driver `none` is a second, independent containment boundary. The runbook contains no log-reading command for either old or new containers.

## 6. Components and identities

1. **Quarantine lane** — the retained container, volume, databases, secret, and log; metadata-inspect only.
2. **Execution handoff package** — committed plan/design copies, exact `COMMIT.tsv` and `REVIEW.tsv` schemas, one reusable `VERIFY.sh`, and payload checksums; pointed to atomically by `HANDOFF.current` only after review, commit, and the same full validator passes.
3. **New evidence directory** — root-owned mode 0700 with mode-0600 files and its own manifests.
4. **New isolated container** — unique name, pinned image, no log driver, no network or ports, exact limits.
5. **New data volume** — unique name, mounted only into the new container.
6. **New secret** — generated for this lane, never printed or hashed, mounted read-only by file path.
7. **Fresh normalized template** — restored from `template0` plus the single measured PUBLIC-USAGE normalization, fidelity-sealed, zero-row, and connection-disabled after cloning.
8. **Identity-free diagnostic clone** — receives no protected shell and runs only the approved expected-negative diagnostic.
9. **Protected-shell successor clone** — receives six synthetic role/permission pairs, one synthetic department, and one minimal bound selector shell; runs the chronological replay and safe idempotency pass.

Every generated container, volume, and database name is unpredictable, validated against a strict safe-name grammar, checked for collision, and sealed before creation. Names are not reused from the retained lane.

## 7. Secret and selector handling

The new database password exists only in a root-owned regular file with mode 0600. Its bytes are never read into a shell argument, printed, hashed, stored in evidence, or included in Docker environment values. Only the password-file path is configured.

The protected source is SHA-locked. A tracing-disabled binding client reads it directly from host fd 0, parses exactly two approved syntax occurrences resolving to one unique validated value in a transaction-local table, binds the value through psql extended-query parameters, and clears the temporary state before commit. The selector is never copied to an argument, environment variable, generated file, stdout, stderr, evidence, report, or hash-input stream.

The retained Docker log is never used as a disclosure oracle. The new container cannot retain Docker log bytes because its driver is `none`, and PostgreSQL cannot log ordinary error statements under the required settings.

## 8. Cluster and restore bootstrap

The official image initializes a private PostgreSQL 17 cluster in the new volume. The bootstrap role is used only for cluster administration. Task 5 derives valid archive-role expectations from the sealed Task-4 manifest and extends them with an exact executable manifest for the bootstrap and supporting membership roles. Every selected role row includes `rolsuper`, `rolinherit`, `rolcreatedb`, `rolcreaterole`, `rolcanlogin`, `rolreplication`, `rolbypassrls`, `rolconnlimit`, and password-null state. Exact membership rows and an exact empty forbidden-role set are compared byte-for-byte. Fresh, diagnostic, and successor ownership must each be `postgres`, and that replay owner must be non-superuser.

The fresh database is created from `template0` with the audited encoding and locale. The sealed schema archive is streamed through stdin without a repository mount. Restore stdout/stderr is suppressed from the terminal; only generic exit status is recorded. Any nonzero status stops without cleanup.

The sole normalization is PUBLIC schema USAGE. It is allowed only after archive, production, template-pre, and sealed rollback-TDD gates match the approved counts. All owner, default ACL, explicit ACL, effective privilege, core object, function, extension, and zero-row fingerprints must then match the sealed production/template expectations.

## 9. Clone boundary

After fidelity and zero-row gates pass, the template must have zero other connections. The diagnostic and successor databases are cloned before any fixture or replay. Executable Task-5 queries must capture selected catalog definitions, all core-object counts, owner distribution, default and explicit ACL counts, effective table/function/schema privileges, all thirteen function/configuration/grant fingerprints, extensions, locale/settings, and zero-row state. The fresh template must match the sealed production/Task-4 evidence; both clones must reproduce every fresh-template fingerprint byte-for-byte. A fidelity manifest and `FIDELITY.COMPLETE` are created only after these comparisons pass. A separate sealed role-gate helper re-queries the complete role attributes, memberships, forbidden-role set, and all three database owners; Task 5 Step 6 and Task 6 invoke that helper again before sealing or replay. `TASK5.COMPLETE` is unreachable until both fidelity and role manifests re-verify. The template then disallows connections and remains inert.

No database from the retained cluster participates in this boundary. There is no cross-container database connection and no retained-volume mount.

## 10. Replay protocol

The exact chronological order is:

1. `20260813110000`
2. `20260813155000`
3. `20260813172000`
4. `20260813184000`
5. `20260813210000`
6. `20260813220000`
7. `20260813230000`
8. `20260813233000`
9. `20260813234500`
10. `20260814070000`
11. `20260814090000`
12. `20260814102000`
13. `20260814113000`
14. `20260814130000`
15. `20260814160000`
16. `20260814170000`

Immediately before every individual source stream—including the selector-binding fixture input, the identity-free negative path, each chronological replay item, and every idempotency item—a sealed source-gate helper must re-resolve exactly one manifest row, compare that file's current SHA-256 with its locked value, reject role/session/connection or `supabase_admin` directives, and re-run without output the protected-source two-syntax-occurrence/one-unique-selector gate, the exact protected-source literal-occurrence count, and the current stream's expected selector-occurrence count. A one-time whole-manifest check cannot substitute for these per-stream gates. Each migration then runs as non-superuser database owner `postgres` in a single transaction.

The identity-free diagnostic runs only `20260814130000`. The successor runs the full chain. In both paths that version must produce exactly one sanitized SQLSTATE line representing `P0001`, psql's expected nonzero script-error status, and a byte-identical pre/post fingerprint. The sanitizer discards raw stderr in memory and emits no raw text. Any other line, state, count, or client status stops.

The other fifteen sources must exit zero with empty sanitized stderr. They then run a second successor pass and must again exit zero. This is technical idempotency only.

## 11. Evidence and classification

Evidence records only safe aggregates, generic client status, exact SQLSTATE token for the two approved negative paths, rollback result, hashes of non-sensitive evidence, and selected metadata. Raw restore/replay output, selector-bearing statements, selector values, database rows, environment values, and retained logs are neither evidence nor hash input.

The only permitted classification values are:

- `exact-applied`
- `semantically-applied-but-source-differs`
- `partially-applied`
- `not-applied`

The required target classification is:

| Class | Versions |
|---|---|
| `exact-applied` | `20260813172000`, `20260813220000`, `20260813234500`, `20260814070000`, `20260814102000`, `20260814160000`, `20260814170000` |
| `semantically-applied-but-source-differs` | `20260813210000`, `20260813230000`, `20260813233000`, `20260814130000` |
| `partially-applied` | none |
| `not-applied` | none |

`20260814130000` is never exact: aggregate footprints and synthetic rollback cannot prove its historical protected DML. Because four rows are not exact, the all-or-nothing gate is STOP and Task 8 is skipped with zero history-write SQL.

## 12. Error handling and retention

Every failed gate stops in place. Failure does not trigger weaker flags, a broader grant, a different image, source editing, production replay, cleanup, service restart, or a retained-lane query. The new container, volume, secret, three databases if created, and evidence remain retained. If the new container exits, it remains retained and is not restarted automatically.

Cleanup is a separate dangerous action requiring new explicit confirmation immediately before exact targets are removed. Disk pressure does not authorize deletion. This design provides no cleanup commands.

## 13. Threat model

### 13.1 Production reachability

Network mode `none`, zero ports, no production socket, no production credential, no production volume, and no repository mount prevent the replay lane from reaching production. The only production-derived payload is the sealed schema-only archive plus safe catalog/aggregate evidence.

### 13.2 Log disclosure

The retained log may already contain protected material and is quarantined without inspection. The new lane combines Docker log driver `none`, disabled statement logging, `log_min_error_statement=panic`, terse errors, a bounded tmpfs sanitizer, and sanitized SQLSTATE-only evidence.

### 13.3 Privilege and resource escape

The container is non-privileged, has no Docker socket, devices, host PID/IPC, host networking, added capabilities, or unrelated mounts. CPU, memory/swap, and PID limits are exact. Restart is disabled and auto-remove is false.

### 13.4 Semantic false confidence

Lane evidence stays separate from historical classification. Protected one-time DML and superseded intermediate states cannot be inferred from terminal equivalence. Four mandatory semantic-difference rows keep the gate stopped.

### 13.5 Evidence substitution

Task 10 creates one root-owned execution package containing `plan.md`, `design.md`, exact-schema `COMMIT.tsv`, exact-schema `REVIEW.tsv`, and a single reusable `VERIFY.sh`; all five are covered by `SHA256SUMS`, which excludes itself. The approval schema has exactly ten known two-field records. The commit schema has exactly twelve known two-field records and binds the approval snapshot hash, authorized predecessor, reviewed package/manifest, unrelated count/hash, HEAD/tree/parent/parent-count, and both committed blobs. Any duplicate, conflict, malformed line, missing key, or extra key fails.

The full helper validates the pointer, package, every payload and candidate-review file as root-owned regular non-symlink objects with exact 0600/0700 modes; validates exact manifest filename and hash schemas; verifies APPROVED v5 scope, zero Critical/Important findings, and true Task-5 authorization; and byte-compares reviewed candidates, package payloads, canonical files, and committed blobs. It requires an empty index, canonical paths clean against HEAD, a non-merge commit whose direct parent is the exact authorized predecessor, an exact two-path `diff-tree`, and the exact unrelated-worktree stream count/hash captured once.

Task 5 invokes that one helper from the authenticated package before creating anything and invokes the unchanged helper again immediately before `TASK5.COMPLETE` and its pointer. Task 10 snapshots and manifest-seals approval values, cross-binds them into `COMMIT.tsv`, invokes the same helper after packaging, and invokes it again immediately before atomic `HANDOFF.current` publication. No later step trusts a replaced external approval or an unsealed `REVIEW.tsv`.

## 14. Production and application preservation

Pre/post gates compare production history (`9` total and `0` target rows), safe protected aggregates, thirteen terminal function/grant fingerprints, database readiness, service active state/restart count, nginx validation, HTTP login/session behavior, Git HEAD/tree/index/dirty fingerprint, systemd unit hash, process start identity, executable hash, `.next/BUILD_ID`, `.next` filesystem identity, listening-socket topology, and Docker service-name/image topology.

Provider/model, CLIProxyAPI, and `9router` are explicit no-mutation surfaces. Evidence records false authorization and zero mutation counts, then requires unchanged unit/build/process/routing topology. It never reads or hashes `/proc/*/environ`, provider secrets, tokens, or environment-file contents.

The new lane is also compared exactly post-run: image ID, log driver, privilege, network, ports, CPU, memory/swap, PID limit, restart/auto-remove, mounts, tmpfs, volume existence, secret ownership/mode without reading it, running/retained state, and all three database identities.

## 15. Testing strategy

RED evidence consists of the sealed shared-cluster restore failures, the historical protected-migration stop, and the independent-review finding that the retained Docker log cannot be treated as safe evidence. These tests are not repeated.

GREEN requires all full immutable-package/schema, exact role-manifest, image, isolation, logging, restore, normalization, clone, selector-containment, exact-`P0001`, rollback, replay, idempotency, classification, production-preservation, application-preservation, and retention gates to pass. Green infrastructure never changes the STOP classification.

## 16. Exact success criteria

1. The same sealed full handoff validator passes before any runtime object, before Task-5 completion, after package construction, and immediately before atomic publication.
2. Retained resources receive metadata inspection only; their log and runtime are untouched.
3. The new lane exactly matches the pinned image and all isolation, logging, security, resource, mount, secret, and retention requirements.
4. Fresh template restore/normalization and both clones pass exact fidelity and zero-row gates; the exact role attributes, connection limits, password-null states, memberships, forbidden-role absence, and postgres non-superuser ownership reverify before seal and replay.
5. Selector parsing proves two occurrences and one unique value without emitting it; only the successor receives a minimal shell.
6. Both negative paths return sanitized `P0001`, expected nonzero status, and byte-identical rollback fingerprints.
7. The other fifteen migrations succeed twice, and terminal function/grant/data aggregates match.
8. Exactly seven target rows are `exact-applied` and four are `semantically-applied-but-source-differs`; the gate remains STOP.
9. Task 8 contains and executes zero history-write SQL.
10. Production, Git, provider/model, CLIProxyAPI, `9router`, services, nginx, routing, HTTP behavior, and active build remain unchanged.
11. New and quarantined resources remain retained; evidence and manifests verify.

## 17. Review package versus execution package

A candidate review package may contain uncommitted plan/design bytes for primary review, but it is never execution authority and never updates `HANDOFF.current`. Its approval record must be a root-owned regular mode-0600 file with exactly the ten-key v5 schema, binding the package path and manifest hash, exact authorized predecessor, zero open Critical/Important findings, explicit Task-5 authorization, and the unrelated-worktree fingerprint.

After approval, Task 10 accepts only a non-merge documentation commit whose sole parent is the authorized predecessor, whose `diff-tree` contains exactly the canonical plan/design paths, whose blobs equal both reviewed candidates and clean canonical files, and whose index/unrelated fingerprint remain exact. Task 10 snapshots approval into a different root-only execution package, rebinds constants from that immutable snapshot, and records every value in the exact twelve-key COMMIT schema. The package's manifest covers plan, design, COMMIT, REVIEW, and the reusable full validator, but not itself.

The same validator authenticates exact schemas, modes, regular-file/no-symlink properties, manifest rows, reviewed-package identity, canonical and committed bytes, commit topology, and unrelated state. It runs after packaging, immediately before pointer publication, before Task 5 creates anything, and immediately before Task-5 completion. This removes duplicate-ambiguity and approval-replacement trust while avoiding a self-hash cycle.

## 18. Sequential execution boundary

No parallel worker or agent may create or mutate containers, volumes, databases, roles, fixtures, evidence, or history. Tasks 5–9 execute sequentially on `vps-aylaspa` through the Aylaspa-only operator after the package gate passes. A failed gate leaves the task stopped and retained.

## 19. Current documentation-only stop

At this v5 review boundary, no Task 5 command is executed. The retained container, log, volume, databases, and secret are untouched; no new lane exists; production/services/nginx/application are unchanged; no source is staged or committed; and `HANDOFF.current` is not updated.

The current turn may only patch the two canonical documents, perform static and live read-only validation, and create a root-only candidate review package. Primary approval and an exact documentation commit must occur before the execution package is built and atomically published. Task 5 must then verify that committed package before creating its evidence directory, secret, volume, container, or databases.
