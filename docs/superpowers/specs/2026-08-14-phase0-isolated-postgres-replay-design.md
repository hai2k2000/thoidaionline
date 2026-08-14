# THỜI ĐẠI WORK Phase 0: Isolated PostgreSQL Replay Design

**Status:** Approved architecture with measured Task-4 restore/TDD addendum; documentation review draft, not an implementation plan.

**Decision:** Run Phase-0 schema restoration and migration replay inside one uniquely named, retained, network-isolated PostgreSQL 17 container backed by one uniquely named retained volume. Preserve the exact archive restore, then apply one guarded isolated-only public-schema ACL normalization before fidelity checks. Production remains read-only throughout this design.

**Design authority:** The user selected this option after three shared-cluster restore approaches produced measured fidelity or authentication failures, then approved the single normalization only after a rollback-only TDD transaction proved that it closes the one measured ACL gap without changing any other fidelity metric. Execution remains sequential through the existing Aylaspa agent only.

## 1. Purpose

The design provides a faithful PostgreSQL environment for evaluating the exact sixteen-file migration chain without sharing production cluster roles, authentication, databases, networking, or storage. It must reproduce the production database's relevant version, encoding, locale, owners, default ACLs, explicit ACLs, effective privileges, extensions, and application schema before any synthetic fixture or migration runs.

The isolated environment is evidence infrastructure. A successful isolated replay does not by itself prove that protected one-time production DML ran historically, and it never authorizes a migration-history write. The all-exact classification gate remains controlling.

## 2. Observed baseline

### 2.1 Pinned local image

The required image already exists locally; implementation must not pull or substitute an image.

| Field | Observed value |
|---|---|
| Reference | `postgres@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d` |
| Image ID | `sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d` |
| PostgreSQL | `17.10-1.pgdg13+1` |
| Architecture | `linux/amd64` |
| `docker image inspect .Size` | 161,234,888 bytes |
| `docker image ls` displayed size | 640 MB |
| `docker system df -v` image usage | size 640 MB; shared size 0 B; unique size 640.1 MB; containers 0 |

The byte count and the human-readable size/usage values are distinct metrics reported by this Docker daemon. Evidence must name the reporting surface and field rather than treating `161234888` bytes and `640 MB` as conversions of the same measurement. Image verification reads only the approved ID, RepoDigest count/match, OS, architecture, and `.Size` fields; it never dumps image Config, Env, or history.

The image patch version is newer than production, but the major version is identical. The PostgreSQL 17.6 custom archive has already been listed successfully by PostgreSQL 17 tooling. Exact restore fidelity remains a runtime gate rather than an assumption.

### 2.2 Production compatibility metadata

| Field | Production value |
|---|---|
| PostgreSQL | 17.6 (`170006`) |
| Encoding | UTF8 |
| Locale provider | ICU |
| ICU locale | `en-US` |
| Collation / character type | `en_US.UTF-8` / `en_US.UTF-8` |
| Data checksums | off |
| Database owner | `postgres` |

Installed production extensions are `pg_graphql 1.5.11`, `pg_net 0.20.0`, `pg_stat_statements 1.11`, `pgcrypto 1.3`, `plpgsql 1.0`, `supabase_vault 0.3.1`, and `uuid-ossp 1.1`. The scoped archive contains no extension objects. The locked migration chain uses PostgreSQL/pgcrypto functionality; implementation must prove every referenced extension control file is available in the pinned image before cluster creation and stop if any dependency is unavailable. It must not silently omit, replace, or download an extension.

### 2.3 Archive role dependencies

The schema archive references exactly these roles:

| Role | Required isolated attributes |
|---|---|
| `postgres` | production-equivalent non-superuser; inherit, create-role, create-database, login, replication, and bypass-RLS enabled |
| `supabase_admin` | isolated-cluster superuser with the audited production attributes |
| `anon` | non-login, inheriting, non-superuser |
| `authenticated` | non-login, inheriting, non-superuser |
| `service_role` | non-login, inheriting, bypass-RLS, non-superuser |
| `pg_database_owner` | PostgreSQL built-in role; never recreated |

The production database also contains Supabase service roles outside the archive scope. They must not be recreated unless a fresh dependency scan proves that the scoped archive or locked sources reference them.

### 2.4 Sealed evidence

Evidence root: `/opt/thoidai-reconciliation/phase0-20260814T135943Z`, mode 0700. At design time it contains 44 files, all mode 0600.

