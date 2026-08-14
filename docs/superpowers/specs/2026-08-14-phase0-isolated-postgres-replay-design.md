# THỜI ĐẠI WORK Phase 0: Isolated PostgreSQL Replay Design

**Status:** Approved corrected architecture after the measured Task-5 protected-selector stop; design-only authority, not an implementation plan or runtime authorization.

**Decision:** Keep the halted identity-free database as immutable failure/rollback evidence inside the existing retained, network-isolated PostgreSQL 17 container and volume. In that same cluster, create and fidelity-seal one fresh normalized template database from the locked schema archive, then create one successor database from that pre-fixture template. The halted original lane proves the identity-free `20260814130000` rollback; the successor lane holds one non-production protected-selector shell and runs the complete chronological chain; the fresh template remains an inert retained clone source. Production remains read-only throughout this design.

**Design authority:** The user selected the isolated-container option after three shared-cluster restore approaches produced measured fidelity or authentication failures, approved the single normalization after rollback-only TDD, and approved this recommended same-container successor correction after Task 5 stopped safely at `20260813210000`. Execution remains sequential through the existing Aylaspa agent only.

## 1. Purpose

The design provides two evidence lanes plus one inert normalized template database in the existing isolated PostgreSQL cluster for evaluating the exact sixteen-file migration chain without sharing production cluster roles, authentication, networking, or storage. The fresh template and successor must reproduce the production database's relevant version, encoding, locale, owners, default ACLs, explicit ACLs, effective privileges, extensions, and application schema before any successor fixture or migration runs.

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

### 2.7 Measured Task-5 stop and successor feasibility

Task 5 seeded exactly six synthetic roles and six matching permission rows, with zero staff, departments, tasks, audit rows, or migration-history rows. The first four migrations returned zero. `20260813210000` then returned `3` from `psql` with SQLSTATE `P0001`: its guarded exact-one protected-account selector found zero rows. The single-transaction invocation rolled back, source and manifest hashes remained exact, and no later replay, idempotency, classification, history, retry, or cleanup step ran.

The failure is a design contradiction, not source drift. The identity-free fixture rule deliberately forbids the one selector-bearing shell required by `20260813210000`, while the replay gate requires that migration to return zero. Treating it like the deliberately failing `20260814130000` migration is invalid because `20260814160000` and `20260814170000` consume password-reset objects established by `20260813210000`, and the fifteen-file idempotency gate includes it.

Fresh read-only catalog checks prove that a same-container database clone is technically sound: the retained PostgreSQL-17 container remains network-none and portless; the replay owner is non-superuser `postgres` with `CREATEDB`; the database is owned by `postgres`, allows connections, is not a template, has no other active connection, and is approximately 9.23 MB. The host and volume filesystem each have 20,450,512 KiB free at 76% use. These observations authorize only this design correction; they do not authorize cloning or replay.

The current failed database is retained evidence and is not a pre-Task-5 template: fixtures and four successful replay transactions already exist. Fresh catalog inspection found no second application database holding the clean checkpoint. The corrected recovery therefore creates a separately named fresh database from `template0` inside the same retained cluster, restores the sealed archive, applies the already approved isolated-only normalization, and seals the full pre-fixture fidelity matrix. Only that inert database may become the successor's `CREATE DATABASE ... TEMPLATE` source. All three database identities are retained; no current database is rewound, deleted, renamed, or reused as an implicit template.

## 3. Goals

1. Restore the sealed schema archive with ownership and privileges enabled, then apply the one measured, guarded isolated-only PUBLIC-USAGE normalization required to reproduce production ACL semantics.
2. Preserve the halted identity-free original for the targeted list-order rollback, reconstruct one fresh normalized same-container template from sealed inputs, and clone one successor for the complete chronological replay.
3. Execute migrations as a role matching production `postgres`, not as the isolated bootstrap superuser.
4. Produce root-only, hash-addressed evidence without printing SQL bodies, identities, secrets, or raw error output.
5. Leave production database, history, application, source, configuration, routing, services, and retained evidence unchanged.
6. Retain the halted original, fresh template, successor, isolated container, and volume on both success and failure until cleanup receives immediate explicit confirmation.

## 4. Non-goals

