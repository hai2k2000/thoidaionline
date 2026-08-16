# THỜI ĐẠI WORK Phase 0: Isolated PostgreSQL Replay Design

**Status:** Normative v17 recovery-correction design for independent review. It preserves the sealed Tasks 1-4 record, immutable v5-v13 evidence, and retained Task-5 failure lane while retaining pinned anonymous-inode no-replace publication, externally anchored passive-before-execute trust, and literal-final live recovery.

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


## Normative v8 recovery addendum

The v5 lane-creation design succeeded through creation/start and then stopped at its first readiness boundary. This v8 addendum has precedence for re-entry and corrected handoff publication:

- `HANDOFF.current` still selects `/opt/thoidai-reconciliation/phase0-execution-handoff-20260815T041006Z-2be71271104d`; the old pointer bytes, package manifest, and v5 approval remain immutable.
- `/opt/thoidai-reconciliation/phase0-v5-execution.pending` still selects only `/opt/thoidai-reconciliation/phase0-v5-execution-20260815T041430Z-7fa3f327f5c8`. While it exists, no second recovery path, allocation, secret, volume, container, or pending pointer may be created or substituted.
- The retained lane is container `thoidai_phase0_v3_cd3186598cd4` (ID `c8d8916b639cb40ae19d7dfeeb0cf43bf52edea51ca4dc4be1e4e34dcd1ffc4c`), volume `thoidai_phase0_v3_data_cd3186598cd4`, and the three allocated database names ending `cd3186598cd4`. The container remains running with the pinned image, network `none`, no ports, log driver `none`, exact resource/security/mount controls, restart `no`, and zero restarts.
- Task-5 Blocks 1-3 passed. Block 4 observed `pg_isready` success but the immediately following `psql` query failed. The zero-byte `postgres-logging.actual.tsv` is preserved failure evidence. No expected database/archive role, restore marker, fidelity seal, Task-5 seal, or current pointer exists.
- The exact pre-readiness failure-state stream hashes to `130455a0a92ca76d0372410d4ad60d67d7e8866985f64b5be2cf11a175617faa`. It binds explicitly named non-secret evidence bytes and metadata, the pending/old-handoff/approval tuple, secret metadata without secret bytes, absence markers, and selected container/volume metadata.

Re-entry first authenticates a separately reviewed corrected handoff, then reproduces that exact state. It rejects pointer/path/symlink ambiguity, byte or metadata drift, wrong container/ID/image/platform/security/resources/mounts, wrong volume or secret metadata, any completion seal, or any expected database/role/object already started. Only the first unfinished readiness boundary is resumable; completed creation mutations never rerun. Any interruption after database/role creation requires another reviewed correction rather than replay of a partially completed mutation.

## Normative v9 executable controls (superseded by v10; historical)

v9 keeps the exact retained v5 lane and v8 failure fingerprint but replaces the recovery/publication mechanism. Every live Docker or SQL probe is invoked through `/usr/bin/timeout --foreground` with a per-command maximum of five seconds; the readiness loop also has a 120-second overall deadline. Exit 124 is handled explicitly. A readiness observation fails and resets on timeout or any other nonzero result; an identity/preflight timeout stops immediately.

The readiness seal has exactly five root-owned regular non-symlink mode-0600 members: `COMPLETE`, `SHA256SUMS`, expected/actual logging TSVs, and an exact-schema status TSV. The manifest has exactly four ordered rows and covers every member except itself. All files and the staging directory are fsynced before `renameat2(RENAME_NOREPLACE)` publishes `readiness-v15`; EEXIST, ENOSYS, EINVAL, or ENOTSUP fails closed. A concurrent pre-existing target can never be overwritten.

The reviewed `RECOVERY-VERIFY.sh` has a bounded sanitized live boundary query. Failure-state emission selects the data-volume destination and credential-bind destination independently, requires exactly one of each and exactly two mounts overall, and serializes them in the fixed approved order (data volume, then credential bind); it never relies on Docker `.Mounts` array order and never relocks the immutable failure fingerprint. It verifies the exact credential mount path inside the container without reading its bytes, then proves the exact bootstrap role attributes, `postgres` database ownership, zero bootstrap memberships, and absence of all expected replay databases/archive roles. Task 10 invokes it before package construction, before publication, and after publication, so an advanced lane cannot receive corrected authority.