| Artifact | SHA-256 | Other evidence |
|---|---|---|
| Full production dump | `8081b82535a7c0b513db5708f31a9eeaea58e312a62278500d56448b5766bc91` | 434,959 bytes; archive listing validated |
| Public/history schema dump | `674fa9610e9de26afe3716efe4554db9706247c0930dda3e90fd90ec26bb117b` | 119,739 bytes; schema-only |
| Sixteen-source manifest | `ca2ce5704909e0fd09712aecb9da5e04df56b30ddca1e8ab028d2a381f277612` | 16/16 source hashes verified |
| Pre-change checksum index | `f80bb7fe134026525db3f33f2277e99dc841ae5b072c697012cbb114f9ceb86f` | 7/7 entries verified |
| Production-evidence index | `a105f21de544cebc655207d1c9e0c4f9a733991d9d2120cea6d6e09ec292b490` | 3/3 entries verified |
| No-privileges test index | `bd9b9d6775032fb1012b5599b709a0005b1c4dd3b1fe4239cb5a5743739c8d41` | retained failure evidence |
| Filtered-TOC test index | `6ebad7f21fc4d89aae59365613d02a924ad9967dd1a3d27e119006c658266572` | retained failure evidence |

Three disposable databases from earlier shared-cluster tests remain retained. This design never deletes, reuses, or mutates them.

### 2.5 Host and Docker headroom

Observed at design time: 4 vCPU, 7,937 MiB RAM with 3,289 MiB available, approximately 20,096 MiB filesystem headroom, load below 1.0, 32 running containers, zero unhealthy containers, and the built-in Docker `none` network present. Docker currently uses about 8.0 GB for images and 0.94 GB for local volumes.

The repository contains no tracked Dockerfile or Compose manifest. Production uses externally managed Docker conventions, a Supabase bridge network, an `unless-stopped` restart policy, and named volumes. The isolated replay therefore remains a one-off evidence component and is not added to application Compose configuration.

### 2.6 Measured PostgreSQL-17 archive normalization

The sealed schema archive was produced by PostgreSQL `pg_dump 17.6` in custom dump format `1.16-0` and inspected offline with PostgreSQL `pg_restore 17.10`. Its single public-schema ACL TOC item emits four public-schema `GRANT` commands, zero `REVOKE` commands, zero grants to the `PUBLIC` pseudo-role, and zero semantic `GRANT USAGE ON SCHEMA public TO PUBLIC` commands. The archive still creates the public schema once.

An exact owner-and-privilege restore therefore produced six exploded public-schema ACL rows and zero explicit PUBLIC-USAGE rows, while production has seven and one. The untouched PostgreSQL-17 bootstrap database also has the PUBLIC-USAGE row. Owner, default ACL, table ACL, function ACL, and effective-privilege evidence otherwise matched production.

A rollback-only TDD transaction, executed as the isolated non-superuser database owner `postgres`, added exactly the missing PUBLIC-USAGE grant. Inside that transaction all seven fidelity aggregates became exact: default ACL `6/3/3`, schema ACL `7`, table ACL `653`, function ACL `46`, effective table privileges `571/588`, effective function privileges `40/56`, and effective schema privileges `5/8`. Rollback restored schema ACL `6` and PUBLIC-USAGE `0`; production remained `7/1`. The sanitized mode-0600 debug evidence has SHA-256 `9b784790cfbb06c6d641c2efdf3650d9d147e708dcc5128d6d7b6f542a62bb6c`.

## 3. Goals

1. Restore the sealed schema archive with ownership and privileges enabled, then apply the one measured, guarded isolated-only PUBLIC-USAGE normalization required to reproduce production ACL semantics.
2. Replay the exact locked chronological chain only against zero-production-row synthetic state.
3. Execute migrations as a role matching production `postgres`, not as the isolated bootstrap superuser.
4. Produce root-only, hash-addressed evidence without printing SQL bodies, identities, secrets, or raw error output.
5. Leave production database, history, application, source, configuration, routing, services, and retained evidence unchanged.
6. Retain the isolated container and volume on both success and failure until cleanup receives immediate explicit confirmation.

## 4. Non-goals

- No production migration replay or rehearsal.
- No production migration-history write.
- No production rows in the isolated cluster.
- No provider/model, CLIProxyAPI, `9router`, password-reset, or session behavior change.
- No application build, deployment, source edit, service restart, firewall change, image pull, or repository Docker integration.
- No automatic cleanup, database drop, volume removal, container removal, or deletion of prior evidence.
- No claim that disposable replay proves protected historical identity-based DML.