- No production migration replay or rehearsal.
- No production migration-history write.
- No production rows in the isolated cluster.
- No claim that the selector-bearing shell is a real employee or that source-written protected values are production copies.
- No provider/model, CLIProxyAPI, `9router`, password-reset, or session behavior change.
- No application build, deployment, source edit, service restart, firewall change, image pull, or repository Docker integration.
- No automatic cleanup, database drop, volume removal, container removal, or deletion of any of the three database identities or prior evidence.
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
2. **Root-only recovery evidence directory** — a new mode-0700 subdirectory under the sealed evidence root contains the two new database names, retained-resource references, status records, hashes, and aggregate fingerprints. Every file is mode 0600. The existing password file remains in its original root-only run directory and is never copied.
3. **Pinned PostgreSQL container** — one uniquely named retained container based only on the observed digest. It has `--network none`, no published ports, no host PID/IPC namespace, no Docker socket, no device access, and no privileged mode.
4. **Named data volume** — one uniquely named retained Docker volume stores only the isolated PostgreSQL data directory.
5. **Disposable bootstrap superuser** — a uniquely named isolated-only initial superuser initializes the cluster and restores ownership/ACL metadata. It never becomes an archive object owner and is never used for migration replay.
6. **Production-equivalent replay role** — isolated role `postgres` mirrors the audited production attributes and owns the halted original, fresh template, and successor. Every locked migration runs as this role.
7. **Halted original identity-free database** — the retained Task-5 database remains the zero-staff evidence lane with its six approved role/permission fixtures and four successful migrations. It supplies only the isolated rollback-only `20260814130000` test and never acquires the protected selector.
8. **Fresh normalized template database** — one uniquely named database is created from `template0`, restored from the sealed archive, normalized, fidelity-sealed, and retained without fixtures or replay. It is never a replay lane and is the only allowed successor clone source.
9. **Successor replay database** — one separately unique and unpredictable database is cloned inside the same cluster from the fresh sealed template before fixture or replay state. It is the only lane that receives the protected-selector shell and the complete chronological replay.
10. **Restore and clone fidelity verifier** — compares the fresh normalized template with sealed production fingerprints, then proves the successor clone has the identical baseline before successor fixtures.
11. **Guarded ACL normalizer** — verifies the archive, production, template-precondition, and retained TDD counts; then, as non-superuser database owner `postgres`, commits only `GRANT USAGE ON SCHEMA public TO PUBLIC` inside one guarded fresh-template transaction before the clone boundary.
12. **Selector-safe fixture client** — one binding-capable database client reads the SHA-locked source from fd 0, validates the locked syntax occurrences as one consistent unique value, binds it directly into the successor fixture transaction, captures/sanitizes errors internally, and never writes the value or raw error fields to fd 1/2.
13. **Replay evidence runner** — streams each checksum-verified source into isolated `psql`, hashes combined output, records exit status, and never persists migration bodies in the container or volume.
14. **Classification gate** — consumes sealed production evidence plus lane-specific replay evidence and emits the all-or-nothing STOP/EXACT decision without writing production history.

### 6.2 Naming and retention

The container, named volume, halted original database, fresh template database, successor database, and evidence subdirectory use one shared run identifier composed of a UTC timestamp and cryptographically random suffix. The two new database names are separately unique, length-bounded, and restricted to a validated lowercase ASCII identifier grammar before use. Every dynamic identifier is still passed through identifier-aware quoting; string-literal quoting is never substituted for identifier quoting. Names are recorded before creation, but no protected account value is recorded with them.

The fresh template is created from `template0` through a different administrative database connection with the audited encoding/locale and owner `postgres`, then restored and normalized exactly as the original Task-4 path. The successor is created only from another administrative connection after a fresh gate proves zero active sessions on the fresh template. Each operation names its source explicitly, assigns owner `postgres`, and fails closed on any name collision. It never terminates a connection, changes `datallowconn`, marks a database as a template, or broadens the replay role.

The halted original, fresh template, successor, container, and volume are retained on success and failure. A stopped container remains stopped but present; the volume remains attached or independently retained. No lifecycle action removes any database identity, earlier disposable database, or evidence.

### 6.3 Network and port isolation