The superseded v9 design specified a fully executable Task 10 with an exact 18-key additive v9 approval, an exact 21-key `COMMIT.tsv`, reviewed helpers, fsynced package/history files, `RENAME_NOREPLACE` pending publication, and atomic `RENAME_EXCHANGE` for `HANDOFF.current`. Those controls are preserved as historical design evidence only; they cannot create v11 authority or be mixed with the v11 transaction below.

## Normative v10 byte and rollback controls (superseded by v11; historical)

v10 preserves the exact v5 lane, v8 failure fingerprint, and sealed v9 evidence while replacing the active authentication/publication mechanism. The two CR bytes in the sealed v9 review-package `VERIFY.sh` are historical and must not be repaired in place. Every v10 review and execution text payload must reject CR, NUL, and missing-final-LF bytes before sealing or publication; negative tests prove all three rejection paths.

Task 10 is one complete shell transaction under a fixed root-owned exclusive `flock`. The lock begins before byte/authority preverification and remains held through package sealing, private candidate-pointer helper validation, sticky no-replace pending publication, prepared-history fsync, atomic authoritative exchange, both postpublication helpers, final history manifests/fsync, and final postverification. Helper validation before public pending creation uses only a private `.phase0-v10-candidate-pointer.<random>` whose exact inode/hash is removed first.

The publication state machine names old authority A, proposed authority C, and any non-cooperating replacement B. History is durable and rollback is armed before `RENAME_EXCHANGE`; A remains a verified rollback source through every post-exchange gate. Normal failure restores A and retains failed C. If `HANDOFF.current` no longer hashes to C because another writer installed B, rollback does not overwrite B and never leaves C authoritative. Candidate/pending cleanup is permitted only when both recorded device/inode and full byte hash still match; a foreign replacement is retained and fails closed. Lock and rollback evidence is sanitized and contains no secret bytes.

The recovery verifier performs separate bounded regular-file and readability probes for the exact credential mount while preserving exact bind source and read-only mode checks. It never reads credential bytes and never changes authentication. The v10 approval/review/execution names are additive; the v5 approval, old handoff, Task-5 pending pointer, retained recovery path, runtime identities, and failure-state SHA-256 remain immutable.

## Normative v11 immutable authority and crash state machine (superseded by v12; historical)

v11 never modifies, renames, exchanges, removes, or replaces the old `HANDOFF.current`. It remains immutable evidence with exact byte hash and old-package binding and is opened read-only only to acquire the cooperative publication lock. Corrected Task-5 authority consists solely of fixed, versioned, previously absent paths `phase0-v11-execution-handoff.pending` and `HANDOFF.recovery-v11.current`, each published once with `RENAME_NOREPLACE` and immediate base-directory fsync.

Both pointer candidates exist before the package is sealed. Exact device/inode and byte hashes, candidate paths, fixed target paths, immutable old authority, Task-5 pending/failure state, and lock inode are cross-bound by `PUBLICATION.tsv`, `HISTORY.tsv`, `COMMIT.tsv`, the additive 20-key review, and the package manifest. This makes exact state distinguishable from a foreign inode even if foreign bytes match. No cleanup, unlink, exchange, overwrite, rollback, or old-pointer move exists; failed unique artifacts remain evidence.

The authoritative state machine accepts only none, exact pending-only, or exact current-plus-pending. A none rerun may construct a fresh uniquely named package/candidate pair while retaining interrupted artifacts. Exact pending-only revalidates every binding, fsyncs the base to complete a possible post-rename crash, then publishes exact current no-replace. Exact current revalidates and finalizes idempotently. Current-only, missing candidates, foreign identities, byte drift, EEXIST races, unsupported primitives, or inconsistent approval/commit/failure state stop without mutation.

Step 1R verifies the immutable old pointer plus the original Task-5 pending path and failure fingerprint through the reviewed bounded recovery helper before opening v11 current. Credential probes remain separate bounded `-f` and `-r` tests and never read secret bytes. All v9 recovery/readiness gates and CR/NUL/final-LF policy remain mandatory.

## Normative v12 anonymous-inode authority, bound resume, and passive trust (superseded by v13; historical)