## 5. Alternatives and measured rejection reasons

### 5.1 Shared production cluster with `--no-privileges`

Rejected. Restore exited successfully and core schema counts matched, but all explicit schema/table/function ACL entries were omitted. Effective table privileges changed from `571/588` to `147/588`, function EXECUTE changed from `40/56` to `56/56`, and schema privileges changed from `5/8` to `2/8`. This is both under-permissive and over-permissive relative to production.

### 5.2 Direct local-socket restore as `supabase_admin`

Rejected. The non-interactive local-socket connection gate returned false and required authentication. The design never reads, injects, or exposes a production credential to bypass that boundary.

### 5.3 Shared cluster with a filtered TOC

Rejected. Removing exactly the three failing `supabase_admin` default-ACL entries produced a zero-exit restore and preserved relation/function owners, table ACLs, function ACLs, and effective privileges. It still changed the public schema owner and reduced explicit public-schema ACL entries from seven to five. The only allowed divergence was the three omitted default ACLs, so this approach failed its semantic gate.

### 5.4 Approved isolated PostgreSQL cluster

Selected. A private cluster can bootstrap every archive role, use a disposable isolated superuser to restore exact ownership and archive ACLs, apply the single measured PUBLIC-USAGE normalization as production-equivalent non-superuser database owner `postgres`, and then run migrations as that role. It removes dependence on production host-based authentication and shared cluster roles while preserving database semantics.

## 6. Architecture

### 6.1 Components

1. **Sequential Aylaspa operator** — the existing custom VPS agent performs all preflight, lifecycle, restore, replay, verification, and retention steps sequentially.
2. **Root-only evidence directory** — a new mode-0700 subdirectory under the sealed evidence root contains names, image metadata, password file, status records, hashes, and aggregate fingerprints. Every file is mode 0600.
3. **Pinned PostgreSQL container** — one uniquely named retained container based only on the observed digest. It has `--network none`, no published ports, no host PID/IPC namespace, no Docker socket, no device access, and no privileged mode.
4. **Named data volume** — one uniquely named retained Docker volume stores only the isolated PostgreSQL data directory.
5. **Disposable bootstrap superuser** — a uniquely named isolated-only initial superuser initializes the cluster and restores ownership/ACL metadata. It never becomes an archive object owner and is never used for migration replay.
6. **Production-equivalent replay role** — isolated role `postgres` mirrors the audited production attributes and owns the isolated target database. Every locked migration runs as this role.
7. **Restore fidelity verifier** — compares isolated metadata with sealed production fingerprints before fixtures or replay.
8. **Guarded ACL normalizer** — verifies the archive, production, replay-precondition, and retained TDD counts; then, as non-superuser database owner `postgres`, commits only `GRANT USAGE ON SCHEMA public TO PUBLIC` inside one guarded isolated transaction.
9. **Replay evidence runner** — streams each checksum-verified source into isolated `psql`, hashes combined output, records exit status, and never persists migration bodies in the container or volume.
10. **Classification gate** — consumes sealed production evidence plus isolated replay evidence and emits the all-or-nothing STOP/EXACT decision without writing production history.

### 6.2 Naming and retention

The container, named volume, database, and evidence subdirectory use one shared run identifier composed of a UTC timestamp and random suffix. Names must be unique, length-bounded, and validated before creation. They are recorded before any restore begins.

The container and volume are retained on success and failure. A stopped container remains stopped but present; the volume remains attached or independently retained. No lifecycle action removes earlier disposable databases or their evidence.

### 6.3 Network and port isolation

The container uses Docker's built-in `none` network. It publishes zero ports and joins no bridge, host, Supabase, application, or user-created network. All database interaction occurs through local `docker exec` processes and the container's Unix socket.

Network isolation is a mandatory runtime assertion after creation and before every restore/replay phase. Any network attachment or published port is a hard stop.

### 6.4 Resource controls

The isolated container ceiling is exactly 1 vCPU, 1 GiB RAM, and 256 PIDs. Creation is allowed only while host available RAM is at least 2 GiB, free filesystem space is at least 5 GiB, one-minute load is below 4.0, production services are healthy, and Docker reports zero unhealthy containers.

Crossing a limit stops replay and retains evidence. The design does not restart or throttle production services to make room.

## 7. Secret handling

A cryptographically strong random password is generated locally for the disposable bootstrap superuser. The value is written directly to a root-only mode-0600 file and never appears in stdout, command arguments, Docker labels, status files, Git, or the final report.