The container uses Docker's built-in `none` network. It publishes zero ports and joins no bridge, host, Supabase, application, or user-created network. All database interaction occurs through local `docker exec` processes and the container's Unix socket.

Network isolation is a mandatory runtime assertion after creation and before every restore/replay phase. Any network attachment or published port is a hard stop.

### 6.4 Resource controls

The retained isolated container ceiling remains exactly 1 vCPU, 1 GiB RAM, and 256 PIDs. Continued use and any fresh database creation are allowed only while host available RAM is at least 2 GiB, free filesystem space is at least 5 GiB, filesystem use is below 80%, one-minute load is below 4.0, production services are healthy, and Docker reports zero unhealthy containers.

Immediately before creating the fresh template, both the host Docker filesystem and the container data-volume filesystem must have at least 5 GiB free and less than 80% use. The measured halted database size must be at most 256 MiB, and the combined projected allocation for the fresh restore plus successor clone must be no more than 20% of then-free space. The same gates repeat before cloning. After each new database, both filesystems must remain below 80% use with at least 4 GiB free; each new database must remain at most 256 MiB; and combined measured allocation growth must be no greater than the larger of 256 MiB or four times the sealed fresh-template size. Any pre/post mismatch stops before the next database or fixture step; the design never deletes retained evidence to manufacture headroom.

Crossing a limit stops replay and retains evidence. The design does not restart or throttle production services to make room.

## 7. Secret handling

A cryptographically strong random password is generated locally for the disposable bootstrap superuser. The value is written directly to a root-only mode-0600 file and never appears in stdout, command arguments, Docker labels, status files, Git, or the final report.

The password reaches the official image only through a read-only secret-file mount and the image's password-file interface. Container configuration records the secret path, not the secret. No production credential, `.env` file, database password, API token, SSH material, or authentication file is read or copied.

Archive roles receive no usable password. Restore and replay processes connect through the container-local Unix socket under the controlled operator; only the bootstrap role has the disposable password-file credential. The bootstrap credential is never reused outside the isolated container.

Recovery creates no second credential. It verifies only the retained password file's existence, mode, mount destination, and absence from reported environment values; it never reads, copies, rehashes, or emits the credential value.

## 8. Cluster and role bootstrap

The official image initializes with a unique bootstrap role rather than `postgres`. This prevents the image's initial superuser from colliding with the production-equivalent replay role.

Bootstrap has already created the five archive-referenced roles with audited attributes. `pg_database_owner` remains the PostgreSQL built-in role. The halted original, fresh template, and successor are owned by the production-equivalent `postgres` role and use UTF8, ICU `en-US`, and the audited collation/character-type settings. Patch-version differences are accepted only if every metadata fidelity gate passes.

For recovery, the existing isolated bootstrap superuser performs the exact archive restore into the fresh template with ownership and privileges enabled. It does not use `--no-owner`, `--no-privileges`, a filtered TOC, or a production role credential. After restore, the isolated non-superuser database owner `postgres` performs the separately evidenced PUBLIC-USAGE normalization; the halted original is not restored or normalized again. Every later fixture/replay connection uses `postgres`.

Role bootstrap evidence records names, boolean attributes, memberships, and counts only. It never records passwords or role secrets.

## 9. Extension compatibility

Before cluster creation, implementation inventories extension references in both the sealed archive and the sixteen locked sources without printing bodies. It compares required controls against the pinned image.

The isolated cluster creates only required extensions in the same schemas as production. `plpgsql` is built in; `pgcrypto` is expected in `extensions`. Non-required Supabase extensions are not emulated. If a scoped object or migration requires an unavailable extension, the run stops before restore. Image substitution or package download is forbidden.

## 10. Schema restore and fidelity gates

The sealed custom schema archive is streamed from the host into PostgreSQL 17 restore tooling. It is never copied into the data volume. Restore output is reduced to a SHA-256 and exit status; raw SQL and error bodies are not printed.

The fresh-template restore must exit zero with no ignored errors. Before the clone boundary, that template must have zero `staff_users`, departments, fixture roles, fixture permissions, tasks, audit rows, reset rows, and migration-history rows. The halted original's existing `6/6/0` state and partial replay evidence are verified but not compared to this zero-row gate.