v12 keeps `HANDOFF.current` immutable and reserves only `phase0-v12-execution-handoff.pending` plus `HANDOFF.recovery-v12.current`. It removes public candidate pointer pathnames. Initial publication creates the final pointer bytes in an `O_TMPFILE` inode on the reconciliation XFS filesystem, fsyncs and validates the open inode, and publishes pending with `linkat(AT_EMPTY_PATH)` no-replace. Pending-only publication fsyncs the base directory first, opens and pins the authenticated pending inode, and links that exact inode to current. Exact completion requires pending and current to be hard links to one approved inode.

A late pending `EEXIST` is a binding event, never permission to continue package C. Current remains absent; the parent fsyncs the base, passively authenticates the winning pending, replaces its in-memory package binding with B, and only then may link B's pinned inode to current. Anonymous staging removes the candidate-path C-to-B substitution window. The accepted states are none/none, exact pending-only, and exact same-inode pending-plus-current; current-only, different-inode equal bytes, foreign content, unsupported primitives, or any drift fail closed without cleanup.

The additive approval and its manifest-sealed review package form the external trust root. Every execution package is manifest-checked only as passive data, then its approval snapshot, failure payload, publisher, validators, plan, and design must compare byte-for-byte with external approval/trusted review bytes. Consumers execute only trusted review-package copies after those comparisons. This applies to Task 10 construction/reconciliation, Task-5 Step 1R, and the Task-5 final gate.

## Normative v13 externally anchored trust and executable adversarial verification (superseded by v14; historical)

v13 retains v12's immutable old authority and anonymous-inode same-inode publication state machine but replaces every active consumer. The operator supplies the exact v13 review-package path and `SHA256SUMS` SHA-256 independently. Consumers authenticate that anchor before reading approval values. `TRUST-GATE.py` then validates safe exact review and execution manifests, exact text bytes, the 22-key approval, 26-key commit, 13-key history, 8-key publication, and 19-key trust policy; passively compares every executable and authority-bearing payload; cross-binds the actual immutable-lock device/inode through policy, approval, commit, and history; and only then invokes trusted review-package helpers.

Step 1R and Task 10 request trusted verify plus trusted live recovery through the gate. The Task-5 final gate repeats the complete passive chain and makes live `RECOVERY-VERIFY.sh` the final action immediately before `TASK5.COMPLETE`. No helper under an execution-package path is invoked. Manifest traversal is rejected before digest reads, and CR, NUL, missing-final-LF, duplicate, extra, malformed, foreign-pointer, and lock-inode drift fail closed.

`PUBLISH.py` production semantics remain `O_TMPFILE` plus `linkat(AT_EMPTY_PATH)`, no replace, directory fsync after each link and before pending resume, and exact pending/current same inode. Guarded simulation-only checkpoints are unreachable outside a root-owned `.phase0-v13-simulation-*` tree with exact `.ALLOW_V13_SIMULATION`. Real subprocess tests crash at all six durability boundaries, recover deterministically, force a concurrent late writer so B alone becomes pending/current, and prove an adversarial execution-package helper never runs while trusted markers run only after passive validation.

The sealed v13 candidate remains historical and non-authoritative because a status print followed successful live recovery.

## Normative v14 literal-final recovery and versioned trust (superseded by v15; historical)

v14 retains v13's external review path/manifest anchor, safe manifest parsing before digest reads, passive execution-package comparisons, exact 22/26/13/8/19 schemas, actual-lock-inode cross-binding, and anonymous-inode publication. All active approval, review, execution, pointer, trust-policy, simulation-guard, and fault/barrier names are v14-only.

The trusted gate flushes passive status before helper execution. When recovery is requested, it returns the trusted timeout-wrapped `RECOVERY-VERIFY.sh` call directly; there is no later output, command, trap, cleanup, or mutation in the gate. Thus the Task-5 caller's immediately following `TASK5.COMPLETE` write has successful live recovery as its literal preceding successful command.

The real subprocess suite remains mandatory: crash exits 91-96, deterministic resume, B-pending/B-current barrier race, review/execution traversal rejection, CR/NUL/missing-final-LF rejection, and proof that a malicious execution helper never runs.

## Normative v15 staged recovery and completion ownership (superseded by v16; historical)