The password reaches the official image only through a read-only secret-file mount and the image's password-file interface. Container configuration records the secret path, not the secret. No production credential, `.env` file, database password, API token, SSH material, or authentication file is read or copied.

Archive roles receive no usable password. Restore and replay processes connect through the container-local Unix socket under the controlled operator; only the bootstrap role has the disposable password-file credential. The bootstrap credential is never reused outside the isolated container.

## 8. Cluster and role bootstrap

The official image initializes with a unique bootstrap role rather than `postgres`. This prevents the image's initial superuser from colliding with the production-equivalent replay role.

Bootstrap then creates the five archive-referenced roles with audited attributes. `pg_database_owner` remains the PostgreSQL built-in role. The isolated target database is owned by the newly created production-equivalent `postgres` role and uses UTF8, ICU `en-US`, and the audited collation/character-type settings. Patch-version differences are accepted only if every metadata fidelity gate passes.

The bootstrap superuser performs the exact archive restore with ownership and privileges enabled. It does not use `--no-owner`, `--no-privileges`, a filtered TOC, or a production role credential. After restore, the isolated non-superuser database owner `postgres` performs the separately evidenced PUBLIC-USAGE normalization and every later replay connection uses that same role.

Role bootstrap evidence records names, boolean attributes, memberships, and counts only. It never records passwords or role secrets.

## 9. Extension compatibility

Before cluster creation, implementation inventories extension references in both the sealed archive and the sixteen locked sources without printing bodies. It compares required controls against the pinned image.

The isolated cluster creates only required extensions in the same schemas as production. `plpgsql` is built in; `pgcrypto` is expected in `extensions`. Non-required Supabase extensions are not emulated. If a scoped object or migration requires an unavailable extension, the run stops before restore. Image substitution or package download is forbidden.

## 10. Schema restore and fidelity gates

The sealed custom schema archive is streamed from the host into PostgreSQL 17 restore tooling. It is never copied into the data volume. Restore output is reduced to a SHA-256 and exit status; raw SQL and error bodies are not printed.

Restore must exit zero with no ignored errors. Before fixtures, the isolated database must have zero `staff_users` rows and zero migration-history rows.

PostgreSQL 17.6 archive generation normalizes the built-in public schema's default PUBLIC-USAGE privilege out of this archive even though the archive recreates that schema after the verified-empty template schema is dropped. This is a measured archive-semantic exception, not permission to weaken restore flags or alter production. Exact archive bytes alone therefore do not satisfy ACL fidelity.

Immediately after restore and before the fidelity gate, implementation must verify aggregate-only evidence for all of the following: the archive contains zero semantic PUBLIC-USAGE grants; production has schema ACL `7` and PUBLIC-USAGE `1`; the isolated replay has schema ACL `6` and PUBLIC-USAGE `0`; and the retained rollback-only TDD evidence has the approved SHA-256 and `PASS` status. Only then may non-superuser database owner `postgres` execute one isolated transaction with an internal `6/0` pre-guard, exactly `GRANT USAGE ON SCHEMA public TO PUBLIC`, an internal `7/1` post-guard, and commit. Any mismatch or SQL error stops before the grant commits or before fidelity begins. Raw transaction output is hashed, post-normalization aggregate evidence is mode 0600, and production is re-read only to prove it remains `7/1`.

The exception reproduces the one production ACL semantic that the archive omitted. It does not modify production, add privileges beyond production, weaken the restore, or support a claim that archive-byte fidelity alone is sufficient.

The following production values must match exactly:

| Gate | Required value |
|---|---|
| Public tables | 21 |
| Public indexes | 53 |
| Public constraints | 96 |
| Public user triggers | 5 |
| Public policies | 39 |
| Public functions | 14 |
| Public default ACLs | 6 total: 3 `postgres`, 3 `supabase_admin` |
| Explicit schema ACL entries | 7 |
| Explicit table ACL entries | 653 |
| Explicit function ACL entries | 46 |
| Effective table privileges | 571 of 588 |
| Effective function EXECUTE | 40 of 56 |
| Effective schema privileges | 5 of 8 |

Owner-distribution files for schemas, relations, and functions must be byte-identical to sealed production equivalents. The public schema must retain `pg_database_owner`; public relations and functions must retain their audited owners. Any mismatch stops the run before fixtures.

## 11. Synthetic state

After a green restore, the runner adds only the six synthetic application role/permission fixtures already defined by the committed Phase-0 plan. Synthetic identifiers are reserved and non-production. No staff, identity, email, password, password hash, reset token, task, audit, or production row is inserted.