PostgreSQL 17.6 archive generation normalizes the built-in public schema's default PUBLIC-USAGE privilege out of this archive even though the archive recreates that schema after the verified-empty template schema is dropped. This is a measured archive-semantic exception, not permission to weaken restore flags or alter production. Exact archive bytes alone therefore do not satisfy ACL fidelity.

Immediately after restore and before the fresh-template fidelity gate, implementation must verify aggregate-only evidence for all of the following: the archive contains zero semantic PUBLIC-USAGE grants; production has schema ACL `7` and PUBLIC-USAGE `1`; the fresh template has schema ACL `6` and PUBLIC-USAGE `0`; and the retained rollback-only TDD evidence has the approved SHA-256 and `PASS` status. Only then may non-superuser database owner `postgres` execute one isolated transaction with an internal `6/0` pre-guard, exactly `GRANT USAGE ON SCHEMA public TO PUBLIC`, an internal `7/1` post-guard, and commit. Any mismatch or SQL error stops before the grant commits or before fidelity begins. Raw transaction output is hashed, post-normalization aggregate evidence is mode 0600, and production is re-read only to prove it remains `7/1`.

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

The normalized fresh template is sealed before cloning. The successor must then reproduce, byte-for-byte or by the same exact aggregate gate as appropriate, core counts `21/53/96/5/39/14`, default ACL `6/3/3`, schema/table/function ACL `7/653/46`, effective privileges `571/588`, `40/56`, and `5/8`, public owner `pg_database_owner`, the five-line owner distribution, extension inventory, encoding/locale, database owner `postgres`, and all zero-row counts. Fresh template and successor must report PUBLIC-USAGE `1`; the halted original separately retains its previously sealed `7/1`. A clone is not accepted merely because `CREATE DATABASE` returns zero.

## 11. Synthetic state

### 11.1 Clone boundary and lane separation

After the new restore, normalization, and complete fidelity sealing, the fresh template remains free of fixtures and replay state while the successor is created from it. Clone evidence records only database counts, ownership, connection count, size, disk headroom, status, and hashes. All three database names are recorded, but no row identifier or selector is.

Only after the successor passes the full clone-fidelity gate may the runner seed it. The halted original already contains exactly the six synthetic application roles and six matching permission rows created by the measured Task-5 Step 1, with zero departments and zero staff; those rows are not reinserted or changed. It remains the identity-free lane for the isolated `20260814130000` rollback fingerprint. The fresh template remains empty. The successor receives six synthetic role/permission pairs plus the minimal protected-selector shell below. No fixture is copied from production.

The retained database from the measured failed execution and all of its evidence remain untouched except for the separately bounded rollback-only `20260814130000` diagnostic, whose transaction must leave the database byte-equivalent under the targeted fingerprint. The corrected implementation distinguishes halted original, fresh template, and successor through separately generated names, database OIDs, owners, zero/fixture counts, phase markers, and sealed hashes, never by position or a name assumption. A failure to create, restore, normalize, or seal the fresh template stops before successor creation; it does not delete fixtures, reverse successful migrations, or modify retained evidence to manufacture a template.

### 11.2 Minimal successor-only shell

The successor fixture adds exactly one reserved synthetic department and exactly one synthetic staff shell. The department uses an isolated-only generated identifier plus synthetic code and name. The staff shell uses an isolated-only generated identifier, a synthetic `full_name`, one reserved fixture `role_id`, that synthetic `department_id`, schema defaults for `active`, `created_at`, `list_order`, and `session_version`, and the exact protected selector in `username`. `email`, `phone`, `password`, `password_hash`, and `job_title_id` are omitted or null. No real employee row, production UUID, email, phone, password, hash, token, credential, or production data is inserted.

The protected selector is an unavoidable source precondition, not a claim that the shell represents that employee. The SHA-locked `20260813210000` file is verified immediately before extraction. A purpose-built parser must find the locked two syntactic occurrences used by the guarded `public.staff_users.username` exact-one logic, prove that they resolve to exactly one identical validated selector value, and reject malformed UTF-8, control characters, embedded line breaks, NUL bytes, excess length, an unexpected occurrence count, inconsistent values, or any unexpected statement shape. Evidence exposes only occurrence count `2`, unique-value count `1`, consistency status, and validation status.