v15 is the sole active design; v14 is immutable and superseded. Active approval/review/execution/pointer/simulation names are v15-only and schemas are exactly `22/26/13/8/19`; HISTORY has thirteen keys and binds the authenticated commit head/tree/parent tuple. External bootstraps validate exact names/order, safe basenames, digest syntax, root metadata, CR/NUL absence, and final LF before checksum execution; TRUST-GATE is the only late-package entry.

Recovery has `pre-resume` and `pre-completion` stages. The latter requires exact readiness-v15 timeout/nonzero counter-reset policy, restore/ACL/role/fidelity manifests, live role/membership/forbidden-role/three-owner equality, and absent completion/current state. Completion preparation durably creates pointer bytes, pinned inode, binding, publisher args, and precompletion manifest; successful pre-completion recovery is immediately followed by one PUBLISH completion command. The publisher alone creates the marker, final manifest, and no-replace Task-5 current link with fsync boundaries and crash exits 111-114. Task 10 gate-to-publisher branches are adjacent, and the real guarded simulation must end CLEAN before install.

## Normative v16 centralized manifest and fully resumable completion architecture (superseded by v17; historical)

v16 centralized manifest trust with `SAFE_MANIFEST.py`, basename-only `SOURCE-SHA256SUMS`, exact `22/26/13/8/19` schemas, a four-object resumable completion prefix, twelve prepare crash points, base-directory fsync repair, freshly gated Task-9 preservation, and real VERIFY/staged-recovery/isolated-Git simulation.

## Normative v17 manifest-writer and bound-inode closure architecture

v17 alone is active. Six executable manifest writers converge on the same externally anchored helper, emit sorted unique basename-only lowercase SHA-256 rows with exactly one ASCII space, and immediately validate the result. The source manifest uses an explicit fixed migration member root and exact root/member modes; no active writer emits absolute member paths, legacy two-space rows, or a glob-selected digest list.

All five standalone review consumers contain byte-identical bootstrap and manifest helper implementations in the same order. Each bootstrap uses a bound directory fd, `O_NOFOLLOW`, stable before/after `fstat`, named-inode rechecks, correct name-to-digest lookup, and fail-closed open/stat handling before it compiles sealed review helper bytes. The central safe parser and publisher apply the same bound-fd model to files, directories, pending/current pointers, and completion artifacts.

The guarded real suite adds deterministic negatives for bootstrap, `SAFE_MANIFEST.py`, and `PUBLISH.py`: symlinks, same-byte member swaps, directory inode rebinds, equal-byte distinct pointer inodes, and a post-pin pending swap are rejected, while an adversarial bootstrap target marker stays absent. Existing exits 91-96, 111-114, and 121-132, late-writer B preservation, real staged recovery, malicious execution-helper rejection, traversal/text checks, Task-9 preservation, and literal publisher adjacency remain mandatory. Only `adversarial_simulation|CLEAN` permits sealing.

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

1. Invoke one externally trusted, manifest-sealed validator before v17 re-entry, bind the exact retained failure state, invoke it again immediately before Task-5 completion, and invoke it around anonymous-inode publication only after passive payload comparison.
2. Preserve production, the retained quarantine lane, the exact pending Task-5 lane, previous handoff/pointers, Git state outside the authorized documentation commit, active provider/model, CLIProxyAPI, `9router`, services, routing, and active build.
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
2. **v17 execution handoff package** - committed plan/design, immutable v5 and additive v17 approval snapshots, immutable-old-HANDOFF and Task-5-pending snapshots, exact failure state, 22/26/13/8-key review/commit/history/publication schemas, byte-clean trusted validators and anonymous-inode publisher, selected only by exact same-inode fixed pointers.
3. **Existing pending evidence directory** - the exact retained root-owned mode-0700 recovery path; its completed evidence is byte-bound and never recreated or replaced.
4. **Retained isolated container** - the exact existing name and ID, pinned image, no log driver, no network or ports, exact limits, no restart/stop/remove, and stable composite readiness before reuse.
5. **Retained data volume** - the exact existing volume mounted only into the retained v5 container.
6. **Retained secret** - verified by path/type/owner/mode/size and mount metadata without reading or hashing its bytes; never regenerated.
7. **Fresh normalized template** — restored from `template0` plus the single measured PUBLIC-USAGE normalization, fidelity-sealed, zero-row, and connection-disabled after cloning.
8. **Identity-free diagnostic clone** — receives no protected shell and runs only the approved expected-negative diagnostic.
9. **Protected-shell successor clone** — receives six synthetic role/permission pairs, one synthetic department, and one minimal bound selector shell; runs the chronological replay and safe idempotency pass.