The zero-row baseline and post-fixture aggregate counts are sealed before replay. The targeted list-order migration must fail safely on identity-free fixtures; no production identity is guessed or recreated.

## 12. Locked chronological replay

The runner verifies the source manifest immediately before every replay phase and processes exactly this order:

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

Every source is streamed through one single-transaction invocation as the isolated production-equivalent `postgres` role. No migration changes current role, session authorization, connection, or owner to `supabase_admin`; implementation must verify these source-scan counts before replay without printing source bodies.

Only `20260814130000` may return nonzero, and its transaction must roll back cleanly. Every other nonzero status is an immediate stop. Output is stored only as status plus SHA-256.

The fifteen safe migrations then run a second pass to prove technical idempotency. Idempotency never upgrades a protected historical-DML classification by itself.

## 13. Evidence flow

1. Verify image digest, host resources, Docker health, production health, Git fingerprint, sealed dump hashes, and all sixteen source hashes.
2. Create the root-only run directory, password file, unique names, and hash-sealed preflight manifest.
3. Create the named volume and network-none container with explicit resource limits and no production mounts.
4. Initialize the cluster, roles, database, locale, and required extensions.
5. Stream the sealed schema archive and record only hashed output/status.
6. Verify archive/production/replay/TDD normalization guards, commit the one isolated PUBLIC-USAGE grant as non-superuser `postgres`, hash its output/status, and prove production remains unchanged.
7. Capture owner, ACL, privilege, schema, function, and zero-row fingerprints; compare with production.
8. Seed synthetic fixtures and seal aggregate counts.
9. Stream the exact sixteen-file replay and record per-version status/output hash.
10. Prove the expected targeted rollback, terminal TBT state, terminal function hashes, and fifteen-file idempotency pass.
11. Re-read production history and protected aggregates read-only; compare with pre-change evidence.
12. Generate classifications and the all-or-nothing gate. Stop before history writes unless all eleven versions are exact-applied under the committed taxonomy.
13. Seal all evidence and retain the isolated container and volume.

No step streams data from production tables into the isolated cluster. The only production-derived payload is the sealed schema-only archive and aggregate/catalog evidence.

## 14. Error handling

- A missing pinned image, image digest mismatch, incompatible architecture, or missing required extension stops before container creation.
- Insufficient resource headroom or unhealthy production service stops before container creation.
- Any unexpected network, port, mount, privilege, role, locale, owner, ACL, or schema mismatch stops before fixtures.
- Any archive semantic count, production ACL count, replay precondition, retained TDD hash/status, transaction pre-guard, transaction post-guard, or production-preservation mismatch stops before the normalization grant or before fidelity. Transaction failure rolls back and is never retried with a broader grant or stronger role.
- Any fixture identity collision or nonzero production-row count stops before replay.
- Any replay failure other than `20260814130000` stops immediately.
- Any rollback leak, idempotency failure, function-hash drift, permission drift, or Git/production invariant change stops immediately.
- Raw restore/replay output is hashed; only non-sensitive status metadata is reported.
- Failure never triggers an automatic retry with weaker flags, a different role, a different image, or a filtered archive.
- Failure retains the container, volume, password file, and evidence for review.

## 15. Threat model

### 15.1 Production reachability

Threat: disposable SQL reaches production or another VPS service.

Controls: Docker `none`, zero published ports, no host/Supabase network, no production database volume, no production socket, no host database credential, and sequential operator checks. The container receives only streamed schema/source bytes through local process stdin.

### 15.2 Credential exposure

Threat: the disposable password appears in process arguments, Docker inspection, logs, Git, or reports.

Controls: strong random secret file, mode 0600, read-only secret-file mount, password-file interface, output hashing, root-only evidence directory, and no production credentials.

### 15.3 Container privilege and persistence

Threat: the isolated service accesses host devices, Docker control plane, unrelated files, or unlimited resources.

Controls: no privileged mode, no Docker socket, no devices, no host PID/IPC, no repository mount, one named data volume, one read-only password-file mount, CPU/RAM/PID limits, and a pinned image digest.

### 15.4 Evidence tampering

Threat: sources, dumps, output, or classifications change between phases.

Controls: immutable SHA-256 manifests, pre/post verification at every boundary, root-only modes, exact source ordering, Git HEAD/tree/status fingerprints, and sealed per-phase evidence indexes.

### 15.5 Semantic false confidence

Threat: a green disposable replay is treated as proof of historical protected DML.