Extraction and insertion occur inside one root-controlled, tracing-disabled, binding-capable database-client process running within the isolated container. The verified source enters that client only on fd 0; the client parses the source in memory and uses a bound SQL parameter for the selector. The selector is never transferred on fd 1 or fd 2, through a shell pipeline between processes, or through SQL text. Client/library availability and parameter binding are preflight gates; no package installation or fallback to interpolation is allowed.

Before parsing, the client redirects its own fd 1 and fd 2 to internal capture sinks and installs a generic exception boundary. It retains raw database fields only in process memory long enough to replace every exact selector occurrence with `<protected-account>` and discard all other row-valued detail. Only the sanitized generic status is eligible for hashing. Raw commands, SQL text, server error fields, notices, and Docker-exec output never reach the terminal, an evidence file, Docker logs, or a hash-input stream. The value exists only in the locked source, client memory, bound protocol parameter, and required isolated successor row; it never appears in an argument, environment variable, generated file, evidence record, shell trace, stdout, stderr, or final report.

The fixture transaction verifies aggregate-only pre/post counts: successor roles `6`, permissions `6`, departments `1`, staff `1`, exact-selector matches `1`; non-null staff email, phone, password, and password-hash counts `0`; and reset-token, task, audit, and migration-history row counts `0` before replay. It also verifies the role and department foreign keys, non-production marker values, username unique-index compatibility, and schema defaults without selecting any row value. Any mismatch rolls back the fixture and stops.

If a locked migration itself writes protected account data into the shell, that source effect remains confined to the successor database and is never selected or emitted at row level. Only aggregate invariants may be read afterward. The design does not alter the migration to suppress, replace, or generalize its protected DML.

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

Every source is streamed through one single-transaction invocation in the successor as the isolated production-equivalent `postgres` role. No migration changes current role, session authorization, connection, or owner to `supabase_admin`; implementation must verify these source-scan counts before replay without printing source bodies.

Only `20260814130000` may return nonzero, and its transaction must roll back cleanly. Every other nonzero status is an immediate stop. Output is stored only as status plus SHA-256.

The successor must produce fifteen zero exits, with only `20260814130000` nonzero and its before/after aggregate/constraint fingerprint byte-identical. `20260813210000` must succeed so that `20260814160000` and `20260814170000` can consume the expected password-reset column, table, and function surface. The thirteen terminal function fingerprints, downstream password-reset invariants, TBT terminal state, owners, ACLs, and permissions must match the locked terminal chain.

The same fifteen safe migrations then run a second successor pass and must all return zero. This is technical idempotency only. It never proves that protected production DML ran historically, never upgrades a classification, and never authorizes production replay or history writes.

Separately, the original identity-free lane runs only the approved isolated `20260814130000` rollback test at the defined schema boundary. Its exact pre/post staff/list-order/constraint fingerprint must be byte-identical and no transaction effect may persist. That targeted diagnostic is not represented as a full chronological replay and cannot substitute for successor results.

### 12.1 Classification and history boundary

Lane evidence remains separate. Original-lane rollback proves only that `20260814130000` fails cleanly without its targeted identities. Successor-lane success proves only that the exact chain is replayable and technically idempotent when its source precondition is supplied by a non-production shell.

The production history gate remains `STOP` for `20260813210000`, `20260813230000`, `20260813233000`, and `20260814130000`. Current production postconditions and successor replay do not prove historical protected DML for those versions. Task 8 remains unreachable, all eleven target history counts remain zero, and no lane result grants permission to write or replay production migrations.

## 13. Evidence flow