The already allocated v5 container, volume, and database names are now immutable identities. Re-entry compares them to the reviewed failure-state tuple and rejects every replacement, second allocation, collision fallback, or basename/path reinterpretation.

## 7. Secret and selector handling

The new database password exists only in a root-owned regular file with mode 0600. Its bytes are never read into a shell argument, printed, hashed, stored in evidence, or included in Docker environment values. Only the password-file path is configured.

The protected source is SHA-locked. A tracing-disabled binding client reads it directly from host fd 0, parses exactly two approved syntax occurrences resolving to one unique validated value in a transaction-local table, binds the value through psql extended-query parameters, and clears the temporary state before commit. The selector is never copied to an argument, environment variable, generated file, stdout, stderr, evidence, report, or hash-input stream.

The retained Docker log is never used as a disclosure oracle. The new container cannot retain Docker log bytes because its driver is `none`, and PostgreSQL cannot log ordinary error statements under the required settings.

## 8. Cluster and restore bootstrap

The official image initializes a private PostgreSQL 17 cluster in the new volume. The bootstrap role is used only for cluster administration. Task 5 derives valid archive-role expectations from the sealed Task-4 manifest and extends them with an exact executable manifest for the bootstrap and supporting membership roles. Every selected role row includes `rolsuper`, `rolinherit`, `rolcreatedb`, `rolcreaterole`, `rolcanlogin`, `rolreplication`, `rolbypassrls`, `rolconnlimit`, and password-null state. Exact membership rows and an exact empty forbidden-role set are compared byte-for-byte. Fresh, diagnostic, and successor ownership must each be `postgres`, and that replay owner must be non-superuser.

The fresh database is created from `template0` with the audited encoding and locale. The sealed schema archive is streamed through stdin without a repository mount. Restore stdout/stderr is suppressed from the terminal; only generic exit status is recorded. Any nonzero status stops without cleanup.

The sole normalization is PUBLIC schema USAGE. It is allowed only after archive, production, template-pre, and sealed rollback-TDD gates match the approved counts. All owner, default ACL, explicit ACL, effective privilege, core object, function, extension, and zero-row fingerprints must then match the sealed production/template expectations.

### 8.1 Stable re-entry readiness

One successful `pg_isready` probe is never sufficient. A stable observation is the conjunction of exact container running state, successful `pg_isready` for `phase0_bootstrap`/`postgres`, sanitized `SELECT 1` returning exactly `1`, and a byte-exact query of the five required PostgreSQL logging settings. Every component command has a five-second hard sub-timeout. Re-entry requires at least three consecutive stable observations separated by a bounded two-second delay; exit 124 or any other component failure resets the counter, while a hard 120-second overall deadline stops without mutation. No failure path reads a container log or restarts, stops, removes, or replaces the container.

The original zero-byte logging artifact is not overwritten. A success boundary is constructed outside the recovery path and fsynced and published with kernel no-replace semantics as a separate root-only `readiness-v17` directory containing expected/actual logging bytes, bounded probe policy, checksums, and a completion record. On later invocation, only the exact sealed readiness directory may be skipped; an incomplete or ambiguous seal fails closed. Before role/bootstrap work, a sanitized catalog gate proves all three expected databases and all five archive roles are still absent.

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

Every failed gate stops in place. Failure does not trigger weaker flags, a broader grant, a different image, a new lane, source editing, production replay, cleanup, service restart, or a quarantine-lane query. Re-entry never repeats a completed mutation. The pending container, volume, secret, databases if later created, and evidence remain retained. If the pending container exits, it remains retained and is not restarted automatically.

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