Controls: version-by-version classification taxonomy, explicit one-time-DML limitations, preserved trusted apply manifests, and the all-exact gate. Disposable success is necessary evidence, never sufficient authorization.

## 16. Rollback and cleanup

The design makes no production change, so normal rollback is to stop and retain evidence. The verified full production dump remains recovery evidence but is never restored by this design.

Container, volume, password file, schema archive, and replay evidence are never removed automatically. Cleanup is a separate dangerous action requiring explicit confirmation immediately before the exact container, volume, password file, or retained database is removed. Cleanup must first verify evidence hashes and record the exact approved targets.

## 17. Testing strategy

### 17.1 RED evidence

The design carries forward three measured architecture failures rather than repeating them:

- Exact shared-cluster restore: three `supabase_admin` default-ACL permission failures.
- `--no-privileges`: core schema green but ACL/effective-privilege fidelity failed materially.
- Filtered TOC: restore green but schema owner and explicit schema ACL fidelity failed.

Direct `supabase_admin` socket use is a separately rejected authentication path: its non-interactive gate was false without credentials. The isolated design must restore all ownership and ACL evidence exactly without production authentication or privilege weakening.

The retained exact isolated restore is an additional focused RED: schema ACL `6` and PUBLIC-USAGE `0` versus production `7/1`, with the other six ACL/effective-privilege aggregates exact. Offline archive inspection independently proves the archive contains zero semantic PUBLIC-USAGE grant.

### 17.2 GREEN criteria

The rollback-only normalization TDD test is green only when one isolated PUBLIC-USAGE grant changes schema ACL `6→7` and PUBLIC-USAGE `0→1`, all six other fidelity aggregates remain exact, rollback restores `6/0`, and production remains `7/1`.

The isolated restore-plus-normalization path is green only if image, resource, network, secret, role, locale, extension, normalization guards, zero-row, core schema, owner, default ACL, explicit ACL, and effective-privilege gates all pass exactly.

Replay is green only if fifteen versions exit zero, `20260814130000` alone fails and rolls back cleanly, fifteen safe migrations pass idempotency, two synthetic TBT rows reach the exact terminal state, and thirteen terminal function fingerprints match.

Production preservation is green only if history counts, protected aggregate bytes, function/grant fingerprints, HEAD, tree, index, dirty count/hash, restart count, nginx, Docker, database readiness, and HTTP behavior remain unchanged.

### 17.3 No automatic promotion

Green infrastructure and replay tests do not change classification rows automatically. The classification task must explicitly evaluate each version. Any non-exact row writes `STOP`; production history remains unchanged.

## 18. Exact success criteria

The isolated Phase-0 evidence batch succeeds only when all of the following are true:

1. The local image digest exactly matches the approved digest; no pull occurs.
2. The container is unique, retained, network-none, portless, non-privileged, resource-limited, and backed by one unique named volume.
3. The password exists only in a root-only file and is absent from reported/container configuration values.
4. PostgreSQL major, encoding, locale provider, locale, database owner, and required extensions match the design.
5. Archive roles and attributes match the audited production metadata.
6. Restore exits zero; the guarded isolated-only PUBLIC-USAGE normalization proves archive `0`, production `7/1`, replay pre `6/0`, replay post `7/1`, and retained TDD `PASS`; then core counts, owner distribution, default ACLs, explicit ACLs, and effective privileges match exactly.
7. Production-row counts in the isolated database remain zero; only approved synthetic fixtures exist.
8. All sixteen source hashes verify immediately before replay.
9. Replay results are fifteen zero exits plus the single expected `20260814130000` rollback.
10. All fifteen safe migrations pass the second idempotency run.
11. Terminal TBT and function-hash evidence matches the exact chronological source chain.
12. Production history and protected aggregates remain unchanged.
13. Git HEAD/tree/index/dirty fingerprint, provider/model, CLIProxyAPI, `9router`, password-reset/session behavior, services, and active build remain unchanged.
14. Evidence modes/hashes verify and the container/volume remain retained.
15. The history-write path remains unreachable unless all eleven classifications become exact-applied.

## 19. Execution and review boundary

This document is a design, not permission to execute the new persistent normalization. It contains no full lifecycle commands. The separately reviewed implementation plan incorporates the measured Task-4 exception while preserving the security/classification gates and keeping production read-only.

Implementation must remain inline and sequential through the existing Aylaspa custom agent. No parallel worker may create containers, volumes, roles, restore schemas, replay migrations, classify versions, or write history.

The design draft remains uncommitted until primary review explicitly approves it.