1. Verify image digest, retained container/volume identity and controls, host resources, Docker health, production health, Git fingerprint, sealed dump hashes, and all sixteen source hashes.
2. Create a new root-only evidence child directory, generate unique fresh-template and successor names, and seal the recovery preflight manifest; reuse the retained password-file path without reading its value.
3. Re-assert network-none, zero ports, resource limits, mounts, PostgreSQL readiness, archive roles, and the halted original's exact retained failure aggregates/evidence.
4. Recheck disk thresholds; create the fresh template database from `template0` through an administrative connection with owner `postgres` and the audited locale/encoding.
5. Stream the sealed schema archive into the fresh template and record only hashed output/status.
6. Verify archive/production/template/TDD normalization guards, commit the one isolated PUBLIC-USAGE grant as non-superuser `postgres`, hash its output/status, and prove production remains unchanged.
7. Capture owner, ACL, privilege, schema, function, extension, and zero-row fingerprints; compare with production and seal the fresh template.
8. Recheck disk thresholds and zero active fresh-template connections; create the uniquely named successor from another database connection with owner `postgres` and safe identifier quoting.
9. Recheck disk allocation, all three database identities, ownership, encoding/locale, PUBLIC-USAGE `7/1`, all core/owner/default/ACL/effective gates, and all fresh-template/successor zero-row counts.
10. Verify the halted original's existing six role/permission pairs without changing them; seed six pairs in the successor and add its department/staff shell only through the binding-capable selector client; seal aggregate-only fixture evidence.
11. Produce the halted original's identity-free `20260814130000` rollback fingerprint without a persistent database change.
12. Stream the exact sixteen-file chronological replay into the successor and record per-version status/output hash.
13. Prove the successor's expected `20260814130000` rollback, terminal TBT state, downstream password-reset state, terminal function hashes, and fifteen-file idempotency pass.
14. Re-read production history and protected aggregates SELECT-only; compare with pre-change evidence.
15. Generate lane-separated classifications and the all-or-nothing STOP gate; Task 8 remains unreachable for the four unresolved versions.
16. Recheck Git, provider/model, CLIProxyAPI/`9router`, services, HTTP behavior, database readiness, Docker health, all three retained database identities, and disk thresholds.
17. Seal all evidence and retain the halted original, fresh template, successor, isolated container, volume, and password file.

No step streams data from production tables into the isolated cluster. The only production-derived payload is the sealed schema-only archive and aggregate/catalog evidence.

## 14. Error handling

- A missing pinned image, image digest mismatch, incompatible architecture, or missing required extension stops before container creation.
- Insufficient resource/disk headroom or unhealthy production service stops before container creation or cloning.
- Any unexpected network, port, mount, privilege, role, locale, owner, ACL, or schema mismatch stops before fixtures.
- Any archive semantic count, production ACL count, replay precondition, retained TDD hash/status, transaction pre-guard, transaction post-guard, or production-preservation mismatch stops before the normalization grant or before fidelity. Transaction failure rolls back and is never retried with a broader grant or stronger role.
- Any fresh-template creation/restore/normalization/fidelity error, active template connection, invalid/colliding database name, unsafe identifier quoting, non-`postgres` owner, clone error, disk threshold breach, or clone-fidelity mismatch stops before fixture creation. The halted original is never modified to make a template or clone succeed.
- A missing binding-capable client, unproven parameter binding, fd-capture failure, selector source-hash mismatch, syntax-shape mismatch, occurrence count other than two, unique-value count other than one, inconsistent occurrence, invalid value encoding, fixture identity collision, unexpected fixture aggregate, or nonzero production-row count rolls back the successor fixture and stops before replay. The client emits only a generic sanitized failure record; the selector and raw database fields are never emitted or hashed.
- Any original-lane `20260814130000` fingerprint mismatch or rollback leak stops before successor replay.
- Any successor replay failure other than `20260814130000`, or any `20260814130000` rollback-fingerprint mismatch, stops immediately.
- Any rollback leak, idempotency failure, function-hash drift, permission drift, or Git/production invariant change stops immediately.
- Raw restore/replay output is hashed; only non-sensitive status metadata is reported.
- Failure never triggers an automatic retry with weaker flags, a different role, a different image, or a filtered archive.
- Failure retains the halted original, fresh template if created, successor if created, container, volume, password file, and evidence for review.

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

Controls: version-by-version classification taxonomy, lane-separated evidence, explicit one-time-DML limitations, preserved trusted apply manifests, and the all-exact gate. Disposable success is necessary evidence, never sufficient authorization.

### 15.6 Protected-selector disclosure or lane confusion

Threat: the protected selector appears in process metadata, logs, evidence, or reports, or successor results are attributed to the identity-free original.