Task 10 creates one exact root-only v17 execution package containing committed plan/design bytes, immutable v5 and additive v17 approval snapshots, byte-identical immutable-old-HANDOFF and Task-5-pending snapshots, failure evidence, reviewed validators, `PUBLISH.py`, `TRUST-GATE.py`, `TRUST-POLICY.tsv`, `PUBLICATION.tsv`, `HISTORY.tsv`, exact-schema `COMMIT.tsv`, and a complete manifest. Approval, commit, history, publication, and trust-policy schemas contain exactly 22, 26, 13, 8, and 19 unique known records. Duplicate, conflicting, extra, malformed, traversal-bearing, CR/NUL-bearing, or unterminated text fails before any execution-package helper could run.

The old `HANDOFF.current` is never a publication target. Its actual device/inode must equal the externally anchored trust policy, approval, commit, and history lock binding. Package sealing records the exact one-line pointer digest and anonymous-inode strategy, not a replaceable candidate pathname. `O_TMPFILE` has no directory entry to substitute; `linkat(AT_EMPTY_PATH)` pins the validated open inode. Current is linked only from the authenticated pending inode, and exact completion requires both targets to share device/inode and bytes.

Six real subprocess crash checkpoints cover anonymous fsync, pending link/fsync/pin, and current link/fsync. Pending-only always repairs base durability before current. A real barrier race forces late valid B pending to rebind before current; C remains non-authoritative. The externally anchored v17 review package and additive approval bind immutable old authority, actual lock inode, original Task-5 failure lane, both fixed paths, authorized predecessor, and unrelated state. A later commit must be a new non-merge exact-two-document direct child of `464d17a652cdd622b5c20891e8f7fe24b55e6dd6`, never an amend.

## 14. Production and application preservation

Pre/post gates compare production history (`9` total and `0` target rows), safe protected aggregates, thirteen terminal function/grant fingerprints, database readiness, service active state/restart count, nginx validation, HTTP login/session behavior, Git HEAD/tree/index/dirty fingerprint, systemd unit hash, process start identity, executable hash, `.next/BUILD_ID`, `.next` filesystem identity, listening-socket topology, and Docker service-name/image topology.

Provider/model, CLIProxyAPI, and `9router` are explicit no-mutation surfaces. Baseline and final evidence are separately measured, byte-compared snapshots: only the redacted `codex doctor --json` provider/model keys are retained, while command availability, resolved path, root metadata, version, and matching systemd unit enabled/active state are recorded exactly. Evidence also records false authorization and zero mutation counts. It never copies the baseline as final evidence and never reads or hashes `/proc/*/environ`, provider secrets, tokens, config files, or environment-file contents.

The new lane is also compared exactly post-run: image ID, log driver, privilege, network, ports, CPU, memory/swap, PID limit, restart/auto-remove, mounts, tmpfs, volume existence, secret ownership/mode without reading it, running/retained state, and all three database identities.

## 15. Testing strategy

RED evidence includes the preserved readiness race: `pg_isready` succeeds while the immediately following sanitized `psql` probe fails. Static tests must simulate that sequence, per-command timeout 124, other nonzero results, counter reset, and then acceptance only after three eventual consecutive composite passes. Negative tests must reject wrong pending/recovery paths, wrong container name/ID, symlinks, malformed seal member/schema/mode, any restore/fidelity/task/current seal, and any expected database/archive role already started. A real temporary-filesystem simulation must prove anonymous `O_TMPFILE` publication cannot be substituted through a candidate pathname, late pending B wins without C current, pending-only resumes after base fsync, exact completion shares one inode, and foreign/current-only/distinct-inode states are retained and rejected. It must also execute the runbook bootstrap bytes and reject bootstrap/central-parser/publisher symlinks, member swaps, directory rebinds, equal-byte distinct inodes, and post-pin swaps without running an adversarial target.

GREEN requires the exact failure-state fingerprint, externally anchored and passively authenticated v17 package, actual lock-inode agreement, stable readiness seal, and all full immutable-package/schema, role-manifest, isolation, logging, restore, normalization, clone, selector-containment, exact-`P0001`, rollback, replay, idempotency, classification, preservation, and retention gates. A readiness-probe scan must classify every other plan probe: sealed historical probes are non-executable; active production/new-lane probes require a composite query-level gate. Green infrastructure never changes the STOP classification.

## 16. Exact success criteria