Controls: locked-source hash verification, two-occurrence/one-value parsing, a single binding-capable client, source input only on fd 0, no selector transfer on fd 1/2, internal raw-error capture and selector redaction, tracing disabled, no value in arguments/environment/files/output/hash-input streams, aggregate-only evidence, three distinct unpredictable database names or identities, per-lane evidence prefixes, explicit database/session assertions before every SQL phase, and independent classification records. Source-written protected row values are never selected or printed.

## 16. Rollback and cleanup

The design makes no production change, so normal rollback is to stop and retain evidence. The verified full production dump remains recovery evidence but is never restored by this design.

Halted original, fresh template, successor, container, volume, password file, schema archive, and replay evidence are never removed automatically. Cleanup is a separate dangerous action requiring explicit confirmation immediately before the exact database, container, volume, password file, or retained evidence is removed. Cleanup must first verify evidence hashes and record the exact approved targets. Failure or disk pressure never authorizes deletion.

## 17. Testing strategy

### 17.1 RED evidence

The design carries forward three measured architecture failures rather than repeating them:

- Exact shared-cluster restore: three `supabase_admin` default-ACL permission failures.
- `--no-privileges`: core schema green but ACL/effective-privilege fidelity failed materially.
- Filtered TOC: restore green but schema owner and explicit schema ACL fidelity failed.

Direct `supabase_admin` socket use is a separately rejected authentication path: its non-interactive gate was false without credentials. The isolated design must restore all ownership and ACL evidence exactly without production authentication or privilege weakening.

The retained exact isolated restore is an additional focused RED: schema ACL `6` and PUBLIC-USAGE `0` versus production `7/1`, with the other six ACL/effective-privilege aggregates exact. Offline archive inspection independently proves the archive contains zero semantic PUBLIC-USAGE grant.

The measured Task-5 RED is `6/6/0/0/0/0` synthetic fixtures followed by `20260813210000` exit `3` and SQLSTATE `P0001`, with all source, transaction-rollback, production, Git, service, and HTTP preservation gates intact. Aggregate-only documentation RED also proves that the former design contained zero successor-lane descriptions while simultaneously requiring zero staff and fifteen successful migrations. The retained RED record contains only counts, return codes, document hash, and its own SHA-256; it contains no selector or row identity.

### 17.2 GREEN criteria

The rollback-only normalization TDD test is green only when one isolated PUBLIC-USAGE grant changes schema ACL `6→7` and PUBLIC-USAGE `0→1`, all six other fidelity aggregates remain exact, rollback restores `6/0`, and production remains `7/1`.

The fresh-template restore-plus-normalization path is green only if retained image/container/volume, resource, network, secret path, role, locale, extension, normalization guards, zero-row, core schema, owner, default ACL, explicit ACL, and effective-privilege gates all pass exactly before cloning.

Clone and fixture preparation are green only if both new database allocations pass disk pre/post thresholds, the fresh template has zero active sessions, fresh template and successor have unique names and owner `postgres`, all baseline fidelity and zero-row gates match template/successor, the selector client reports two expected syntax occurrences resolving to one valid unique value without emitting it, the halted original remains at its measured `6/6/0` state, and successor fixtures are `6/6/1/1` with one aggregate selector match and no real employee fixture payload.

Replay is green only if the original identity-free `20260814130000` transaction rolls back with a byte-identical fingerprint, the successor produces fifteen zero exits with `20260814130000` alone nonzero and rollback-clean, all fifteen safe migrations pass the successor idempotency pass, downstream `20260814160000`/`20260814170000` and thirteen terminal functions verify, and the exact terminal TBT state matches.

Production preservation is green only if history counts, protected aggregate bytes, function/grant fingerprints, HEAD, tree, index, dirty count/hash, restart count, nginx, Docker, database readiness, and HTTP behavior remain unchanged.

### 17.3 No automatic promotion

Green infrastructure, original rollback, successor replay, and successor idempotency tests do not change classification rows automatically. The classification task must explicitly evaluate each version. `20260813210000`, `20260813230000`, `20260813233000`, and `20260814130000` remain `STOP`; production history remains unchanged and Task 8 remains unreachable.

### 17.4 Correction coverage

| Required correction | Controlling sections |
|---|---|
| Measured failure and technical clone feasibility | 2.7 |
| Same-container fresh template, pre-fixture successor, and safe database naming | 6.1–6.2, 11.1 |
| Exact clone fidelity, ownership, ACL, and connection gates | 6.2, 10 |
| Retained halted-original identity-free rollback lane | 11.1, 12 |
| Successor-only minimal shell and selector containment | 11.2, 15.6 |
| Full successor chronology, downstream dependencies, and idempotency | 12 |
| Separate classification semantics and unreachable history write | 12.1, 17.3 |
| Disk pre/post thresholds and retained-resource recovery | 6.4, 14, 16 |
| Aggregate-only RED/GREEN and production preservation | 17.1–17.2 |
| Current execution stop and documentation-only authority | 19 |

## 18. Exact success criteria

The isolated Phase-0 evidence batch succeeds only when all of the following are true:

1. The local image digest exactly matches the approved digest; no pull occurs.
2. The existing container remains retained, network-none, portless, non-privileged, resource-limited, and backed by its retained named volume; fresh-template and clone disk thresholds pass before and after each allocation.
3. The password exists only in a root-only file and is absent from reported/container configuration values.
4. PostgreSQL major, encoding, locale provider, locale, all three database owners, and required extensions match the design.
5. Archive roles and attributes match the audited production metadata.
6. Fresh-template restore exits zero; the guarded isolated-only PUBLIC-USAGE normalization proves archive `0`, production `7/1`, template pre `6/0`, template post `7/1`, and retained TDD `PASS`; then core counts, owner distribution, default ACLs, explicit ACLs, and effective privileges match exactly.
7. The successor is cloned from the inert fresh template before fixture/replay state with zero template connections, safe identifier quoting, unique unpredictable name, owner `postgres`, and byte-identical or exact aggregate baseline fidelity including ACL `7/1`.
8. The halted original remains identity-free with six roles, six permissions, zero departments, and zero staff; the fresh template remains empty; the successor alone has six roles, six permissions, one synthetic department, one synthetic staff shell, one exact selector match, and no real employee fixture payload or copied production data.
9. The selector client verifies the SHA-locked source, two expected syntax occurrences resolving to one valid unique value, fd-0-only source input, bound-parameter insertion, internal raw-error sanitization, aggregate-only evidence, and zero selector disclosure on fd 1/2, logs, files, or hash-input streams.
10. All sixteen source hashes verify immediately before successor replay.
11. Original identity-free `20260814130000` evidence rolls back byte-identically; successor replay results are fifteen zero exits plus the single expected `20260814130000` rollback.
12. All fifteen safe migrations pass the second successor idempotency run, including `20260813210000`, `20260814160000`, and `20260814170000`.
13. Terminal TBT, downstream password-reset, and thirteen function-hash fingerprints match the exact chronological source chain.
14. Production history and protected aggregates remain unchanged; the four unresolved versions retain `STOP` and Task 8 remains unreachable.
15. Git HEAD/tree/index/dirty fingerprint, provider/model, CLIProxyAPI, `9router`, password-reset/session behavior, services, HTTP responses, and active build remain unchanged.
16. Evidence modes/hashes verify and halted original, fresh template, successor, container, volume, and password file remain retained.

## 19. Execution and review boundary

This document is a design, not permission to clone a database, insert a fixture, retry Task 5, or execute any persistent normalization. It contains no full lifecycle commands. The separately reviewed implementation plan must incorporate the measured Task-4 exception and this two-lane correction while preserving the security/classification gates and keeping production SELECT-only.

Implementation must remain inline and sequential through the existing Aylaspa custom agent. No parallel worker may create databases, containers, volumes, roles, restore schemas, replay migrations, classify versions, or write history.

At this design revision boundary, Task 5 remains stopped immediately after the rolled-back `20260813210000` attempt. The original database, container, volume, password file, source, runbook, production history, provider/model, CLIProxyAPI/`9router`, application, services, and evidence remain unchanged. No retry, cleanup, or history write is authorized by this document.

The approved design revision is committed only after scope verification proves one changed design file, an empty index before staging, strict UTF-8, no incomplete markers or exact protected-selector literal, clean whitespace, byte-identical review mirrors, a green requirement matrix, and independent review with every Critical and Important finding resolved.