1. The externally anchored v17 trust gate binds old authority, actual lock inode, and the pending failure lane before re-entry, immediately before Task-5 completion, after package construction, and around anonymous-inode publication; no execution-package helper ever runs.
2. Retained resources receive metadata inspection only; their log and runtime are untouched.
3. The same retained pending lane exactly matches its name/ID, pinned image/platform, isolation, logging, security, resource, mount, volume, secret-metadata, restart-count, and retention requirements; readiness passes three consecutive composite observations.
4. Fresh template restore/normalization and both clones pass exact fidelity and zero-row gates; the exact role attributes, connection limits, password-null states, memberships, forbidden-role absence, and postgres non-superuser ownership reverify before seal and replay.
5. Selector parsing proves two occurrences and one unique value without emitting it; only the successor receives a minimal shell.
6. Both negative paths return sanitized `P0001`, expected nonzero status, and byte-identical rollback fingerprints.
7. The other fifteen migrations succeed twice, and terminal function/grant/data aggregates match.
8. Exactly seven target rows are `exact-applied` and four are `semantically-applied-but-source-differs`; the gate remains STOP.
9. Task 8 contains and executes zero history-write SQL.
10. Production, Git, provider/model, CLIProxyAPI, `9router`, services, nginx, routing, HTTP behavior, and active build remain unchanged.
11. New and quarantined resources remain retained; evidence and manifests verify.

## 17. Review package versus execution package

The root-only v17 candidate review package contains uncommitted plan/design bytes, failure/re-entry notes, validation results, exact failure state, byte-clean trusted validators, `PUBLISH.py`, `TRUST-GATE.py`, `TRUST-POLICY.tsv`, the central `SAFE_MANIFEST.py`, basename-only `SOURCE-SHA256SUMS`, and real subprocess simulations. It is not execution authority and updates no pointer or approval. A later additive v17 approval must bind its exact absolute path/manifest plus immutable v5 authority, old `HANDOFF.current`, its actual lock inode, both fixed v17 paths, and the retained failure lane.

After approval, Task 10 accepts only a non-merge exact-two-document commit whose sole parent is `464d17a652cdd622b5c20891e8f7fe24b55e6dd6` and whose blobs equal reviewed bytes. Exact 22-key approval, 26-key commit, 13-key history, 8-key publication, and 19-key policy schemas bind the pointer digest, lock inode, and anonymous-inode strategy. The operator-supplied review path and manifest SHA are authenticated before approval interpretation; all execution-package bytes are passive until the trusted gate completes. Old authority remains unchanged; no-replace fixed-pointer publication is crash-resumable and never overwrites.

The trust gate authenticates every schema, safe manifest member, path, mode, non-symlink property, reviewed/committed/canonical byte, commit topology, actual lock inode, pointer, and unrelated-state record before selecting trusted review helpers. The recovery validator authenticates explicitly named failure evidence and selected safe metadata without reading secret bytes, logs, container environment, or database contents. No broad glob, execution-package helper, or approval-derived initial trust anchor can select execution authority.

## 18. Sequential execution boundary

No parallel worker or agent may create or mutate containers, volumes, databases, roles, fixtures, evidence, or history. Tasks 5–9 execute sequentially on `vps-aylaspa` through the Aylaspa-only operator after the package gate passes. A failed gate leaves the task stopped and retained.

## 19. Current documentation-only stop

At this v17 review boundary, Task 5 is stopped after container start and before stable query readiness. The exact pending lane, zero-byte logging failure artifact, immutable old handoff, v5 approval, production/services/nginx/application, and unrelated Git state remain preserved. No Task 5 resume, Task 6, Task 10 publication, stage, commit, amend, push, approval creation/replacement, v17 fixed-pointer creation, old-pointer change, or runtime mutation is authorized.

This turn may only patch the two canonical documents, perform static/live read-only validation, retain the verified root-only v17 backup, run guarded adversarial simulations, and create one separate root-only v17 candidate review package. Independent v17 approval and a new non-merge exact-two-document direct-child commit are required before Task 10 can publish fixed pointers. Task 5 must then use the externally supplied review path and manifest SHA to authenticate `HANDOFF.recovery-v17.current`, actual lock inode, and retained failure lane before continuing only the first unfinished readiness boundary.
