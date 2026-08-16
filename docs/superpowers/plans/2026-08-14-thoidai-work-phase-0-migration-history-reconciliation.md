# THỜI ĐẠI WORK Phase 0: Migration-History Reconciliation Implementation Plan

> **Execution model:** Run sequentially through the Aylaspa-only operator on `vps-aylaspa`. Do not delegate runtime work or run database/container steps in parallel. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the exact application status of eleven THỜI ĐẠI WORK migration versions and reconcile them with `supabase_migrations.schema_migrations` only if every version becomes `exact-applied` under the all-or-nothing gate, without blindly replaying SQL, weakening password-reset/session protections, changing application routing, or exposing production identities or secrets.

**Architecture:** Quarantine the existing retained PostgreSQL container, volume, databases, secret, and Docker log as historical Tasks 1–4 evidence: no log read, no runtime session, and no mutation. After an immutable committed handoff package passes before any runtime creation, build a newly named PostgreSQL 17 container and volume from the pinned image with network mode `none`, no ports, log driver `none`, exact resource/security limits, and statement/error-statement logging disabled. Restore and normalize a fresh zero-row template, clone a new identity-free diagnostic database and a separate protected-shell successor, run both expected-negative paths only in that new lane with exact sanitized SQLSTATE `P0001`, and preserve the all-or-nothing STOP. Production remains SELECT-only and Task 8 contains zero history-write SQL.

**Tech Stack:** PostgreSQL 17, Supabase migration history, Docker, Bash, `psql`, `pg_dump`/`pg_restore`, Git, SHA-256 manifests, systemd, nginx, and non-interactive SSH to `vps-aylaspa`.

---

## Normative v8 recovery-correction addendum

This addendum supersedes the v5 forward-execution instructions for Task 5 re-entry and Task 10 publication. It does not alter the sealed Tasks 1?4 record or authorize execution in this documentation turn.

- The reviewed v7 commit is `464d17a652cdd622b5c20891e8f7fe24b55e6dd6`, with predecessor `f707279ad9028d452d871fddb39d4f0f767ca155`.
- The sealed v5 execution package remains `/opt/thoidai-reconciliation/phase0-execution-handoff-20260815T041006Z-2be71271104d`; its `SHA256SUMS` hash is `30d3fc6fd40f736441fe3ec3f089ff5bf5c4e3b3525613094ab245e70011b04a`. The existing `HANDOFF.current` bytes have SHA-256 `a7e4ef17ee3eaa00bacc6693772940b5308390fcbd9ef4c2275ec9b788c01005`.
- The v5 approval remains immutable at `/opt/thoidai-reconciliation/phase0-v5-primary-review.approved.tsv`, SHA-256 `f89cd838975607400b34aea15c3db8e079ed950837da1774e7b7078acc7025aa`. A v8 review/approval is additive and may not replace this file or weaken its exact package binding.
- The only recoverable Task-5 lane is `/opt/thoidai-reconciliation/phase0-v5-execution-20260815T041430Z-7fa3f327f5c8`, selected by the regular root-owned mode-0600 pointer `/opt/thoidai-reconciliation/phase0-v5-execution.pending`, whose bytes have SHA-256 `d6c20209be2254dc9cb2788c6ad495ecb372516dd905b2c8e4cd7a76b5779af9`.
- Its retained identities are container `thoidai_phase0_v3_cd3186598cd4` with ID `c8d8916b639cb40ae19d7dfeeb0cf43bf52edea51ca4dc4be1e4e34dcd1ffc4c`, volume `thoidai_phase0_v3_data_cd3186598cd4`, and databases `phase0_fresh_cd3186598cd4`, `phase0_diag_cd3186598cd4`, and `phase0_successor_cd3186598cd4`.
- The preserved failure-state fingerprint is `130455a0a92ca76d0372410d4ad60d67d7e8866985f64b5be2cf11a175617faa`. It covers exact pending/approval metadata and old-handoff bytes, the exact byte hashes and metadata of the 27 named non-secret recovery files, secret metadata without reading or hashing secret bytes, absent seals/current pointer, selected container metadata, and selected volume metadata.
- Blocks 1?3 completed. Block 4 started the exact retained container, then `pg_isready` passed while the immediately following `psql` logging query failed. `postgres-logging.actual.tsv` is therefore an intentional zero-byte failure artifact. Restore, fidelity sealing, database creation, and Task-5 completion never began.

While the pending pointer exists, creating or replacing an execution directory, secret, volume, container, name allocation, or pending pointer is forbidden. Re-entry must authenticate a reviewed v8 handoff, bind the exact retained lane and failure fingerprint, establish three consecutive composite readiness observations, and continue only at that first unfinished boundary. Any unexpected path, symlink, owner/mode, byte, container/volume identity, seal, database, role, object, or partial later boundary stops without restart, stop, removal, log access, cleanup, or fallback.

## Normative v9 executable-correction addendum (superseded by v10; historical)

This v9 addendum supersedes the v8 Task-5 re-entry and Task-10 republication procedures while preserving every v8 historical fact and invariant. It adds five mandatory controls: complete executable Task-10 blocks; per-command GNU `timeout --foreground` bounds nested inside the overall readiness deadline; exact member/schema sealing plus kernel `renameat2` no-replace/exchange publication; deterministic exact-destination mount serialization that rejects missing, duplicate, or extra mounts while preserving the immutable failure fingerprint; and a live, sanitized, credential-mount-bound catalog/role boundary in `RECOVERY-VERIFY.sh`. No v9 checkbox was authorized in that documentation turn, and no v9 approval or execution pending pointer exists.

The superseded v9 design required a new non-merge two-document child of `464d17a652cdd622b5c20891e8f7fe24b55e6dd6`, never an amend; it reserved `/opt/thoidai-reconciliation/phase0-v9-reentry-review.approved.tsv` and the `phase0-v9-execution-handoff-<UTC>-<12hex>` grammar. Neither v9 authority artifact exists. The old v5 approval, old handoff package, live Task-5 pending pointer, retained recovery path, failure fingerprint `130455a0a92ca76d0372410d4ad60d67d7e8866985f64b5be2cf11a175617faa`, and runtime identities remain immutable.

## Normative v10 byte-clean, lock-scoped, rollback-safe addendum (superseded by v11; historical)

This v10 addendum supersedes the active v9 Task-5 handoff-authentication and Task-10 republication procedure while preserving every sealed v5-v9 historical fact, authority byte, failure fingerprint, runtime identity, and `readiness-v9` boundary. The sealed v9 review package is immutable even though its `VERIFY.sh` contains two literal carriage-return bytes; it is historical evidence and is never edited in place or reused as a v10 payload.

Every v10 review/execution text payload, helper, manifest, pointer, and history record must be a regular non-symlink file with zero CR bytes, zero NUL bytes, and one final LF. Publication must include negative tests that reject CR, NUL, and missing-final-LF inputs. The complete helper gate first runs through a private `.phase0-v10-candidate-pointer.<random>` and that exact inode/content hash is removed before the sticky top-level `phase0-v10-execution-handoff.pending` pointer is created with `RENAME_NOREPLACE`.

One complete Task-10 shell block holds a fixed root-only exclusive `flock` from the first byte/authority precheck through package sealing, private prepublication verification, pending publication/reverification, prepared-history fsync, `HANDOFF.current` exchange, both postpublication helpers, final manifests/fsync, and final postverification. History is prepared before the authoritative exchange and rollback is armed before `RENAME_EXCHANGE`; the exchanged A pointer remains available through every post-exchange gate. A normal failure restores A. If a non-cooperating writer has already changed the authoritative pointer from C to B, cleanup preserves B and never reinstates or leaves C authoritative. Candidate/pending cleanup may unlink only the exact recorded device/inode and byte hash; any identity or content mismatch is retained and fails closed.

The bounded recovery boundary performs separate `test -f` and `test -r` probes against the exact credential bind path, retains the exact bind-source/mode checks, and never reads credential bytes or changes authentication. The future corrective commit remains a new non-merge two-document direct child of `464d17a652cdd622b5c20891e8f7fe24b55e6dd6`, never an amend. The additive approval is `/opt/thoidai-reconciliation/phase0-v10-reentry-review.approved.tsv`; reviewed packages use `review-runbook-v10-<UTC>-<12hex>`, execution packages use `phase0-v10-execution-handoff-<UTC>-<12hex>`, and the immutable failure-state SHA-256 remains `130455a0a92ca76d0372410d4ad60d67d7e8866985f64b5be2cf11a175617faa`. No v10 checkbox was authorized in that documentation turn; its review package remains non-authoritative and no v10 approval or publication pointer exists.

## Normative v11 immutable-old-authority and crash-resumable publication addendum (superseded by v12; historical)

v11 supersedes the active v10 handoff architecture while preserving the entire v5-v10 historical record, all v9 recovery gates, byte-hygiene rules, exact Task-5 pending lane, failure fingerprint, and runtime identities. `/opt/thoidai-reconciliation/HANDOFF.current` is now immutable evidence: Task 10 and re-entry never write, chmod, rename, exchange, replace, or remove that pathname. Its bytes must remain SHA-256 `a7e4ef17ee3eaa00bacc6693772940b5308390fcbd9ef4c2275ec9b788c01005` and continue to name the old sealed package.

Corrected authority uses only two previously absent fixed paths: `/opt/thoidai-reconciliation/phase0-v11-execution-handoff.pending` and `/opt/thoidai-reconciliation/HANDOFF.recovery-v11.current`. Each is published exactly once with kernel `RENAME_NOREPLACE`, followed immediately by an fsync of `/opt/thoidai-reconciliation`. Foreign or malformed preexistence fails closed without changing or deleting it. There is no pathname cleanup, unlink, exchange, rollback, overwrite, or move-old-pointer branch; unique package/candidate artifacts are retained as evidence.

Before package sealing, both candidate pointer files already contain the final package path. `PUBLICATION.tsv`, `HISTORY.tsv`, and `COMMIT.tsv` cross-bind their absolute paths, device/inode identities, full byte hashes, the two fixed targets, the immutable old pointer, and the read-only lock inode. The crash-resumable authoritative states are only: neither new target exists; the exact pending target exists while current is absent; or both exact pending/current targets exist. Rerun validates package, additive approval, corrective commit, failure state, device/inode, bytes, and candidate state before acting. Pending-only resumes verification and no-replace current publication. Exact current is verification-only and idempotent. Current-without-pending, foreign identity, conflicting bytes, missing candidate, or any other state stops.

Task-5 Step 1R must prove the original Task-5 pending pointer and failure fingerprint through the reviewed recovery verifier before it reads `HANDOFF.recovery-v11.current`; it never treats `HANDOFF.current` as corrected authority. The future corrective commit remains a new non-merge exact-two-document direct child of `464d17a652cdd622b5c20891e8f7fe24b55e6dd6`, never an amend. v11 uses additive approval `/opt/thoidai-reconciliation/phase0-v11-reentry-review.approved.tsv`, review grammar `review-runbook-v11-<UTC>-<12hex>`, and execution grammar `phase0-v11-execution-handoff-<UTC>-<12hex>`. No v11 checkbox is authorized in this documentation turn.

## Normative v12 anonymous-inode publication and passive-consumer addendum (superseded by v13; historical)

v12 supersedes the active v11 publication and consumer architecture while preserving every v5-v11 historical artifact, the exact Task-5 pending lane, the failure fingerprint, the old `HANDOFF.current`, the v5 approval, runtime identities, and the unrelated Git fingerprint. The v11 candidate package and its fixed paths remain non-authoritative historical review material and are never created or reused by v12.

Corrected authority uses only `/opt/thoidai-reconciliation/phase0-v12-execution-handoff.pending` and `/opt/thoidai-reconciliation/HANDOFF.recovery-v12.current`. There is no pathname-addressed candidate. Initial publication writes and fsyncs the final one-line pointer into an anonymous inode created by `O_TMPFILE` on the reconciliation filesystem, validates that open inode, then uses `linkat(AT_EMPTY_PATH)` to create pending with no-replace semantics. Pending-only publication opens and pins the already authenticated pending inode and links that same inode to current. Exact current therefore requires both fixed paths to be hard links to one regular root-owned mode-0600 inode with the approved bytes.

An `EEXIST` from initial pending publication never falls through to package C. It performs no current mutation; the parent discards C as authority, fsyncs the base directory, reopens and passively authenticates the winning pending pointer, and binds the package named by that pinned inode before considering current. Thus a valid late-arriving package B can produce only B-pending/B-current, never B-pending/C-current. Every pending-only entry, including recovery from a crash after the pending link but before its first directory fsync, performs `fsync_dir /opt/thoidai-reconciliation` before current publication.

No helper selected from an execution pointer may run merely because that package verifies against its own manifest. Step 1R, the Task-5 final gate, and Task 10 first validate the additive v12 approval and its manifest-sealed trusted review package; then they passively compare the execution package's `REVIEW-V12.tsv`, `FAILURE-STATE.tsv`, `VERIFY.sh`, `RECOVERY-VERIFY.sh`, `PUBLISH.py`, plan, and design against external approval/trusted review bytes. Only the trusted review-package copies may execute after every comparison succeeds. v12 uses additive approval `/opt/thoidai-reconciliation/phase0-v12-reentry-review.approved.tsv`, review grammar `review-runbook-v12-<UTC>-<12hex>`, and execution grammar `phase0-v12-execution-handoff-<UTC>-<12hex>`. No v12 checkbox is authorized in this documentation turn.

## Normative v13 externally anchored trust, lock binding, and executable-simulation addendum (superseded by v14; historical)

v13 supersedes the active v12 consumer and verification procedure while retaining v12's anonymous-inode `O_TMPFILE` plus `linkat(AT_EMPTY_PATH)` no-replace publication primitive. Every v5-v12 artifact remains immutable historical evidence. The old `HANDOFF.current`, v5 approval, Task-5 pending pointer, retained runtime lane, failure fingerprint, Git predecessor, and unrelated-state fingerprint are unchanged.

The trust root is supplied to each consumer as two independent operator inputs: the exact absolute v13 review-package path and the exact SHA-256 of that package's `SHA256SUMS`. Neither value may first be read or derived from the additive approval. Before approval or execution-package interpretation, the consumer validates the anchored review path, metadata, manifest hash, exact manifest member names and order, safe basenames, hash syntax, member metadata, and member digests. The exact 22-key approval adds `lock_path` and `lock_device_inode`. `TRUST-POLICY.tsv`, approval, `COMMIT.tsv`, `HISTORY.tsv`, and the actual device/inode of immutable `HANDOFF.current` must all bind the same lock.

`TRUST-GATE.py` is the sole consumer entry point. It treats every execution package as passive data: it rejects traversal, duplicate, extra, malformed, CR/NUL-bearing, or unterminated manifest/payload input before any execution-package helper can run; compares approval, failure state, plan, design, publisher, both validators, trust gate, and policy byte-for-byte with externally trusted sources; validates the exact 22/26/13/8 approval/commit/history/publication schemas and all pointer/package/lock bindings; and only then executes trusted review-package copies of `VERIFY.sh` and `RECOVERY-VERIFY.sh`. Step 1R, Task 10, and the Task-5 final gate use that order. At the final gate, live trusted recovery verification is the last command before creation of `TASK5.COMPLETE`.

v13 reserves additive approval `/opt/thoidai-reconciliation/phase0-v13-reentry-review.approved.tsv`, review grammar `review-runbook-v13-<UTC>-<12hex>`, execution grammar `phase0-v13-execution-handoff-<UTC>-<12hex>`, and fixed authority paths `/opt/thoidai-reconciliation/phase0-v13-execution-handoff.pending` plus `/opt/thoidai-reconciliation/HANDOFF.recovery-v13.current`. Simulation-only fault and barrier hooks in `PUBLISH.py` are inert unless guarded by an exact root-owned mode-0600 `.ALLOW_V13_SIMULATION` inside a `.phase0-v13-simulation-*` tree. Real subprocess tests must exercise six crash exits, deterministic recovery, a late-writer race, traversal and text-byte rejection, and a malicious execution-helper side effect that never occurs. No v13 checkbox is authorized in this documentation turn.

The first sealed v13 candidate is retained as non-authoritative historical review material. Its gate emitted success status after live recovery returned, so recovery was not literally its final successful gate command.

## Normative v14 literal-final-recovery and externally anchored trust addendum (superseded by v15; historical)

v14 preserves every v13 passive-trust, manifest, lock-binding, and anonymous-inode publication control, but supersedes all active v13 names and consumers. The operator supplies the exact v14 review-package path and its exact `SHA256SUMS` SHA-256 independently before approval interpretation. The 22/26/13/8/19 approval, commit, history, publication, and policy schemas bind v14 fixed paths and the actual immutable lock inode.

`TRUST-GATE.py` emits and flushes passive status before invoking any trusted helper. For `--action both`, trusted `VERIFY.sh` runs first and the successful live trusted `RECOVERY-VERIFY.sh` invocation is returned directly as the final gate call: there is no later output, command, trap, cleanup, mutation, or implicit shell branch before the caller creates `TASK5.COMPLETE`. Execution-package helpers remain passive bytes and never execute.

v14 reserves approval `/opt/thoidai-reconciliation/phase0-v14-reentry-review.approved.tsv`, review grammar `review-runbook-v14-<UTC>-<12hex>`, execution grammar `phase0-v14-execution-handoff-<UTC>-<12hex>`, and fixed authority paths `/opt/thoidai-reconciliation/phase0-v14-execution-handoff.pending` plus `/opt/thoidai-reconciliation/HANDOFF.recovery-v14.current`. Simulation guards and subprocess fault/race namespaces are v14-only. No v14 checkbox is authorized in this documentation turn.

## Normative v15 staged recovery and single-owner completion addendum (superseded by v16; historical)

v15 supersedes every active v14 consumer, pathname, helper namespace, and completion procedure while preserving the sealed v14 review package as immutable historical evidence. The only active additive approval is `/opt/thoidai-reconciliation/phase0-v15-reentry-review.approved.tsv`; active review and execution grammars are `review-runbook-v15-<UTC>-<12hex>` and `phase0-v15-execution-handoff-<UTC>-<12hex>`; active fixed authority paths are `phase0-v15-execution-handoff.pending` and `HANDOFF.recovery-v15.current`. The exact approval/commit/history/publication/policy schemas are `22/26/13/8/19`, and `HISTORY.tsv` binds `commit_head`, `commit_tree`, and `commit_parent` to authenticated `COMMIT.tsv`.

All external manifests are parsed as passive text before `sha256sum -c`: exact root ownership/mode, exact member set/order, safe basename grammar, lowercase 64-hex digest syntax, zero CR/NUL, final LF, regular non-symlink members, and member metadata are mandatory. Execution-package helpers never run. Late authority B may enter only by a fresh `TRUST-GATE.py` invocation; no caller checksum branch may select or execute it.

`RECOVERY-VERIFY.sh` has explicit `pre-resume` and `pre-completion` stages. The first binds the immutable failure-state SHA/member set, old package, v5 approval, Task-5 pending pointer, retained runtime boundary, credential metadata, and exact unadvanced catalog; `readiness-v15`, restore, fidelity, completion, and Task-5 current are absent. The second rebinds original immutable rows, exact `readiness-v15` including timeout/consecutive-counter reset policy, exact RESTORE/ACL/ROLE/FIDELITY manifests, live role/membership/forbidden-role/three-owner equality, and absent completion/current state.

Every Task-5 completion input is durable before the pre-completion gate: pointer bytes/SHA, pinned anonymous inode, `TASK5-CURRENT.tsv`, exact `TASK5-PUBLISH-ARGS.tsv`, and sorted `TASK5-PRECOMPLETE-SHA256SUMS`. After trusted pre-completion recovery, the literal next command is `PUBLISH.py completion`; that publisher alone creates/fsyncs `TASK5.COMPLETE`, final manifest, and no-replace `phase0-v5-execution.current`. Exact rerun resumes crash points 111-114; current-only, foreign marker/current/pin/binding/args, and equal bytes on a distinct inode fail closed.

Task 10 precomputes publisher arguments from authenticated constants in each package/pending/current branch. Its successful recovery gate and corresponding `PUBLISH.py initial`, `current`, or `verify` command are adjacent with no assertion, cleanup, or package-selected helper between them. Task 9 compares Git only with the authenticated post-commit COMMIT/HISTORY head-tree-parent tuple, never `head.before` or `tree.before`. The real guarded SIMULATE matrix must finish `adversarial_simulation|CLEAN` before v15 installation.

## Normative v16 centralized manifest trust, resumable preparation, and freshly authenticated preservation addendum (superseded by v17; historical)

v16 was the sole active authority for its review turn. Approval/review/execution/pointer/simulation names were v16-only and approval/commit/history/publication/policy schemas were exactly `22/26/13/8/19`; all v12-v15 authority wording remained immutable history. `SAFE_MANIFEST.py` centralized active external, review, execution, old-package, and verify-source checksum parsing before digest operations.

Task-5 completion preparation became an exact crash-resumable prefix: pinned pointer, binding, publisher arguments, then precompletion manifest. Each object used `O_TMPFILE`, write-all, file fsync, `linkat(AT_EMPTY_PATH)` no-replace, and directory fsync; fault exits 121-132 covered every prepare boundary, and crash 113 recovery repaired base-directory durability before success.

Task 9 freshly authenticated the v16 current pointer before reading COMMIT/HISTORY, remeasured the redacted provider/model and routing state, and the guarded real simulation exercised VERIFY, staged recovery, adjacency, and malicious-helper rejection.

## Normative v17 final manifest-writer and inode-race closure addendum

v17 is the sole active authority. Approval/review/execution/pointer/simulation names are v17-only and approval/commit/history/publication/policy schemas remain exactly `22/26/13/8/19`. The six executable manifest-writer paths now call one identical `write_manifest` implementation: members are unique sorted safe basenames, rows use exactly one ASCII space, member bytes are read only through the externally anchored `SAFE_MANIFEST.py`, and the migration-source manifest binds an explicit root-owned mode-0755 source directory with mode-0644 SQL members.

All five standalone consumers use byte-identical `review_exec`, `safe_manifest_check`, and `write_manifest` blocks in the same order. The bootstrap binds directory and member file descriptors with `O_NOFOLLOW`, stable `fstat`, and name-to-inode rechecks; it maps manifest names to digests before executing only sealed review helpers and converts open/stat races into exit 41. Task 9 retains fresh current gating before COMMIT/HISTORY/TASK5 interpretation.

The guarded real simulation must reject bootstrap, central-manifest, and publisher symlink/member-swap/directory-or-pointer-inode-rebind attacks; the malicious bootstrap target remains absent. It also retains pointer exits 91-96, completion exits 111-114, prepare exits 121-132, late-writer B preservation, real staged recovery, traversal/text negatives, and literal gate-to-publisher adjacency, ending only with `adversarial_simulation|CLEAN`.

## Scope boundary

This runbook targets only these eleven versions and exact source files:

| Version | Source file | SHA-256 | Audited source state |
|---|---|---|---|
| `20260813172000` | `supabase/migrations/20260813172000_task_plans_recipients_self_claim.sql` | `dfc8eee060abf1c9b1f7322521152ce123f304a2095493f6d70e26fe17785a3f` | untracked |
| `20260813210000` | `supabase/migrations/20260813210000_password_reset_security.sql` | `a87f815d5494eb733f525917053f1668875aa9d0c03b38c326387a9312a58212` | tracked |
| `20260813220000` | `supabase/migrations/20260813220000_task_evaluation_total_score.sql` | `0c605442e6b40f3114f931791b1620cd4f8c486b9a0557171b0fe83f04f36105` | untracked |
| `20260813230000` | `supabase/migrations/20260813230000_admin_role_user_policy.sql` | `465b99f9333c52c55fd4ea0821fb0e1e151ff2e8f855610dbf1061124ff397e6` | untracked |
| `20260813233000` | `supabase/migrations/20260813233000_tbt_evaluation_guard.sql` | `064a215f15aa9855ec2568796adf9ceefb992d842d0b809ad341690219688978` | untracked |
| `20260813234500` | `supabase/migrations/20260813234500_creator_evaluation_guard.sql` | `186b20cae2f1b940bb5ebabe3ef622daac852d15952b0f3903d735a1946f8d8b` | untracked |
| `20260814070000` | `supabase/migrations/20260814070000_job_titles.sql` | `191ce77f3d978bee56425589b0735c807b088327134eca122518e75890f77e3a` | untracked |
| `20260814102000` | `supabase/migrations/20260814102000_bulk_task_plans.sql` | `b3ae48c9ede223f92823827a813fa6409a90c797d5b37eea45683b3f4b1a5931` | untracked |
| `20260814130000` | `supabase/migrations/20260814130000_staff_list_order.sql` | `69a8105146379aa57bd9449b909a6898caa87955a637a0385990c2b352b42213` | untracked |
| `20260814160000` | `supabase/migrations/20260814160000_employee_password_reset_admin.sql` | `21198e8092da7a557fc9351aaa5fd8cf02fa7217acabc543561f824eb9a28dbb` | tracked |
| `20260814170000` | `supabase/migrations/20260814170000_employee_password_reset_hardening.sql` | `5583bfa2cf1af13f88e11fce3a58d6afd2c87172f8ce1d837c9c4d649837c533` | tracked |

Five recorded companion versions must be replayed in chronological order on the isolated replay database because they change the same object chain, but this runbook never inserts or alters their history rows:

| Version | Source file | SHA-256 | Production history count |
|---|---|---|---|
| `20260813110000` | `supabase/migrations/20260813110000_task_evaluation_checkpoints.sql` | `8dc597934a90f01e43b0ff68723daf50b0e361e8f8e362f3bd4ed986384c24f7` | `1` |
| `20260813155000` | `supabase/migrations/20260813155000_allow_tbt_task_evaluation.sql` | `e64047bbde866727e42dc20d58bd64d9e4950a02c5d2e99d003137fc4ec7c5c0` | `1` |
| `20260813184000` | `supabase/migrations/20260813184000_secure_task_rpc_execution.sql` | `6a412f010049c120d06167e6f1622e0923a73401f50dc234f4f1ae20b4353879` | `1` |
| `20260814090000` | `supabase/migrations/20260814090000_task_priority_neutral_default.sql` | `f2d9e4e5ba2a627d70fcf45751e9a05bd8077e4eecc8fe5dab094c8624e293a7` | `1` |
| `20260814113000` | `supabase/migrations/20260814113000_localize_role_names.sql` | `b0c90ccf46a75dca2d6ace9d3d56cd730500853996d44942ceb5e347a6be03c6` | `1` |

Explicit non-goals:

- Never run `supabase db push`, bulk migration application, or an unreviewed `supabase migration repair`.
- Never replay a production migration merely because its history row is absent.
- Never print or persist plaintext passwords, password hashes, reset tokens, session cookies, API keys, environment values, staff identities, emails, task titles, or migration statement bodies.
- Never copy production rows into the isolated cluster. Its restore is schema-only and its fixtures are synthetic.
- Never stage, commit, revert, stash, reset, clean, or overwrite unrelated dirty-root paths.
- Never change employee password-reset behavior, `session_version`, the active provider/model, CLIProxyAPI, `9router`, systemd units, nginx configuration, application source, or the active build.
- Never remove the retained isolated container, named volume, password file, prior disposable databases, or backups; never delete migration-history rows, restart a service, or restore a database without the separately required authorization for that action.

## Audited starting evidence

- Approved Phase-1 plan commit: `b2916c1a0a5c06ffea1a95414c6ae2cd7fc50485`.
- Production database container: `supabase_db_thoidai-work`; no environment inspection is permitted.
- Production `schema_migrations` currently has nine rows. Its columns are `version text not null`, `statements text[]`, and `name text`; all existing rows have non-null names and statement arrays.
- Every target version has production history count `0`; every companion version has count `1`.
- All eleven target source files exist with the hashes above. Three are tracked and eight are untracked, so checksum evidence—not assumed Git provenance—is mandatory.
- The selected production columns, indexes, constraints, triggers, RLS flags, policies, and RPC signatures exist. Terminal `pg_proc.prosrc` MD5 values match the corresponding terminal source bodies for all thirteen audited functions.
- Production aggregate evidence contains no invalid task compatibility rows, no evaluation score mismatch, no missing password hashes, no legacy password values, no invalid session epochs, no invalid job-title references, and exactly three positive list-order slots with values `1..3`; identities were not read or emitted.
- The current TBT permission flags differ from the literal `20260813230000` end state. This is an unresolved chain/supersession question, not permission to label that version partial or to replay it.
- `20260813210000` contains protected one-time identity/credential DML whose exact historical execution cannot be proven from safe aggregate output alone.
- `20260813233000` is fully superseded at the same function/grant boundary by `20260813234500`; terminal state alone cannot prove the earlier file executed.
- Root-only production apply evidence exists for `20260814160000` and `20260814170000`, with matching source SHA-256, single-transaction exit `0`, no bulk push, and no history repair.

## Decision taxonomy and all-or-nothing gate

Each target gets exactly one classification:

1. `exact-applied`: exact source checksum is locked; all durable object/data/grant effects match the terminal chronological chain; any superseded effect has trusted execution evidence or a rollback-clean exact replay; and protected one-time DML is proven without exposing values.
2. `semantically-applied-but-source-differs`: intended behavior is present, but source/catalog/data fingerprints differ or a one-time effect cannot be proven exact. Do not mark applied. Record a forward-only superseding migration or approved decision record first. A decision record alone never upgrades this category or authorizes a history row; exact execution/evidence must independently satisfy every `exact-applied` requirement.
3. `partially-applied`: only some required effects exist or an intended postcondition is false. Do not replay blindly and do not mark applied. Build a separately reviewed forward-only completion migration or, only after all replay gates pass, execute the exact source transactionally.
4. `not-applied`: no reliable required effects exist. Do not mark applied. Schedule the normal forward migration under a separate reviewed execution.

History repair is all-or-nothing for these eleven versions. If even one row is not `exact-applied`, stop with zero history writes.

## Locked execution artifacts

Completed Tasks 1–4 and the measured stop are sealed at `/opt/thoidai-reconciliation/phase0-20260814T135943Z`. Their dump, archive, manifests, retained container/volume/secret/databases, and log are quarantine inputs: never regenerated, queried, read for log content, hashed for log content, deleted, truncated, renamed, restarted, or rewound. Corrected execution creates a separate mode-0700 evidence directory, separate secret, separate named volume, separate no-log container, one fresh template, one identity-free diagnostic clone, and one successor clone. No repository source file is created or modified by runtime execution, and no image pull, package installation, production-row copy, or automatic cleanup is permitted.

## Approved design coverage

| Design boundary | Implementation location |
|---|---|
| Quarantine of retained container/volume/database/log | Task 4 corrected failure branch; Task 5 Steps 2 and 6; Task 9 Step 2 |
| Immutable committed-package gate | Task 5 Step 1; Task 10 |
| New pinned-image no-log lane | Task 5 Steps 3–4 |
| Fresh template plus diagnostic/successor clones | Task 5 Step 5 |
| Selector containment and successor-only fixture | Task 6 Step 1 |
| Exact sanitized `P0001` in both negative paths | Task 6 Steps 2–3 |
| Chronological replay and safe idempotency | Task 6 Steps 3–4 |
| Four-class taxonomy and mandatory STOP | Task 7 |
| Unreachable zero-SQL history boundary | Task 8 |
| Production, provider/routing/build, quarantine, and lane preservation | Task 9 |
| Post-review/post-commit atomic handoff | Task 10 |

---

## Task 1: Freeze Git, source, history, and preservation baselines

**Status:** Completed and sealed at `/opt/thoidai-reconciliation/phase0-20260814T135943Z`; verify but do not regenerate this evidence.

**Files:**
- Verify: `/opt/thoidai-work/supabase/migrations/*.sql`
- Existing outside Git: `/opt/thoidai-reconciliation/phase0-20260814T135943Z/*`
- No repository modification

- [x] **Step 1: Prove the approved source ancestry and capture the dirty-root fingerprint**

Run on `vps-aylaspa`:

```bash
set -euo pipefail
cd /opt/thoidai-work
git merge-base --is-ancestor b2916c1a0a5c06ffea1a95414c6ae2cd7fc50485 HEAD
test "$(git diff --cached --name-only | wc -l)" -eq 0
stamp=$(date -u +%Y%m%dT%H%M%SZ)
evidence_root="/opt/thoidai-reconciliation/phase0-$stamp"
install -d -m 0700 "$evidence_root"
git rev-parse HEAD > "$evidence_root/head.before"
git rev-parse HEAD^{tree} > "$evidence_root/tree.before"
git status --porcelain=v1 --untracked-files=all > "$evidence_root/root-status.before"
sha256sum "$evidence_root/root-status.before" > "$evidence_root/root-status.before.sha256"
printf '%s\n' "$evidence_root" > /opt/thoidai-reconciliation/phase0.latest
chmod 0600 "$evidence_root"/* /opt/thoidai-reconciliation/phase0.latest
```

Expected: ancestry and empty-index checks exit `0`; only root-readable aggregate/status evidence is written. Never print `root-status.before` because it may contain unrelated path names.

- [x] **Step 2: Lock the exact sixteen-file chronological source manifest**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
repo=/opt/thoidai-work
source_root=$repo/supabase/migrations
source_members=(
  20260813110000_task_evaluation_checkpoints.sql
  20260813155000_allow_tbt_task_evaluation.sql
  20260813172000_task_plans_recipients_self_claim.sql
  20260813184000_secure_task_rpc_execution.sql
  20260813210000_password_reset_security.sql
  20260813220000_task_evaluation_total_score.sql
  20260813230000_admin_role_user_policy.sql
  20260813233000_tbt_evaluation_guard.sql
  20260813234500_creator_evaluation_guard.sql
  20260814070000_job_titles.sql
  20260814090000_task_priority_neutral_default.sql
  20260814102000_bulk_task_plans.sql
  20260814113000_localize_role_names.sql
  20260814130000_staff_list_order.sql
  20260814160000_employee_password_reset_admin.sql
  20260814170000_employee_password_reset_hardening.sql
)
write_manifest "$evidence_root/source.sha256" \
  --member-root "$source_root" --member-root-mode 755 --member-mode 644 \
  "${source_members[@]}"
```

Expected: sixteen `OK` lines. Any missing or mismatched file is a stop; do not choose a nearby migration or edit a source file.

- [x] **Step 3: Verify tracked/untracked provenance without changing it**

```bash
set -euo pipefail
cd /opt/thoidai-work
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
git ls-files -- \
  supabase/migrations/20260813210000_password_reset_security.sql \
  supabase/migrations/20260814160000_employee_password_reset_admin.sql \
  supabase/migrations/20260814170000_employee_password_reset_hardening.sql \
  > "$evidence_root/tracked-targets.txt"
test "$(wc -l < "$evidence_root/tracked-targets.txt")" -eq 3
git status --porcelain=v1 --untracked-files=all -- supabase/migrations \
  | grep -E '20260813(172000|220000|230000|233000|234500)|20260814(070000|102000|130000)' \
  > "$evidence_root/untracked-targets.txt"
test "$(wc -l < "$evidence_root/untracked-targets.txt")" -eq 8
chmod 0600 "$evidence_root/tracked-targets.txt" "$evidence_root/untracked-targets.txt"
```

Expected: three tracked and eight untracked target paths, exactly as audited. A later byte-identical baseline commit may change provenance, but it must preserve every source SHA-256 and be recorded before execution resumes.

- [x] **Step 4: Prove target history is absent and companion history is present**

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
with target(version,expected) as (values
 ('20260813110000',1),('20260813155000',1),('20260813172000',0),
 ('20260813184000',1),('20260813210000',0),('20260813220000',0),
 ('20260813230000',0),('20260813233000',0),('20260813234500',0),
 ('20260814070000',0),('20260814090000',1),('20260814102000',0),
 ('20260814113000',1),('20260814130000',0),('20260814160000',0),
 ('20260814170000',0)
)
select target.version,target.expected,count(sm.version)
from target left join supabase_migrations.schema_migrations sm using(version)
group by target.version,target.expected
order by target.version;" > "$evidence_root/history.before.tsv"
chmod 0600 "$evidence_root/history.before.tsv"
test "$(awk -F '|' '$2!=$3{bad++} END{print bad+0}' "$evidence_root/history.before.tsv")" -eq 0
```

Expected: sixteen metadata-only rows and zero expected/actual mismatches. Any target already present or companion missing is a stop.

- [x] **Step 5: Commit no source change**

There is deliberately no Git commit in Phase-0 execution. Re-run:

```bash
cd /opt/thoidai-work
test "$(git diff --cached --name-only | wc -l)" -eq 0
```

Expected: `0`.

## Task 2: Create root-only recovery and pre-change evidence

**Status:** Completed and sealed at `/opt/thoidai-reconciliation/phase0-20260814T135943Z`; verify but do not regenerate this evidence.

**Files:**
- Create outside Git: `$evidence_root/database.full.dump`
- Create outside Git: `$evidence_root/*.before.tsv`
- No repository modification

- [x] **Step 1: Verify the exact production target and service baseline**

```bash
set -euo pipefail
test "$(systemctl is-active thoidai-work)" = active
test "$(systemctl is-active nginx)" = active
nginx -t
test "$(docker inspect -f '{{.State.Running}}' supabase_db_thoidai-work)" = true
docker exec supabase_db_thoidai-work pg_isready -U postgres -d postgres
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
systemctl show thoidai-work -p NRestarts --value > "$evidence_root/nrestarts.before"
chmod 0600 "$evidence_root/nrestarts.before"
```

Expected: application, nginx, and database are healthy; `NRestarts` is a non-negative integer. Do not read container environment variables.

- [x] **Step 2: Create and validate a full root-only production database backup**

```bash
set -euo pipefail
umask 077
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
install -m 0600 /dev/null "$evidence_root/database.full.dump"
docker exec supabase_db_thoidai-work pg_dump -U postgres -d postgres --format=custom \
  > "$evidence_root/database.full.dump"
test "$(stat -c '%a' "$evidence_root/database.full.dump")" = 600
docker exec -i supabase_db_thoidai-work pg_restore --list \
  < "$evidence_root/database.full.dump" >/dev/null
sha256sum "$evidence_root/database.full.dump" > "$evidence_root/database.full.dump.sha256"
chmod 0600 "$evidence_root/database.full.dump.sha256"
```

Expected: PostgreSQL-17 `pg_dump`, the matching container `pg_restore --list`, and checksum commands exit `0`. The older host `pg_restore` is not used. Never inspect or print dump contents. Never delete or restore this dump during normal reconciliation.

- [x] **Step 3: Preserve source provenance without copying migration bodies**

```bash
set -euo pipefail
umask 077
cd /opt/thoidai-work
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
safe_manifest_check "$evidence_root/source.sha256"
git rev-parse HEAD > "$evidence_root/source-head.txt"
git rev-parse HEAD^{tree} > "$evidence_root/source-tree.txt"
sha256sum "$evidence_root/source.sha256" "$evidence_root/source-head.txt" \
  "$evidence_root/source-tree.txt" > "$evidence_root/source-provenance.sha256"
chmod 0600 "$evidence_root/source-head.txt" "$evidence_root/source-tree.txt" \
  "$evidence_root/source-provenance.sha256"
```

Expected: exact source hashes and Git provenance are retained without creating another copy of migration bodies. The production root and the pre-existing approved backups remain the recovery sources; Phase 0 never edits a migration file.

- [x] **Step 4: Capture password/session and business aggregate invariants**

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select
 (select count(*) from public.tasks),
 (select count(*) from public.staff_users),
 (select count(*) from public.staff_users where password_hash is null or password_hash=''),
 (select count(*) from public.staff_users where password is not null),
 (select count(*) from public.staff_users where session_version is null or session_version<0),
 (select coalesce(sum(session_version),0) from public.staff_users),
 (select count(*) from public.password_reset_tokens),
 (select count(*) from public.password_reset_tokens where used_at is null),
 (select count(*) from public.password_reset_attempts),
 (select count(*) from public.task_evaluation_checkpoints),
 (select count(*) from public.task_evaluation_checkpoints
   where total_score is distinct from rating*effort_weight),
 (select count(*) from public.job_titles),
 (select count(*) from public.staff_users su left join public.job_titles jt on jt.id=su.job_title_id
   where su.job_title_id is not null and jt.id is null),
 (select count(*) from public.staff_users where list_order<0),
 (select count(*) from public.staff_users where list_order>0),
 (select count(distinct list_order) from public.staff_users where list_order>0);
" > "$evidence_root/aggregates.before.tsv"
chmod 0600 "$evidence_root/aggregates.before.tsv"
test "$(wc -l < "$evidence_root/aggregates.before.tsv")" -eq 1
```

Expected: one aggregate-only row. No identity, email, password material, token, or business-row value is emitted.

- [x] **Step 5: Checksum the immutable pre-change evidence set**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
write_manifest "$evidence_root/PRECHANGE-SHA256SUMS" \
  aggregates.before.tsv head.before history.before.tsv nrestarts.before \
  root-status.before source.sha256 tree.before
```

Expected: all listed evidence verifies.

## Task 3: Capture production catalog, function, grant, and apply-manifest evidence

**Status:** Completed and sealed at `/opt/thoidai-reconciliation/phase0-20260814T135943Z`; verify but do not regenerate this evidence.

**Files:**
- Create outside Git: `$evidence_root/production-catalog.before.tsv`
- Create outside Git: `$evidence_root/production-function-body.before.tsv`
- Verify: existing employee-password-reset apply manifests
- No production write

- [x] **Step 1: Capture selected columns, tables, constraints, indexes, triggers, and policies**

```bash
set -euo pipefail
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select 'COLUMN',table_name,column_name,data_type,is_nullable,
       case when column_default is null then 'no_default' else 'has_default' end,
       is_generated,md5(coalesce(generation_expression,''))
from information_schema.columns
where table_schema='public' and (
 (table_name='tasks' and column_name in ('plan_period','self_claimable','plan_batch_id'))
 or (table_name='staff_users' and column_name in
   ('password','password_hash','job_title_id','list_order','session_version'))
 or (table_name='task_evaluation_checkpoints' and column_name='total_score'))
union all
select 'TABLE',c.relname,'-',c.relkind::text,c.relrowsecurity::text,
       c.relforcerowsecurity::text,'-',
       md5((select string_agg(x.column_name||':'||x.data_type,',' order by x.ordinal_position)
            from information_schema.columns x
            where x.table_schema='public' and x.table_name=c.relname))
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and c.relname in ('job_titles','password_reset_tokens','password_reset_attempts')
order by 1,2,3;" > "$evidence_root/production-catalog.before.tsv"

docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select 'INDEX',c.relname,md5(pg_get_indexdef(c.oid))
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='i'
  and c.relname in (
   'idx_tasks_self_claimable','idx_password_reset_tokens_user_created',
   'idx_password_reset_tokens_expiry','idx_password_reset_attempts_fingerprint_created',
   'job_titles_code_lower_uidx','job_titles_name_lower_uidx',
   'staff_users_job_title_id_idx','idx_tasks_plan_batch_id','staff_users_list_order_idx')
union all
select 'CONSTRAINT',conname,md5(pg_get_constraintdef(oid,true))
from pg_constraint
where conname in ('tasks_plan_period_check','staff_users_list_order_nonnegative',
                  'staff_users_session_version_nonnegative')
union all
select 'TRIGGER',trigger_name,md5(string_agg(event_manipulation,',' order by event_manipulation))
from information_schema.triggers
where trigger_schema='public' and trigger_name in (
 'validate_task_report_recipient','trg_staff_users_password_hash',
 'job_titles_set_updated_at','staff_users_guard_job_title_write')
group by trigger_name
union all
select 'POLICY',policyname,md5(cmd||':'||coalesce(qual,'')||':'||coalesce(with_check,''))
from pg_policies
where schemaname='public' and policyname in (
 'public read job_titles','protect_password_reset_audit_insert',
 'protect_password_reset_audit_update','protect_password_reset_audit_delete')
order by 1,2;" >> "$evidence_root/production-catalog.before.tsv"
chmod 0600 "$evidence_root/production-catalog.before.tsv"
```

Expected: metadata and hashes only; no function body, policy expression, column default, or row value is printed.

- [x] **Step 2: Capture terminal function body hashes, ownership, configuration, and grants**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select p.proname,pg_get_function_identity_arguments(p.oid),
       pg_get_function_result(p.oid),p.prosecdef,pg_get_userbyid(p.proowner),
       md5(p.prosrc),coalesce(array_to_string(p.proconfig,','),''),
       has_function_privilege('anon',p.oid,'EXECUTE'),
       has_function_privilege('authenticated',p.oid,'EXECUTE'),
       has_function_privilege('service_role',p.oid,'EXECUTE')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'validate_task_report_recipient','claim_task_plan',
 'save_task_evaluation_checkpoint','ensure_staff_password_hash',
 'consume_password_reset','can_administer_users',
 'touch_job_titles_updated_at','guard_staff_job_title_write',
 'create_bulk_task_plan','report_task_progress','review_task_completion',
 'prepare_admin_password_reset','finalize_admin_password_reset')
order by p.proname,pg_get_function_identity_arguments(p.oid);" \
  > "$evidence_root/production-function-body.before.tsv"
chmod 0600 "$evidence_root/production-function-body.before.tsv"
test "$(wc -l < "$evidence_root/production-function-body.before.tsv")" -eq 13
```

Expected: thirteen function signature/hash rows. No function body is emitted.

- [x] **Step 3: Capture role-policy and one-time DML evidence only as aggregates**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select 'ADMIN_POLICY',
 count(*) filter(where r.code='admin'),
 count(*) filter(where r.code='admin' and rp.can_manage_users and rp.can_manage_permissions
   and rp.can_create_task and rp.can_edit_all_tasks and rp.can_comment)
from public.roles r join public.role_permissions rp on rp.role_id=r.id;
select 'TBT_POLICY',
 count(*) filter(where r.code in ('tong_bien_tap','tbt_read_only')),
 count(*) filter(where r.code in ('tong_bien_tap','tbt_read_only')
   and not rp.can_manage_users and not rp.can_manage_permissions
   and not rp.can_create_task and not rp.can_edit_all_tasks and not rp.can_comment)
from public.roles r join public.role_permissions rp on rp.role_id=r.id;
select 'JOB_TITLE',count(*),
 (select count(*) from public.staff_users where job_title_id is not null),
 (select count(*) from public.staff_users su left join public.job_titles jt on jt.id=su.job_title_id
   where su.job_title_id is not null and jt.id is null)
from public.job_titles;
select 'LIST_ORDER',
 count(*) filter(where list_order<0),count(*) filter(where list_order>0),
 count(distinct list_order) filter(where list_order>0),
 coalesce(min(list_order) filter(where list_order>0),0),
 coalesce(max(list_order) filter(where list_order>0),0)
from public.staff_users;" > "$evidence_root/production-data-evidence.before.tsv"
chmod 0600 "$evidence_root/production-data-evidence.before.tsv"
```

Expected: four aggregate-only rows. The audited baseline records the TBT end-state mismatch without printing any staff identity.

- [x] **Step 4: Verify trusted apply evidence for the two password-reset execution records**

```bash
set -euo pipefail
test -f /opt/thoidai-backups/employee-password-reset/20260814T083831Z-production-migration/migration/migration-apply-status.txt
grep -Fx 'migration_exit=0' /opt/thoidai-backups/employee-password-reset/20260814T083831Z-production-migration/migration/migration-apply-status.txt
grep -Fx 'single_transaction=true' /opt/thoidai-backups/employee-password-reset/20260814T083831Z-production-migration/migration/migration-apply-status.txt
grep -Fx 'migration_history_modified=false' /opt/thoidai-backups/employee-password-reset/20260814T083831Z-production-migration/migration/migration-apply-status.txt
grep -Fx 'migration_sha256=21198e8092da7a557fc9351aaa5fd8cf02fa7217acabc543561f824eb9a28dbb' /opt/thoidai-backups/employee-password-reset/20260814T083831Z-production-migration/MANIFEST.txt
(cd /opt/thoidai-backups/employee-password-reset/20260814T083831Z-production-migration && safe_manifest_check SHA256SUMS >/dev/null)

test -f /opt/thoidai-backups/employee-password-reset/20260814T093629Z-hardening-deploy/migration/apply-status.txt
grep -Fx 'migration_exit=0' /opt/thoidai-backups/employee-password-reset/20260814T093629Z-hardening-deploy/migration/apply-status.txt
grep -Fx 'single_transaction=true' /opt/thoidai-backups/employee-password-reset/20260814T093629Z-hardening-deploy/migration/apply-status.txt
grep -Fx 'migration_sha256=5583bfa2cf1af13f88e11fce3a58d6afd2c87172f8ce1d837c9c4d649837c533' /opt/thoidai-backups/employee-password-reset/20260814T093629Z-hardening-deploy/MANIFEST.txt
(cd /opt/thoidai-backups/employee-password-reset/20260814T093629Z-hardening-deploy && safe_manifest_check SHA256SUMS >/dev/null && safe_manifest_check POSTDEPLOY-SHA256SUMS >/dev/null)
```

Expected: both exact source hashes, transactional exits, and backup checksum sets verify without reading dump or sensitive evidence contents.

- [x] **Step 5: Hash the production evidence**

```bash
read -r evidence_root < /opt/thoidai-reconciliation/phase0.latest
write_manifest "$evidence_root/production-evidence.sha256" \
  production-catalog.before.tsv production-data-evidence.before.tsv \
  production-function-body.before.tsv
```

Expected: all production metadata files verify.

## Task 4: Create and validate the retained network-isolated PostgreSQL replay cluster

**Files:**
- Verify: `/opt/thoidai-work/docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md`
- Verify: `/opt/thoidai-reconciliation/phase0-20260814T135943Z/*`
- Create outside Git: one mode-0700 child run directory under `/opt/thoidai-reconciliation/phase0-20260814T135943Z`
- Create outside Git: one mode-0600 bootstrap password file, one retained Docker volume, and one retained Docker container
- Read production only; create no object in `supabase_db_thoidai-work`

> **Execution status note (2026-08-15):** Tasks 1–4 are complete and sealed. The guarded isolated-only PUBLIC-USAGE normalization committed in the original replay database, all Task-4 fidelity gates passed, and `TASK4-SHA256SUMS` verifies. The former Task 5 then inserted exactly six role/permission pairs, ran the first four migrations with exit `0`, and stopped safely when `20260813210000` returned `3`/SQLSTATE `P0001`; its transaction rolled back cleanly and no later migration, classification, history, or cleanup step ran. That database, its container, volume, secret, and log are now quarantine-only historical evidence: host-side selected metadata inspection is the sole permitted access. No runtime session, database query, replay, diagnostic, log read/hash, stop, restart, rename, removal, or other mutation is permitted in the retained lane.

- [x] **Step 1: Verify the approved design commit and every sealed prerequisite**

```bash
set -euo pipefail
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
design=docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md
cd "$repo"
git merge-base --is-ancestor f707279ad9028d452d871fddb39d4f0f767ca155 HEAD
test "$(sha256sum "$design" | awk '{print $1}')" = 8cec52675a8d409a5c8e449299aed773adcb05c537f5869396cdd45b2545f637
test "$(stat -c %a "$evidence_root")" = 700
test "$(find "$evidence_root" -maxdepth 1 -type f | wc -l)" -eq 44
test "$(find "$evidence_root" -maxdepth 1 -type f ! -perm 0600 | wc -l)" -eq 0
test "$(sha256sum "$evidence_root/database.full.dump" | awk '{print $1}')" = 8081b82535a7c0b513db5708f31a9eeaea58e312a62278500d56448b5766bc91
test "$(sha256sum "$evidence_root/public-history-schema.dump" | awk '{print $1}')" = 674fa9610e9de26afe3716efe4554db9706247c0930dda3e90fd90ec26bb117b
test "$(sha256sum "$evidence_root/source.sha256" | awk '{print $1}')" = ca2ce5704909e0fd09712aecb9da5e04df56b30ddca1e8ab028d2a381f277612
test "$(wc -l < "$evidence_root/source.sha256")" -eq 16
(cd "$evidence_root" && safe_manifest_check PRECHANGE-SHA256SUMS >/dev/null)
(cd "$evidence_root" && safe_manifest_check production-evidence.sha256 >/dev/null)
(cd "$repo" && safe_manifest_check "$evidence_root/source.sha256" >/dev/null)
docker exec -i supabase_db_thoidai-work pg_restore --list \
  < "$evidence_root/database.full.dump" >/dev/null
docker exec -i supabase_db_thoidai-work pg_restore --list \
  < "$evidence_root/public-history-schema.dump" >/dev/null
```

Expected: every command exits `0`; the approved successor-design commit is an ancestor and the protected design bytes have SHA-256 `8cec526…f637`; all sixteen sources verify, both PostgreSQL-17 archives list successfully, and the 44 sealed top-level files remain root-only. Do not print archive contents.

- [x] **Step 2: Preserve the measured RED architecture evidence without repeating it**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
(cd "$evidence_root" && safe_manifest_check ACLTEST-SHA256SUMS >/dev/null)
(cd "$evidence_root" && safe_manifest_check TOCTEST-SHA256SUMS >/dev/null)
grep -Fx 'supabase_admin_socket_connection|false' "$evidence_root/ownertest-socket-check.tsv"
grep -Fx 'restore_status|1' "$evidence_root/acltest-red-reference.tsv"
grep -Fx 'failed_default_acl_items|3' "$evidence_root/acltest-red-reference.tsv"
grep -Fx 'green|schema_acl_entries|0' "$evidence_root/acltest-grants.tsv"
grep -Fx 'green|table_acl_entries|0' "$evidence_root/acltest-grants.tsv"
grep -Fx 'green|function_acl_entries|0' "$evidence_root/acltest-grants.tsv"
grep -Fx 'green|table_effective_privileges|147|588' "$evidence_root/acltest-grants.tsv"
grep -Fx 'green|function_effective_execute|56|56' "$evidence_root/acltest-grants.tsv"
grep -Fx 'green|schema_effective_privileges|2|8' "$evidence_root/acltest-grants.tsv"
grep -Fx 'test|public_default_acl_total|3' "$evidence_root/toctest-default-acl.tsv"
grep -Fx 'test|public_default_acl_supabase_admin|0' "$evidence_root/toctest-default-acl.tsv"
grep -Fx 'test|schema_acl_entries|5' "$evidence_root/toctest-grants.tsv"
cmp -s "$evidence_root/toctest-owner-production.tsv" "$evidence_root/toctest-owner-test.tsv" && exit 41 || true
```

Expected: retained evidence proves direct `supabase_admin` authentication was unavailable, exact shared-cluster restore failed three default ACLs, `--no-privileges` destroyed ACL/effective-privilege fidelity, and filtered TOC retained only five schema ACL entries with a non-identical owner fingerprint. No failed architecture is rerun.

- [x] **Step 3: Allocate one validated unique run identity without touching Docker**

```bash
set -euo pipefail
umask 077
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
current_file="$evidence_root/isolated-run.current"
test ! -e "$current_file"
run_stamp=$(date -u +%Y%m%d%H%M%S)
run_suffix=$(openssl rand -hex 4)
run_id="${run_stamp}_${run_suffix}"
container_name="thoidai_phase0_pg_${run_id}"
volume_name="thoidai_phase0_pgdata_${run_id}"
bootstrap_role="phase0_boot_${run_suffix}"
bootstrap_db="phase0_bootstrap_${run_suffix}"
replay_db="thoidai_phase0_replay_${run_suffix}"
run_dir="$evidence_root/isolated-$run_id"
[[ "$run_id" =~ ^[0-9]{14}_[0-9a-f]{8}$ ]]
[[ "$container_name" =~ ^[a-z][a-z0-9_]{1,62}$ ]]
[[ "$volume_name" =~ ^[a-z][a-z0-9_]{1,62}$ ]]
[[ "$bootstrap_role" =~ ^[a-z][a-z0-9_]{1,62}$ ]]
[[ "$bootstrap_db" =~ ^[a-z][a-z0-9_]{1,62}$ ]]
[[ "$replay_db" =~ ^[a-z][a-z0-9_]{1,62}$ ]]
test ${#container_name} -le 63
test ${#volume_name} -le 63
! docker container inspect "$container_name" >/dev/null 2>&1
! docker volume inspect "$volume_name" >/dev/null 2>&1
install -d -m 0700 "$run_dir"
printf '%s|%s|%s|%s|%s|%s\n' \
  "$run_id" "$container_name" "$volume_name" \
  "$bootstrap_role" "$bootstrap_db" "$replay_db" \
  > "$run_dir/names.tsv"
chmod 0600 "$run_dir/names.tsv"
printf '%s\n' "$run_dir" > "$current_file"
chmod 0600 "$current_file"
test "$(stat -c %a "$run_dir")" = 700
test "$(stat -c %a "$current_file")" = 600
```

Expected: one new root-only run directory and a validated names record exist; no container, volume, database, password, network, or production object has been created.

- [x] **Step 4: Capture fresh Git, resource, service, HTTP, and production baselines before container creation**

```bash
set -euo pipefail
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
cd "$repo"
test "$(git diff --cached --name-only | wc -l)" -eq 0
git rev-parse HEAD > "$run_dir/head.isolated.before"
git rev-parse HEAD^{tree} > "$run_dir/tree.isolated.before"
git status --porcelain=v1 --untracked-files=all > "$run_dir/root-status.isolated.before"
test "$(wc -l < "$run_dir/root-status.isolated.before")" -eq 358
test "$(sha256sum "$run_dir/root-status.isolated.before" | awk '{print $1}')" = 20115c9e9358e5883274a642b1e6c302d8c8bb78edd030f1400a52517b69793a
test "$(systemctl is-active thoidai-work)" = active
test "$(systemctl is-active docker)" = active
test "$(systemctl is-active nginx)" = active
nginx -t >/dev/null 2>&1
test "$(docker inspect -f '{{.State.Running}}' supabase_db_thoidai-work)" = true
docker exec supabase_db_thoidai-work pg_isready -q -U postgres -d postgres
test "$(docker ps --filter health=unhealthy -q | wc -l)" -eq 0
docker network inspect none >/dev/null
available_mib=$(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo)
free_kib=$(df -Pk /var/lib/docker | awk 'NR==2{print $4}')
load_one=$(awk '{print $1}' /proc/loadavg)
test "$available_mib" -ge 2048
test "$free_kib" -ge 5242880
awk -v load_value="$load_one" 'BEGIN{exit !(load_value<4.0)}'
local_login=$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' http://127.0.0.1:3001/login)
public_login=$(curl -sS -o /dev/null --max-time 15 -w '%{http_code}' https://thoidai.online/login)
local_session=$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' http://127.0.0.1:3001/api/auth/session)
public_session=$(curl -sS -o /dev/null --max-time 15 -w '%{http_code}' https://thoidai.online/api/auth/session)
test "$local_login" = 200
test "$public_login" = 200
test "$local_session" = 401
test "$public_session" = 401
printf 'available_mib|%s\nfree_kib|%s\nload_one|%s\nrunning_containers|%s\nunhealthy_containers|0\n' \
  "$available_mib" "$free_kib" "$load_one" "$(docker ps -q | wc -l)" \
  > "$run_dir/resources.isolated.before.tsv"
printf 'local_login|%s\npublic_login|%s\nlocal_session|%s\npublic_session|%s\n' \
  "$local_login" "$public_login" "$local_session" "$public_session" \
  > "$run_dir/http.isolated.before.tsv"
systemctl show thoidai-work -p NRestarts --value > "$run_dir/nrestarts.isolated.before"
chmod 0600 "$run_dir"/*
```

Expected: index `0`, dirty count `358`, dirty fingerprint `20115c…97a`, at least 2 GiB available RAM, at least 5 GiB Docker-filesystem headroom, load below `4.0`, zero unhealthy containers, healthy production services/database, login `200`, session `401`, and no printed dirty paths.

- [x] **Step 5: Capture and seal fresh read-only production fingerprints before container creation**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select kind,schema_name,owner_name,object_count from (
 select 'SCHEMA'::text kind,n.nspname schema_name,pg_get_userbyid(n.nspowner) owner_name,count(*)::bigint object_count
 from pg_namespace n where n.nspname='public' group by n.nspname,n.nspowner
 union all
 select 'RELATION:'||c.relkind::text,n.nspname,pg_get_userbyid(c.relowner),count(*)::bigint
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','i','S') group by c.relkind,n.nspname,c.relowner
 union all
 select 'FUNCTION',n.nspname,pg_get_userbyid(p.proowner),count(*)::bigint
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' group by n.nspname,p.proowner
) q order by kind,schema_name,owner_name;" > "$run_dir/production-owner.before.tsv"
cmp -s "$evidence_root/toctest-owner-production.tsv" "$run_dir/production-owner.before.tsv"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select
 (select count(*) from public.tasks),
 (select count(*) from public.staff_users),
 (select count(*) from public.staff_users where password_hash is null or password_hash=''),
 (select count(*) from public.staff_users where password is not null),
 (select count(*) from public.staff_users where session_version is null or session_version<0),
 (select coalesce(sum(session_version),0) from public.staff_users),
 (select count(*) from public.password_reset_tokens),
 (select count(*) from public.password_reset_tokens where used_at is null),
 (select count(*) from public.password_reset_attempts),
 (select count(*) from public.task_evaluation_checkpoints),
 (select count(*) from public.task_evaluation_checkpoints where total_score is distinct from rating*effort_weight),
 (select count(*) from public.job_titles),
 (select count(*) from public.staff_users su left join public.job_titles jt on jt.id=su.job_title_id where su.job_title_id is not null and jt.id is null),
 (select count(*) from public.staff_users where list_order<0),
 (select count(*) from public.staff_users where list_order>0),
 (select count(distinct list_order) from public.staff_users where list_order>0);" \
  > "$run_dir/production-aggregates.isolated.before.tsv"
cmp -s "$evidence_root/aggregates.before.tsv" "$run_dir/production-aggregates.isolated.before.tsv"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
with target(version,expected) as (values
 ('20260813110000',1),('20260813155000',1),('20260813172000',0),('20260813184000',1),
 ('20260813210000',0),('20260813220000',0),('20260813230000',0),('20260813233000',0),
 ('20260813234500',0),('20260814070000',0),('20260814090000',1),('20260814102000',0),
 ('20260814113000',1),('20260814130000',0),('20260814160000',0),('20260814170000',0))
select target.version,target.expected,count(sm.version)
from target left join supabase_migrations.schema_migrations sm using(version)
group by target.version,target.expected order by target.version;" \
  > "$run_dir/production-history.isolated.before.tsv"
cmp -s "$evidence_root/history.before.tsv" "$run_dir/production-history.isolated.before.tsv"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
select p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),
       p.prosecdef,pg_get_userbyid(p.proowner),md5(p.prosrc),coalesce(array_to_string(p.proconfig,','),''),
       has_function_privilege('anon',p.oid,'EXECUTE'),
       has_function_privilege('authenticated',p.oid,'EXECUTE'),
       has_function_privilege('service_role',p.oid,'EXECUTE')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'validate_task_report_recipient','claim_task_plan','save_task_evaluation_checkpoint',
 'ensure_staff_password_hash','consume_password_reset','can_administer_users',
 'touch_job_titles_updated_at','guard_staff_job_title_write','create_bulk_task_plan',
 'report_task_progress','review_task_completion','prepare_admin_password_reset',
 'finalize_admin_password_reset')
order by p.proname,pg_get_function_identity_arguments(p.oid);" \
  > "$run_dir/production-functions.isolated.before.tsv"
cmp -s "$evidence_root/production-function-body.before.tsv" "$run_dir/production-functions.isolated.before.tsv"
write_manifest "$run_dir/production-isolated-before.sha256" \
  production-aggregates.isolated.before.tsv production-functions.isolated.before.tsv \
  production-history.isolated.before.tsv production-owner.before.tsv
chmod 0600 "$run_dir"/*
```

Expected: aggregate, history, function, and owner files are byte-identical to sealed production evidence. The owner distribution is five lines: public schema `pg_database_owner`, 21 tables/53 indexes/one sequence owned by `postgres`, and 14 public functions owned by `postgres`. No row identity or function body is emitted.

- [x] **Step 6: Prove the pinned image is local and scan exact source/extension dependencies without pulling**

```bash
set -euo pipefail
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
image_ref='postgres@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d'
read -r run_dir < "$evidence_root/isolated-run.current"
cd "$repo"
image_id=$(docker image inspect -f '{{.Id}}' "$image_ref")
repo_digest_count=$(docker image inspect -f '{{len .RepoDigests}}' "$image_ref")
pinned_repo_digest_match_count=$(docker image inspect -f '{{range .RepoDigests}}{{println .}}{{end}}' "$image_ref" | grep -Fxc "$image_ref")
image_os=$(docker image inspect -f '{{.Os}}' "$image_ref")
image_architecture=$(docker image inspect -f '{{.Architecture}}' "$image_ref")
inspect_size_bytes=$(docker image inspect -f '{{.Size}}' "$image_ref")
printf 'image_id|%s\nrepo_digest_count|%s\npinned_repo_digest_match_count|%s\nos|%s\narchitecture|%s\ninspect_size_bytes|%s\n' \
  "$image_id" "$repo_digest_count" "$pinned_repo_digest_match_count" \
  "$image_os" "$image_architecture" "$inspect_size_bytes" \
  > "$run_dir/image-metadata.tsv"
chmod 0600 "$run_dir/image-metadata.tsv"
test "$(wc -l < "$run_dir/image-metadata.tsv")" -eq 6
grep -Fx 'image_id|sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d' "$run_dir/image-metadata.tsv"
grep -Fx 'repo_digest_count|1' "$run_dir/image-metadata.tsv"
grep -Fx 'pinned_repo_digest_match_count|1' "$run_dir/image-metadata.tsv"
grep -Fx 'os|linux' "$run_dir/image-metadata.tsv"
grep -Fx 'architecture|amd64' "$run_dir/image-metadata.tsv"
grep -Fx 'inspect_size_bytes|161234888' "$run_dir/image-metadata.tsv"
safe_manifest_check "$evidence_root/source.sha256" >/dev/null
mapfile -t source_paths < <(awk '{print $2}' "$evidence_root/source.sha256")
test "${#source_paths[@]}" -eq 16
count_matches() {
  local pattern=$1
  { grep -Eih -- "$pattern" "${source_paths[@]}" || true; } | wc -l
}
set_role_count=$(count_matches '(^|[^[:alnum:]_])set[[:space:]]+(local[[:space:]]+|session[[:space:]]+)?role([^[:alnum:]_]|$)')
session_auth_count=$(count_matches '(^|[^[:alnum:]_])set[[:space:]]+(local[[:space:]]+|session[[:space:]]+)?session[[:space:]]+authorization([^[:alnum:]_]|$)')
supabase_admin_count=$(count_matches '(^|[^[:alnum:]_])supabase_admin([^[:alnum:]_]|$)')
create_extension_count=$(count_matches '(^|[^[:alnum:]_])create[[:space:]]+extension([^[:alnum:]_]|$)')
pgcrypto_declaration_count=$(count_matches '(^|[^[:alnum:]_])create[[:space:]]+extension([[:space:]]+if[[:space:]]+not[[:space:]]+exists)?[[:space:]]+"?pgcrypto"?([^[:alnum:]_]|$)')
pgcrypto_call_count=$(count_matches '(^|[^[:alnum:]_])(crypt|gen_salt)[[:space:]]*\(')
archive_extension_count=$(docker exec -i supabase_db_thoidai-work pg_restore --list \
  < "$evidence_root/public-history-schema.dump" | awk '$4=="EXTENSION"{n++} END{print n+0}')
printf 'source_files|16\nset_role|%s\nsession_authorization|%s\nsupabase_admin|%s\ncreate_extension|%s\npgcrypto_declaration|%s\npgcrypto_calls|%s\narchive_extensions|%s\n' \
  "$set_role_count" "$session_auth_count" "$supabase_admin_count" \
  "$create_extension_count" "$pgcrypto_declaration_count" "$pgcrypto_call_count" "$archive_extension_count" \
  > "$run_dir/source-dependency-scan.tsv"
grep -Fx 'set_role|0' "$run_dir/source-dependency-scan.tsv"
grep -Fx 'session_authorization|0' "$run_dir/source-dependency-scan.tsv"
grep -Fx 'supabase_admin|0' "$run_dir/source-dependency-scan.tsv"
grep -Fx 'create_extension|1' "$run_dir/source-dependency-scan.tsv"
grep -Fx 'pgcrypto_declaration|1' "$run_dir/source-dependency-scan.tsv"
grep -Fx 'pgcrypto_calls|2' "$run_dir/source-dependency-scan.tsv"
grep -Fx 'archive_extensions|0' "$run_dir/source-dependency-scan.tsv"
printf 'plpgsql\npgcrypto\n' > "$run_dir/required-extensions.list"
chmod 0600 "$run_dir/source-dependency-scan.tsv" "$run_dir/required-extensions.list"
```

Expected: root-only `image-metadata.tsv` contains exactly six approved fields and proves the exact image ID, one RepoDigest with one pinned match, linux/amd64, and Docker image-inspect `.Size` value `161234888` bytes without dumping Config, Env, or history. The design baseline separately names the observed `docker image ls` display size `640 MB` and `docker system df -v` size/shared/unique metrics; they are not substituted for `.Size`. No pull command runs; the archive has zero extension TOC items; the sources reference one pgcrypto declaration and two pgcrypto call lines; and all sixteen sources have zero `SET ROLE`, `SET SESSION AUTHORIZATION`, and `supabase_admin` references.

- [x] **Step 7: Generate the isolated-only bootstrap secret directly into its root-only file**

```bash
set -euo pipefail
umask 077
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
secret_file="$run_dir/bootstrap-password"
test ! -e "$secret_file"
openssl rand -base64 48 > "$secret_file"
chmod 0600 "$secret_file"
test "$(stat -c %a "$secret_file")" = 600
test "$(stat -c %s "$secret_file")" -ge 64
printf 'mode|%s\nbytes|%s\n' "$(stat -c %a "$secret_file")" "$(stat -c %s "$secret_file")" \
  > "$run_dir/secret-metadata.tsv"
chmod 0600 "$run_dir/secret-metadata.tsv"
```

Expected: the value is never read into a shell variable, printed, hashed, passed as an argument, placed in an environment value, or stored in a label. Only its path, mode, and byte length are used later.

- [x] **Step 8: Create the retained volume and container with the exact isolation/resource envelope**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
image_ref='postgres@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d'
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
secret_file="$run_dir/bootstrap-password"
test "$(systemctl is-active docker)" = active
test "$(docker ps --filter health=unhealthy -q | wc -l)" -eq 0
test "$(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo)" -ge 2048
test "$(df -Pk /var/lib/docker | awk 'NR==2{print $4}')" -ge 5242880
awk 'NR==1{exit !($1<4.0)}' /proc/loadavg
docker volume create "$volume_name" >/dev/null
volume_driver=$(docker volume inspect -f '{{.Driver}}' "$volume_name")
volume_scope=$(docker volume inspect -f '{{.Scope}}' "$volume_name")
printf 'name|%s\ndriver|%s\nscope|%s\n' "$volume_name" "$volume_driver" "$volume_scope" \
  > "$run_dir/volume-metadata.tsv"
chmod 0600 "$run_dir/volume-metadata.tsv"
test "$(wc -l < "$run_dir/volume-metadata.tsv")" -eq 3
grep -Fx "name|$volume_name" "$run_dir/volume-metadata.tsv"
grep -Fx 'driver|local' "$run_dir/volume-metadata.tsv"
grep -Fx 'scope|local' "$run_dir/volume-metadata.tsv"
docker create --pull=never \
  --name "$container_name" \
  --hostname "$container_name" \
  --network none \
  --cpus 1 \
  --memory 1g \
  --memory-swap 1g \
  --pids-limit 256 \
  --restart no \
  --stop-timeout 30 \
  --mount "type=volume,src=$volume_name,dst=/var/lib/postgresql/data" \
  --mount "type=bind,src=$secret_file,dst=/run/secrets/bootstrap-password,readonly" \
  --env "POSTGRES_USER=$bootstrap_role" \
  --env "POSTGRES_DB=$bootstrap_db" \
  --env 'POSTGRES_PASSWORD_FILE=/run/secrets/bootstrap-password' \
  --env 'POSTGRES_INITDB_ARGS=--encoding=UTF8 --locale-provider=icu --icu-locale=en-US --locale=en_US.UTF-8' \
  "$image_ref" > "$run_dir/container.id"
chmod 0600 "$run_dir/container.id"
test "$(docker inspect -f '{{.Id}}' "$container_name")" = "$(cat "$run_dir/container.id")"
```

Expected: root-only `volume-metadata.tsv` has exactly three lines proving the validated name, `local` driver, and `local` scope without recording the mountpoint. Docker uses the already-present digest because `--pull=never` is mandatory. The named volume and stopped container are retained even if a later gate fails; no user-created network is created.

- [x] **Step 9: Assert stopped-container security and required extension controls before initialization**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
secret_file="$run_dir/bootstrap-password"
container_state=$(docker inspect -f '{{.State.Status}}' "$container_name")
container_image_id=$(docker inspect -f '{{.Image}}' "$container_name")
network_mode=$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$container_name")
privileged=$(docker inspect -f '{{.HostConfig.Privileged}}' "$container_name")
pid_mode=$(docker inspect -f '{{.HostConfig.PidMode}}' "$container_name")
ipc_mode=$(docker inspect -f '{{.HostConfig.IpcMode}}' "$container_name")
nano_cpus=$(docker inspect -f '{{.HostConfig.NanoCpus}}' "$container_name")
memory_bytes=$(docker inspect -f '{{.HostConfig.Memory}}' "$container_name")
memory_swap_bytes=$(docker inspect -f '{{.HostConfig.MemorySwap}}' "$container_name")
pids_limit=$(docker inspect -f '{{.HostConfig.PidsLimit}}' "$container_name")
restart_policy=$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$container_name")
auto_remove=$(docker inspect -f '{{.HostConfig.AutoRemove}}' "$container_name")
test "$container_state" = created
test "$container_image_id" = sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d
test "$network_mode" = none
port_bindings_json=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$container_name")
[[ "$port_bindings_json" = '{}' || "$port_bindings_json" = null ]]
test -z "$(docker port "$container_name")"
published_port_count=0
test "$privileged" = false
test "$pid_mode" != host
test "$ipc_mode" != host
pid_mode_not_host=true
ipc_mode_not_host=true
devices_json=$(docker inspect -f '{{json .HostConfig.Devices}}' "$container_name")
cap_add_json=$(docker inspect -f '{{json .HostConfig.CapAdd}}' "$container_name")
[[ "$devices_json" = '[]' || "$devices_json" = null ]]
[[ "$cap_add_json" = '[]' || "$cap_add_json" = null ]]
device_count=0
cap_add_count=0
test "$nano_cpus" -eq 1000000000
test "$memory_bytes" -eq 1073741824
test "$memory_swap_bytes" -eq 1073741824
test "$pids_limit" -eq 256
test "$restart_policy" = no
test "$auto_remove" = false
docker inspect -f '{{range .Mounts}}{{printf "%s|%s|%s|%s|%t\n" .Type .Name .Source .Destination .RW}}{{end}}' \
  "$container_name" | sed '/^$/d' > "$run_dir/mounts.assertion.tsv"
awk -F '|' -v volume="$volume_name" -v secret="$secret_file" '
 $1=="volume" && $2==volume && $4=="/var/lib/postgresql/data" && $5=="true" {data++}
 $1=="bind" && $2=="" && $3==secret && $4=="/run/secrets/bootstrap-password" && $5=="false" {password++}
 END {exit !(NR==2 && data==1 && password==1)}' "$run_dir/mounts.assertion.tsv"
! grep -Eq '/opt/thoidai-work|docker\.sock|supabase_db_thoidai-work' "$run_dir/mounts.assertion.tsv"
mount_count=$(wc -l < "$run_dir/mounts.assertion.tsv")
password_value_env_count=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$container_name" | grep -c '^POSTGRES_PASSWORD=' || true)
password_file_path_env_count=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$container_name" | grep -Fxc 'POSTGRES_PASSWORD_FILE=/run/secrets/bootstrap-password' || true)
test "$mount_count" -eq 2
test "$password_value_env_count" -eq 0
test "$password_file_path_env_count" -eq 1
printf 'state|%s\nimage_id|%s\nnetwork_mode|%s\npublished_port_count|%s\nprivileged|%s\npid_mode_not_host|%s\nipc_mode_not_host|%s\ndevice_count|%s\ncap_add_count|%s\nnano_cpus|%s\nmemory_bytes|%s\nmemory_swap_bytes|%s\npids_limit|%s\nrestart_policy|%s\nauto_remove|%s\nmount_count|%s\npassword_value_env_count|%s\npassword_file_path_env_count|%s\n' \
  "$container_state" "$container_image_id" "$network_mode" "$published_port_count" \
  "$privileged" "$pid_mode_not_host" "$ipc_mode_not_host" "$device_count" \
  "$cap_add_count" "$nano_cpus" "$memory_bytes" "$memory_swap_bytes" \
  "$pids_limit" "$restart_policy" "$auto_remove" "$mount_count" \
  "$password_value_env_count" "$password_file_path_env_count" \
  > "$run_dir/container-security.tsv"
chmod 0600 "$run_dir/container-security.tsv"
test "$(wc -l < "$run_dir/container-security.tsv")" -eq 18
grep -Fx 'state|created' "$run_dir/container-security.tsv"
grep -Fx 'image_id|sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d' "$run_dir/container-security.tsv"
grep -Fx 'network_mode|none' "$run_dir/container-security.tsv"
grep -Fx 'published_port_count|0' "$run_dir/container-security.tsv"
grep -Fx 'privileged|false' "$run_dir/container-security.tsv"
grep -Fx 'pid_mode_not_host|true' "$run_dir/container-security.tsv"
grep -Fx 'ipc_mode_not_host|true' "$run_dir/container-security.tsv"
grep -Fx 'device_count|0' "$run_dir/container-security.tsv"
grep -Fx 'cap_add_count|0' "$run_dir/container-security.tsv"
grep -Fx 'nano_cpus|1000000000' "$run_dir/container-security.tsv"
grep -Fx 'memory_bytes|1073741824' "$run_dir/container-security.tsv"
grep -Fx 'memory_swap_bytes|1073741824' "$run_dir/container-security.tsv"
grep -Fx 'pids_limit|256' "$run_dir/container-security.tsv"
grep -Fx 'restart_policy|no' "$run_dir/container-security.tsv"
grep -Fx 'auto_remove|false' "$run_dir/container-security.tsv"
grep -Fx 'mount_count|2' "$run_dir/container-security.tsv"
grep -Fx 'password_value_env_count|0' "$run_dir/container-security.tsv"
grep -Fx 'password_file_path_env_count|1' "$run_dir/container-security.tsv"
install -m 0600 /dev/null "$run_dir/extension-controls.tsv"
for extension_name in plpgsql pgcrypto; do
  docker cp "$container_name:/usr/share/postgresql/17/extension/$extension_name.control" - 2>/dev/null \
    | tar -tf - >/dev/null
  printf '%s|present\n' "$extension_name" >> "$run_dir/extension-controls.tsv"
done
grep -Fx 'plpgsql|present' "$run_dir/extension-controls.tsv"
grep -Fx 'pgcrypto|present' "$run_dir/extension-controls.tsv"
chmod 0600 "$run_dir/mounts.assertion.tsv" "$run_dir/container-security.tsv" "$run_dir/extension-controls.tsv"
```

Expected: root-only `container-security.tsv` has exactly eighteen approved aggregate lines proving created state, exact image ID, network mode `none`, zero published ports, exactly two mounts, no privileged/host PID/host IPC/device/cap-add access, exact 1 CPU/1 GiB/256 PID limits, restart `no`, auto-remove false, zero password-value environment keys, and one password-file-path key. It records no raw environment values or mount paths; both required PostgreSQL-17 control files are present before cluster initialization.

- [x] **Step 10: Start the retained container and verify the official-image initialization**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
docker start "$container_name" >/dev/null
ready=false
for attempt in $(seq 1 45); do
  if docker exec "$container_name" pg_isready -q -U "$bootstrap_role" -d "$bootstrap_db"; then
    ready=true
    break
  fi
  sleep 1
done
if test "$ready" != true; then
  printf 'ready|false\nlog_read|forbidden\nretained|true\n' > "$run_dir/init-readiness.failure.tsv"
  chmod 0600 "$run_dir/init-readiness.failure.tsv"
  exit 42
fi
docker exec "$container_name" postgres --version > "$run_dir/postgresql-version.tsv"
grep -Eq '^postgres \(PostgreSQL\) 17\.10 ' "$run_dir/postgresql-version.tsv"
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$bootstrap_db" -AtF '|' -v ON_ERROR_STOP=1 -c \
  "select current_user,session_user,current_database(),usesuper from pg_user where usename=current_user;" \
  > "$run_dir/bootstrap-session.tsv"
grep -Fx "$bootstrap_role|$bootstrap_role|$bootstrap_db|t" "$run_dir/bootstrap-session.tsv"
chmod 0600 "$run_dir"/*
```

Expected: PostgreSQL `17.10` is ready only on the container-local socket; the unique bootstrap role is the sole initial superuser session. Raw container logs are never printed, even on failure.

- [x] **Step 11: Bootstrap only the archive roles and guard the built-in role**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
docker exec -i "$container_name" psql -X -U "$bootstrap_role" -d "$bootstrap_db" -v ON_ERROR_STOP=1 <<'SQL'
do $guard$
begin
  if not exists (select 1 from pg_roles where rolname='pg_database_owner') then
    raise exception 'built-in database-owner role missing';
  end if;
  if exists (select 1 from pg_roles where rolname in ('postgres','supabase_admin','anon','authenticated','service_role')) then
    raise exception 'archive role collision';
  end if;
end
$guard$;
create role postgres nosuperuser inherit createrole createdb login replication bypassrls password null;
create role supabase_admin superuser inherit createrole createdb login replication bypassrls password null;
create role anon nosuperuser inherit nocreaterole nocreatedb nologin noreplication nobypassrls password null;
create role authenticated nosuperuser inherit nocreaterole nocreatedb nologin noreplication nobypassrls password null;
create role service_role nosuperuser inherit nocreaterole nocreatedb nologin noreplication bypassrls password null;
grant anon,authenticated,service_role,pg_create_subscription,pg_monitor,pg_read_all_data,pg_signal_backend
  to postgres with admin option;
SQL
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$bootstrap_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,
       rolpassword is null
from pg_authid where rolname in ('postgres','supabase_admin','anon','authenticated','service_role','pg_database_owner')
order by rolname;" > "$run_dir/archive-roles.tsv"
cat > "$run_dir/archive-roles.expected.tsv" <<'EOF'
anon|f|t|f|f|f|f|f|t
authenticated|f|t|f|f|f|f|f|t
pg_database_owner|f|t|f|f|f|f|f|t
postgres|f|t|t|t|t|t|t|t
service_role|f|t|f|f|f|f|t|t
supabase_admin|t|t|t|t|t|t|t|t
EOF
cmp -s "$run_dir/archive-roles.expected.tsv" "$run_dir/archive-roles.tsv"
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$bootstrap_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select 'archive_roles',count(*) from pg_roles where rolname in ('postgres','supabase_admin','anon','authenticated','service_role');
select 'archive_usable_passwords',count(*) from pg_authid where rolname in ('postgres','supabase_admin','anon','authenticated','service_role') and rolpassword is not null;
select 'allowed_postgres_memberships',count(*) from pg_auth_members m join pg_roles member_role on member_role.oid=m.member join pg_roles granted_role on granted_role.oid=m.roleid where member_role.rolname='postgres' and granted_role.rolname in ('anon','authenticated','service_role','pg_create_subscription','pg_monitor','pg_read_all_data','pg_signal_backend') and m.admin_option;
select 'forbidden_supabase_service_roles',count(*) from pg_roles where rolname in ('authenticator','supabase_functions_admin','supabase_privileged_role','supabase_realtime_admin');" \
  > "$run_dir/role-aggregates.tsv"
grep -Fx 'archive_roles|5' "$run_dir/role-aggregates.tsv"
grep -Fx 'archive_usable_passwords|0' "$run_dir/role-aggregates.tsv"
grep -Fx 'allowed_postgres_memberships|7' "$run_dir/role-aggregates.tsv"
grep -Fx 'forbidden_supabase_service_roles|0' "$run_dir/role-aggregates.tsv"
chmod 0600 "$run_dir"/*
```

Expected: `postgres` is the audited non-superuser replay role, `supabase_admin` has audited superuser attributes, the three API roles match production, `pg_database_owner` was not recreated, the seven allowed built-in/archive memberships exist, no unrelated Supabase service role exists, and every archive role has no usable password.

- [x] **Step 12: Create the exact replay database/extensions and remove only its empty template public schema**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
docker exec -i "$container_name" psql -X -U "$bootstrap_role" -d "$bootstrap_db" -v ON_ERROR_STOP=1 \
  -v replay_db="$replay_db" <<'SQL'
  create database :"replay_db" with owner postgres template template0 encoding 'UTF8' locale_provider icu icu_locale 'en-US' locale 'en_US.UTF-8';
SQL
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$replay_db" -v ON_ERROR_STOP=1 -c \
  "create schema extensions authorization postgres;"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -v ON_ERROR_STOP=1 -c \
  "create extension pgcrypto with schema extensions;"
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select current_database(), (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public');" > "$run_dir/template-public.guard.tsv"
grep -Fx "$replay_db|0" "$run_dir/template-public.guard.tsv"
test "$replay_db" != postgres
test "$replay_db" != "$bootstrap_db"
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$replay_db" -v ON_ERROR_STOP=1 -c \
  "drop schema public;"
docker exec "$container_name" psql -X -U "$bootstrap_role" -d "$bootstrap_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select d.datname,pg_get_userbyid(d.datdba),pg_encoding_to_char(d.encoding),d.datlocprovider,
       d.datcollate,d.datctype,d.datlocale
from pg_database d where d.datname='$replay_db';" > "$run_dir/database-locale.tsv"
awk -F '|' -v database="$replay_db" '
 $1==database && $2=="postgres" && $3=="UTF8" && $4=="i" &&
 $5=="en_US.UTF-8" && $6=="en_US.UTF-8" && $7=="en-US" {ok=1}
 END{exit !ok}' "$run_dir/database-locale.tsv"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select extname,extversion,n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace
where extname in ('plpgsql','pgcrypto') order by extname;" > "$run_dir/extensions.tsv"
grep -Fx 'pgcrypto|1.3|extensions' "$run_dir/extensions.tsv"
grep -Fx 'plpgsql|1.0|pg_catalog' "$run_dir/extensions.tsv"
test "$(docker exec "$container_name" psql -X -U postgres -d "$replay_db" -Atqc 'show data_checksums')" = off
chmod 0600 "$run_dir"/*
```

Expected: one isolated database owned by non-superuser `postgres` has UTF8, ICU provider `i`, ICU locale `en-US`, `en_US.UTF-8` collation/type, checksums off, `plpgsql 1.0` in `pg_catalog`, and `pgcrypto 1.3` in `extensions`. Only the verified-empty public schema inside this isolated database is dropped, without `CASCADE`.

- [x] **Step 13: Stream the full archive as bootstrap superuser with ownership and privileges enabled**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
test "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$container_name")" = none
port_bindings_json=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$container_name")
[[ "$port_bindings_json" = '{}' || "$port_bindings_json" = null ]]
test -z "$(docker port "$container_name")"
test "$(docker inspect -f '{{.HostConfig.Privileged}}' "$container_name")" = false
test "$(docker inspect -f '{{len .Mounts}}' "$container_name")" -eq 2
test "$(sha256sum "$evidence_root/public-history-schema.dump" | awk '{print $1}')" = 674fa9610e9de26afe3716efe4554db9706247c0930dda3e90fd90ec26bb117b
docker exec -i "$container_name" pg_restore --list \
  < "$evidence_root/public-history-schema.dump" >/dev/null
restore_hash_file="$run_dir/restore.output.sha256"
install -m 0600 /dev/null "$restore_hash_file"
set +e
docker exec -i "$container_name" pg_restore -U "$bootstrap_role" -d "$replay_db" \
  --exit-on-error --single-transaction \
  < "$evidence_root/public-history-schema.dump" 2>&1 \
  | sha256sum | awk '{print $1}' > "$restore_hash_file"
restore_pipeline=("${PIPESTATUS[@]}")
restore_status=${restore_pipeline[0]}
set -e
test "${restore_pipeline[1]}" -eq 0
test "${restore_pipeline[2]}" -eq 0
read -r restore_hash < "$restore_hash_file"
[[ "$restore_hash" =~ ^[0-9a-f]{64}$ ]]
printf 'restore_status|%s\noutput_sha256|%s\nowner_enabled|true\nprivileges_enabled|true\n' \
  "$restore_status" "$restore_hash" > "$run_dir/restore-status.tsv"
chmod 0600 "$run_dir/restore-status.tsv"
test "$restore_status" -eq 0
```

Expected: exact archive bytes stream over stdin, raw output is reduced to SHA-256/status, and restore exits `0` with no ignored errors. The command contains no `--no-owner`, `--no-privileges`, filtered TOC, or production credential and creates no migration copy in `/tmp` or the volume.

- [x] **Step 14: Apply the one guarded isolated-only public-schema ACL normalization**

```bash
set -euo pipefail
umask 077
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
archive="$evidence_root/public-history-schema.dump"
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
test "$(docker inspect -f '{{.State.Running}}' "$container_name")" = true
test "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$container_name")" = none
port_bindings_json=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$container_name")
[[ "$port_bindings_json" = '{}' || "$port_bindings_json" = null ]]
test -z "$(docker port "$container_name")"
test "$(sha256sum "$archive" | awk '{print $1}')" = 674fa9610e9de26afe3716efe4554db9706247c0930dda3e90fd90ec26bb117b

archive_counts="$run_dir/archive-public-schema-acl.counts.tsv"
{
  printf 'archive_sha256|674fa9610e9de26afe3716efe4554db9706247c0930dda3e90fd90ec26bb117b\n'
  docker exec -i "$container_name" pg_restore --list < "$archive" |
    awk '$4=="ACL" && $5=="-" && $6=="SCHEMA" && ($7=="public" || $7=="\"public\"") {n++}
         END {printf "schema_acl_toc_items|%d\n",n+0}'
  docker exec -i "$container_name" pg_restore --schema-only --file=- < "$archive" |
    awk '
      function normalize(value) {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
        gsub(/[[:space:]]+/, " ", value)
        return toupper(value)
      }
      {
        statement=normalize($0)
        if (statement ~ /^(GRANT|REVOKE) .* ON SCHEMA (PUBLIC|"PUBLIC") (TO|FROM) /) {
          commands++
          if (statement ~ /^GRANT /) grants++
          if (statement ~ /^REVOKE /) revokes++
          if (statement ~ /^GRANT .* TO PUBLIC;$/) public_grants++
          if (statement ~ /^GRANT (USAGE|ALL|ALL PRIVILEGES) ON SCHEMA (PUBLIC|"PUBLIC") TO PUBLIC;$/) public_usage++
        }
      }
      END {
        printf "public_schema_acl_commands|%d\n",commands+0
        printf "public_schema_grants|%d\n",grants+0
        printf "public_schema_revokes|%d\n",revokes+0
        printf "public_schema_grants_to_public|%d\n",public_grants+0
        printf "semantic_public_usage_grants|%d\n",public_usage+0
      }'
} > "$archive_counts"
chmod 0600 "$archive_counts"
grep -Fx 'schema_acl_toc_items|1' "$archive_counts"
grep -Fx 'public_schema_acl_commands|4' "$archive_counts"
grep -Fx 'public_schema_grants|4' "$archive_counts"
grep -Fx 'public_schema_revokes|0' "$archive_counts"
grep -Fx 'public_schema_grants_to_public|0' "$archive_counts"
grep -Fx 'semantic_public_usage_grants|0' "$archive_counts"

mapfile -d '' -t tdd_debug_files < <(
  find "$run_dir" -maxdepth 1 -type f -name 'schema-acl-transaction-debug-*.tsv' -print0
)
test "${#tdd_debug_files[@]}" -eq 1
tdd_debug=${tdd_debug_files[0]}
test "$(stat -c %a "$tdd_debug")" = 600
test "$(sha256sum "$tdd_debug" | awk '{print $1}')" = 9b784790cfbb06c6d641c2efdf3650d9d147e708dcc5128d6d7b6f542a62bb6c
grep -Fx 'status|PASS' "$tdd_debug"
grep -Fx 'green_default_acl|6/3/3' "$tdd_debug"
grep -Fx 'green_schema_acl|7' "$tdd_debug"
grep -Fx 'green_table_acl|653' "$tdd_debug"
grep -Fx 'green_function_acl|46' "$tdd_debug"
grep -Fx 'green_table_effective|571/588' "$tdd_debug"
grep -Fx 'green_function_effective|40/56' "$tdd_debug"
grep -Fx 'green_schema_effective|5/8' "$tdd_debug"
grep -Fx 'green_public_usage|1' "$tdd_debug"
grep -Fx 'rollback_schema_acl|6' "$tdd_debug"
grep -Fx 'rollback_public_usage|0' "$tdd_debug"
grep -Fx 'production_preserved|1' "$tdd_debug"
grep -Fx 'container_isolation_preserved|1' "$tdd_debug"

production_before="$run_dir/production-acl-normalization.before.tsv"
isolated_pre="$run_dir/isolated-acl-normalization.pre.tsv"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
with acl as (
  select e.* from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,'{}'::aclitem[])) e
  where n.nspname='public'
)
select 'production',count(*),count(*) filter(where grantee=0 and privilege_type='USAGE') from acl;" \
  > "$production_before"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
with acl as (
  select e.* from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,'{}'::aclitem[])) e
  where n.nspname='public'
)
select 'isolated_pre',count(*),count(*) filter(where grantee=0 and privilege_type='USAGE') from acl;" \
  > "$isolated_pre"
chmod 0600 "$production_before" "$isolated_pre"
grep -Fx 'production|7|1' "$production_before"
grep -Fx 'isolated_pre|6|0' "$isolated_pre"

normalization_hash_file="$run_dir/isolated-acl-normalization.output.sha256"
install -m 0600 /dev/null "$normalization_hash_file"
set +e
{
  docker exec -i "$container_name" psql -X -U postgres -d "$replay_db" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
do $pre_guard$
declare
  schema_acl_count bigint;
  public_usage_count bigint;
begin
  if current_user <> 'postgres' or (select rolsuper from pg_roles where rolname=current_user) then
    raise exception 'normalization must run as non-superuser postgres';
  end if;
  if not exists (
    select 1 from pg_database d join pg_roles r on r.oid=d.datdba
    where d.datname=current_database() and r.rolname='postgres'
  ) then
    raise exception 'postgres is not the replay database owner';
  end if;
  select count(*),count(*) filter(where e.grantee=0 and e.privilege_type='USAGE')
    into schema_acl_count,public_usage_count
  from pg_namespace n
  cross join lateral aclexplode(coalesce(n.nspacl,'{}'::aclitem[])) e
  where n.nspname='public';
  if schema_acl_count <> 6 or public_usage_count <> 0 then
    raise exception 'isolated public-schema ACL precondition mismatch';
  end if;
end
$pre_guard$;
GRANT USAGE ON SCHEMA public TO PUBLIC;
do $post_guard$
declare
  schema_acl_count bigint;
  public_usage_count bigint;
begin
  select count(*),count(*) filter(where e.grantee=0 and e.privilege_type='USAGE')
    into schema_acl_count,public_usage_count
  from pg_namespace n
  cross join lateral aclexplode(coalesce(n.nspacl,'{}'::aclitem[])) e
  where n.nspname='public';
  if schema_acl_count <> 7 or public_usage_count <> 1 then
    raise exception 'isolated public-schema ACL postcondition mismatch';
  end if;
end
$post_guard$;
COMMIT;
SQL
} 2>&1 | sha256sum | awk '{print $1}' > "$normalization_hash_file"
normalization_pipeline=("${PIPESTATUS[@]}")
set -e
normalization_status=${normalization_pipeline[0]}
test "${normalization_pipeline[1]}" -eq 0
test "${normalization_pipeline[2]}" -eq 0
read -r normalization_hash < "$normalization_hash_file"
[[ "$normalization_hash" =~ ^[0-9a-f]{64}$ ]]
printf 'normalization_status|%s\noutput_sha256|%s\ntransaction|single\nreplay_role|postgres\npre_guard|6/0\npost_guard|7/1\nproduction_mutation|false\n' \
  "$normalization_status" "$normalization_hash" \
  > "$run_dir/isolated-acl-normalization.status.tsv"
chmod 0600 "$run_dir/isolated-acl-normalization.status.tsv"
test "$normalization_status" -eq 0

isolated_post="$run_dir/isolated-acl-normalization.post.tsv"
production_after="$run_dir/production-acl-normalization.after.tsv"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
with acl as (
  select e.* from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,'{}'::aclitem[])) e
  where n.nspname='public'
)
select 'isolated_post',count(*),count(*) filter(where grantee=0 and privilege_type='USAGE') from acl;" \
  > "$isolated_post"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -AtF '|' -v ON_ERROR_STOP=1 -c "
with acl as (
  select e.* from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,'{}'::aclitem[])) e
  where n.nspname='public'
)
select 'production',count(*),count(*) filter(where grantee=0 and privilege_type='USAGE') from acl;" \
  > "$production_after"
chmod 0600 "$isolated_post" "$production_after" "$normalization_hash_file"
grep -Fx 'isolated_post|7|1' "$isolated_post"
grep -Fx 'production|7|1' "$production_after"
cmp -s "$production_before" "$production_after"
grep -Fx 'normalization_status|0' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'transaction|single' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'replay_role|postgres' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'pre_guard|6/0' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'post_guard|7/1' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'production_mutation|false' "$run_dir/isolated-acl-normalization.status.tsv"
test "$(find "$run_dir" -maxdepth 1 -type f ! -perm 0600 | wc -l)" -eq 0
```

Expected: aggregate-only archive evidence proves one schema-ACL TOC item, four public-schema grants, and zero PUBLIC/PUBLIC-USAGE grants; production is `7/1`; replay pre-state is `6/0`; and the retained TDD evidence has the exact approved hash/status, seven GREEN fidelity aggregates, and PUBLIC-USAGE `1`. Only isolated non-superuser database owner `postgres` runs one transaction containing the guarded `6/0` precondition, exactly `GRANT USAGE ON SCHEMA public TO PUBLIC`, guarded `7/1` postcondition, and commit. Raw output is reduced to SHA-256/status; persistent isolated post-evidence is `7/1`, production remains byte-identical `7/1`, every new file is `0600`, and any mismatch stops before the grant or before fidelity.

- [x] **Step 15: Prove every GREEN restore-plus-normalization fidelity gate before fixtures**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
grep -Fx 'normalization_status|0' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'transaction|single' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'pre_guard|6/0' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'post_guard|7/1' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'production_mutation|false' "$run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'isolated_post|7|1' "$run_dir/isolated-acl-normalization.post.tsv"
cmp -s "$run_dir/production-acl-normalization.before.tsv" "$run_dir/production-acl-normalization.after.tsv"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='i'),
 (select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'),
 (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal),
 (select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public');" \
  > "$run_dir/isolated-core-counts.tsv"
grep -Fx '21|53|96|5|39|14' "$run_dir/isolated-core-counts.tsv"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select kind,schema_name,owner_name,object_count from (
 select 'SCHEMA'::text kind,n.nspname schema_name,pg_get_userbyid(n.nspowner) owner_name,count(*)::bigint object_count
 from pg_namespace n where n.nspname='public' group by n.nspname,n.nspowner
 union all
 select 'RELATION:'||c.relkind::text,n.nspname,pg_get_userbyid(c.relowner),count(*)::bigint
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','i','S') group by c.relkind,n.nspname,c.relowner
 union all
 select 'FUNCTION',n.nspname,pg_get_userbyid(p.proowner),count(*)::bigint
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' group by n.nspname,p.proowner
) q order by kind,schema_name,owner_name;" > "$run_dir/isolated-owner.tsv"
cmp -s "$run_dir/production-owner.before.tsv" "$run_dir/isolated-owner.tsv"
grep -Fx 'SCHEMA|public|pg_database_owner|1' "$run_dir/isolated-owner.tsv"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select 'default_acl',count(*),count(*) filter(where r.rolname='postgres'),count(*) filter(where r.rolname='supabase_admin')
from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace join pg_roles r on r.oid=d.defaclrole
where n.nspname='public';
select 'schema_acl',count(*) from pg_namespace n cross join lateral aclexplode(n.nspacl) a where n.nspname='public';
select 'table_acl',count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(c.relacl) a where n.nspname='public' and c.relkind='r';
select 'function_acl',count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(p.proacl) a where n.nspname='public';
with roles(role_name) as (values ('postgres'),('anon'),('authenticated'),('service_role')),
privs(privilege_name) as (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')),
tables as (select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')
select 'table_effective',count(*) filter(where has_table_privilege(role_name,oid,privilege_name)),count(*) from roles cross join privs cross join tables;
with roles(role_name) as (values ('postgres'),('anon'),('authenticated'),('service_role')),
funcs as (select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')
select 'function_effective',count(*) filter(where has_function_privilege(role_name,oid,'EXECUTE')),count(*) from roles cross join funcs;
with roles(role_name) as (values ('postgres'),('anon'),('authenticated'),('service_role')),
privs(privilege_name) as (values ('USAGE'),('CREATE'))
select 'schema_effective',count(*) filter(where has_schema_privilege(role_name,'public',privilege_name)),count(*) from roles cross join privs;" \
  > "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'default_acl|6|3|3' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'schema_acl|7' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'table_acl|653' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'function_acl|46' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'table_effective|571|588' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'function_effective|40|56' "$run_dir/isolated-acl-privileges.tsv"
grep -Fx 'schema_effective|5|8' "$run_dir/isolated-acl-privileges.tsv"
docker exec "$container_name" psql -X -U postgres -d "$replay_db" -AtF '|' -v ON_ERROR_STOP=1 -c "
select
 (select count(*) from public.staff_users),
 (select count(*) from supabase_migrations.schema_migrations);" \
  > "$run_dir/isolated-zero-row-baseline.tsv"
grep -Fx '0|0' "$run_dir/isolated-zero-row-baseline.tsv"
chmod 0600 "$run_dir"/*
```

Expected GREEN: the isolated-only normalization status and post-evidence are exact, production ACL evidence is unchanged, core counts are `21/53/96/5/39/14`, default ACL is `6 (3+3)`, schema/table/function ACL is `7/653/46`, effective privileges are `571/588`, `40/56`, `5/8`, the five-line owner distribution is byte-identical, public owner is `pg_database_owner`, and staff/history rows are zero. Any mismatch stops before fixtures.

- [x] **Step 16: Seal Task 4 evidence while retaining the running isolated container and volume**

```bash
set -euo pipefail
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r run_id container_name volume_name bootstrap_role bootstrap_db replay_db < "$run_dir/names.tsv"
test "$(docker inspect -f '{{.State.Running}}' "$container_name")" = true
docker volume inspect "$volume_name" >/dev/null
test "$(stat -c %a "$run_dir/bootstrap-password")" = 600
mapfile -t task4_members < <(find "$run_dir" -maxdepth 1 -type f \
  ! -name bootstrap-password ! -name TASK4-SHA256SUMS -printf '%f\n' | LC_ALL=C sort)
write_manifest "$run_dir/TASK4-SHA256SUMS" "${task4_members[@]}"
test "$(find "$run_dir" -maxdepth 1 -type f ! -perm 0600 | wc -l)" -eq 0
```

Expected: all non-secret Task-4 evidence—including archive normalization counts, retained TDD proof, transaction output/status, persistent `7/1` post-state, and production-preservation files—verifies automatically; every evidence file is `0600`; and the secret/container/volume are retained. The secret itself is deliberately excluded from checksum manifests.

## Task 5: Gate the committed handoff and build the new no-log replay lane

> **Quarantine boundary:** the retained Tasks 1–4 container, volume, databases, secret, and container log are historical evidence only. This task never opens a session in that container and never reads its log. Only selected host-side container/volume metadata may be inspected. All new database work occurs in a new container and a new volume.

**Files:**
- Verify only: canonical plan/design, committed execution package, sealed Tasks 1–4 evidence, production and quarantine metadata
- Create outside Git only after the immutable gate: one root-only v5 execution directory, new secret, new volume, new container, three new databases, safe evidence
- Modify no repository, production, service, nginx, application, provider/model, CLIProxyAPI, `9router`, retained resource, or history state

> **v17 recovery boundary:** the new no-log lane remains retained at the exact v5 pending path. The creation blocks below are historical evidence, not re-entry instructions. Run Steps 1R-3R, then continue at Step 5 only. Task 10 must first publish reviewed v17 authority; this documentation turn does not do so.

- [ ] **Step 1R: Authenticate externally anchored v17 authority, then execute only trusted review helpers**

The operator must supply both anchor values out of band. They are never populated from the approval file.

```bash
set -euo pipefail
: "${V17_REVIEW_PACKAGE:?exact externally supplied v17 review-package path required}"
: "${V17_REVIEW_MANIFEST_SHA256:?exact externally supplied SHA256SUMS digest required}"
base=/opt/thoidai-reconciliation
review_root=$base/phase0-20260814T135943Z
approval=$base/phase0-v17-reentry-review.approved.tsv
current=$base/HANDOFF.recovery-v17.current
review_package=$V17_REVIEW_PACKAGE
review_manifest_sha=$V17_REVIEW_MANIFEST_SHA256
review_exec() {
  python3 - "$review_package" "$review_manifest_sha" "$@" <<'PY'
import hashlib,os,re,stat,sys,types
MEMBERS=(
 "runbook.candidate.md","design.candidate.md","REVIEW-NOTES.md","VALIDATION.tsv",
 "FAILURE-STATE.tsv","RECOVERY-VERIFY.sh","VERIFY.sh","PUBLISH.py",
 "TRUST-GATE.py","TRUST-POLICY.tsv","SIMULATE.py","SAFE_MANIFEST.py","SOURCE-SHA256SUMS")
review,anchor,target,*target_args=sys.argv[1:]
sig=lambda s:(s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_uid,s.st_gid,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
if not re.fullmatch(r"[0-9a-f]{64}",anchor): raise SystemExit(41)
if not os.path.isabs(review) or os.path.normpath(review)!=review or os.path.realpath(review)!=review: raise SystemExit(41)
if target not in ("SAFE_MANIFEST.py","TRUST-GATE.py","PUBLISH.py"): raise SystemExit(41)
try: dfd=os.open(review,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
except OSError: raise SystemExit(41)
try:
 dst=os.fstat(dfd)
 if not stat.S_ISDIR(dst.st_mode) or dst.st_uid!=0 or dst.st_gid!=0 or stat.S_IMODE(dst.st_mode)!=0o700: raise SystemExit(41)
 def stable(name):
  if name not in (*MEMBERS,"SHA256SUMS"): raise SystemExit(41)
  try: fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=dfd)
  except OSError: raise SystemExit(41)
  try:
   before=os.fstat(fd);parts=[]
   if not stat.S_ISREG(before.st_mode) or before.st_uid!=0 or before.st_gid!=0 or stat.S_IMODE(before.st_mode)!=0o600: raise SystemExit(41)
   while True:
    chunk=os.read(fd,1<<20)
    if not chunk: break
    parts.append(chunk)
   after=os.fstat(fd)
  finally: os.close(fd)
  data=b"".join(parts)
  try: named=os.stat(name,dir_fd=dfd,follow_symlinks=False)
  except OSError: raise SystemExit(41)
  if sig(before)!=sig(after) or sig(named)!=sig(before): raise SystemExit(41)
  if b"\r" in data or b"\0" in data or not data or not data.endswith(b"\n"): raise SystemExit(41)
  return data
 manifest=stable("SHA256SUMS")
 if hashlib.sha256(manifest).hexdigest()!=anchor: raise SystemExit(41)
 try: lines=manifest.decode("ascii").splitlines()
 except UnicodeDecodeError: raise SystemExit(41)
 rows=[]
 for raw in lines:
  match=re.fullmatch(r"([0-9a-f]{64}) ([A-Za-z0-9][A-Za-z0-9._-]*)",raw)
  if not match: raise SystemExit(41)
  rows.append((match.group(1),match.group(2)))
 if tuple(name for _,name in rows)!=MEMBERS: raise SystemExit(41)
 if sorted(os.listdir(dfd))!=sorted((*MEMBERS,"SHA256SUMS")): raise SystemExit(41)
 digests={name:digest for digest,name in rows}
 safe_source=stable("SAFE_MANIFEST.py");target_source=stable(target)
 if hashlib.sha256(safe_source).hexdigest()!=digests["SAFE_MANIFEST.py"]: raise SystemExit(41)
 if hashlib.sha256(target_source).hexdigest()!=digests[target]: raise SystemExit(41)
 if sig(os.fstat(dfd))!=sig(dst): raise SystemExit(41)
 try: named_dir=os.stat(review,follow_symlinks=False)
 except OSError: raise SystemExit(41)
 if not stat.S_ISDIR(named_dir.st_mode) or (named_dir.st_dev,named_dir.st_ino)!=(dst.st_dev,dst.st_ino): raise SystemExit(41)
finally:
 os.close(dfd)
safe=types.ModuleType("SAFE_MANIFEST");safe.__file__=review+"/SAFE_MANIFEST.py";safe.__package__=None
exec(compile(safe_source,safe.__file__,"exec"),safe.__dict__)
sys.modules["SAFE_MANIFEST"]=safe
sys.argv=[review+"/"+target,*target_args]
scope={"__name__":"__main__","__file__":review+"/"+target,"__package__":None}
exec(compile(target_source,scope["__file__"],"exec"),scope)
PY
}
safe_manifest_check() {
  local manifest=$1
  case "$manifest" in /*) ;; *) manifest=$PWD/$manifest ;; esac
  review_exec SAFE_MANIFEST.py declared --directory "$(dirname -- "$manifest")" \
    --manifest "$(basename -- "$manifest")" --directory-mode 700 --allow-empty-members
}
write_manifest() {
  local output=$1 directory member_root member_root_mode member_mode name digest tmp
  shift
  directory=$(dirname -- "$output")
  member_root=$directory
  member_root_mode=700
  member_mode=600
  if [ "${1:-}" = --member-root ]; then
    test "$#" -ge 7
    member_root=$2
    test "$3" = --member-root-mode
    member_root_mode=$4
    test "$5" = --member-mode
    member_mode=$6
    shift 6
  fi
  mapfile -t manifest_names < <(printf '%s\n' "$@" | LC_ALL=C sort -u)
  test "${#manifest_names[@]}" -eq "$#"
  tmp=$(mktemp "$directory/.manifest.XXXXXX")
  : > "$tmp"
  for name in "${manifest_names[@]}"; do
    [[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]
    digest=$(review_exec SAFE_MANIFEST.py file --path "$member_root/$name" \
      --mode "$member_mode" --allow-empty --print-digest)
    printf '%s %s\n' "$digest" "$name" >> "$tmp"
  done
  chmod 0600 "$tmp"
  mv -f -- "$tmp" "$output"
  if [ "$member_root" = "$directory" ]; then
    safe_manifest_check "$output"
  else
    review_exec SAFE_MANIFEST.py manifest --directory "$directory" \
      --manifest "$(basename -- "$output")" --directory-mode 700 --allow-extra \
      --member-root "$member_root" --member-root-mode "$member_root_mode" \
      --member-mode "$member_mode" "${manifest_names[@]}"
  fi
}
review_name=$(basename -- "$review_package")
[[ "$review_manifest_sha" =~ ^[0-9a-f]{64}$ ]]
test "$(dirname -- "$review_package")" = "$review_root"
[[ "$review_name" =~ ^review-runbook-v17-r2-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]]
test "$review_package" = "$review_root/$review_name"
test -f "$review_package/SAFE_MANIFEST.py" && test ! -L "$review_package/SAFE_MANIFEST.py"
test "$(stat -c '%U|%G|%a' "$review_package/SAFE_MANIFEST.py")" = 'root|root|600'
review_exec SAFE_MANIFEST.py manifest --directory "$review_package" --anchor "$review_manifest_sha" --separator one \
  runbook.candidate.md design.candidate.md REVIEW-NOTES.md VALIDATION.tsv FAILURE-STATE.tsv \
  RECOVERY-VERIFY.sh VERIFY.sh PUBLISH.py TRUST-GATE.py TRUST-POLICY.tsv SIMULATE.py SAFE_MANIFEST.py SOURCE-SHA256SUMS
# Only after the external review anchor verifies may approval/current be interpreted.
test -f "$approval" && test ! -L "$approval"
test "$(stat -c '%U|%G|%a' "$approval")" = 'root|root|600'
test -f "$current" && test ! -L "$current"
test "$(stat -c '%U|%G|%a' "$current")" = 'root|root|600'
IFS= read -r execution_package < "$current"
review_exec TRUST-GATE.py \
  --trusted-review "$review_package" \
  --trusted-manifest "$review_manifest_sha" \
  --approval "$approval" \
  --execution "$execution_package" \
  --phase current \
  --pointer "$current" \
  --action both \
  --recovery-stage pre-resume
measure_routing_preservation() {
  local output=$1 name path resolved version version_rc doctor_json doctor_rc provider_rows unit_row unit_name unit_enabled unit_active
  {
    printf 'provider_model_mutation_authorized|false\nprovider_model_mutation_count|0\nCLIProxyAPI_mutation_authorized|false\nCLIProxyAPI_mutation_count|0\n9router_mutation_authorized|false\n9router_mutation_count|0\nproc_environment_read|false\nprovider_secret_read_or_hash|false\n'
    if path=$(command -v codex 2>/dev/null); then
      resolved=$(readlink -f -- "$path")
      printf 'command|codex|present|%s\n' "$resolved"
      stat -Lc 'command_stat|codex|%U|%G|%a|%s|%Y|%F' -- "$resolved"
      set +e
      version=$("$resolved" --version 2>/dev/null); version_rc=$?
      doctor_json=$("$resolved" doctor --json 2>/dev/null); doctor_rc=$?
      set -e
      [[ "$version" != *$'\n'* && "$version" != *$'\r'* && "$version" != *'|'* ]]
      printf 'command_version|codex|%s|%s\ndoctor_exit|%s\n' "$version_rc" "$version" "$doctor_rc"
      provider_rows=$(printf '%s' "$doctor_json" | python3 -c 'import json,re,sys
try: x=json.load(sys.stdin)
except Exception: x={}
rows=[]; allowed={"provider","provider_name","model","model_name"}
def walk(v,p=()):
 if isinstance(v,dict):
  for k in sorted(v):
   n=v[k]
   if k in allowed and isinstance(n,(str,int,float,bool)):
    key=".".join(p+(k,)); value=str(n)
    if not re.fullmatch(r"[A-Za-z0-9_.-]+",key) or not re.fullmatch(r"[A-Za-z0-9._:/+@<>=-]+",value): raise SystemExit(41)
    rows.append(f"provider_model|{key}|{value}")
   elif isinstance(n,(dict,list)): walk(n,p+(k,))
 elif isinstance(v,list):
  for i,n in enumerate(v):
   if isinstance(n,(dict,list)): walk(n,p+(str(i),))
walk(x)
print("\n".join(sorted(rows)) if rows else "provider_model|model|<default>")')
      printf 'provider_model_fields|%s\n%s\n' "$(printf '%s\n' "$provider_rows" | wc -l)" "$provider_rows"
    else
      printf 'command|codex|absent|-\ndoctor_exit|not-run\nprovider_model_fields|0\n'
    fi
    for name in CLIProxyAPI cliproxyapi 9router; do
      if path=$(command -v "$name" 2>/dev/null); then
        resolved=$(readlink -f -- "$path")
        printf 'command|%s|present|%s\n' "$name" "$resolved"
        stat -Lc "command_stat|$name|%U|%G|%a|%s|%Y|%F" -- "$resolved"
        set +e; version=$("$resolved" --version 2>/dev/null); version_rc=$?; set -e
        [[ "$version" != *$'\n'* && "$version" != *$'\r'* && "$version" != *'|'* ]]
        printf 'command_version|%s|%s|%s\n' "$name" "$version_rc" "$version"
      else
        printf 'command|%s|absent|-\n' "$name"
      fi
    done
    mapfile -t routing_units < <(systemctl list-unit-files --type=service --no-legend --no-pager 2>/dev/null | awk 'tolower($1) ~ /(cliproxyapi|9router)/ {print $1"|"$2}' | LC_ALL=C sort -u)
    printf 'routing_unit_count|%s\n' "${#routing_units[@]}"
    for unit_row in "${routing_units[@]}"; do
      IFS='|' read -r unit_name unit_enabled <<< "$unit_row"
      [[ "$unit_name" =~ ^[A-Za-z0-9_.@:-]+\.service$ ]]
      unit_active=$(systemctl is-active "$unit_name" 2>/dev/null || true)
      printf 'routing_unit|%s|enabled=%s|active=%s\n' "$unit_name" "$unit_enabled" "$unit_active"
    done
  } > "$output"
}
IFS= read -r recovery_dir < "$execution_package/TASK5.pending"
review_exec SAFE_MANIFEST.py file --path "$execution_package/TASK5.pending" --mode 600
test "$recovery_dir" = /opt/thoidai-reconciliation/phase0-v5-execution-20260815T041430Z-7fa3f327f5c8
routing_baseline=$recovery_dir/routing-preservation-v17.step1r.tsv
routing_manifest=$recovery_dir/ROUTING-V17-BASELINE-SHA256SUMS
routing_tmp=$(mktemp "$recovery_dir/.routing-v17-step1r.XXXXXX")
measure_routing_preservation "$routing_tmp"
chmod 0600 "$routing_tmp"
if test -e "$routing_baseline" || test -L "$routing_baseline"; then
  review_exec SAFE_MANIFEST.py file --path "$routing_baseline" --mode 600
  cmp -s "$routing_tmp" "$routing_baseline"
  unlink "$routing_tmp"
else
  ln -- "$routing_tmp" "$routing_baseline"
  python3 - "$routing_baseline" "$recovery_dir" <<'PY'
import os,sys
for path in sys.argv[1:]:
 fd=os.open(path,os.O_RDONLY|os.O_CLOEXEC|(os.O_DIRECTORY if path==sys.argv[2] else 0))
 try: os.fsync(fd)
 finally: os.close(fd)
PY
  unlink "$routing_tmp"
fi
routing_sha=$(review_exec SAFE_MANIFEST.py file --path "$routing_baseline" --mode 600 --print-digest)
routing_manifest_tmp=$(mktemp "$recovery_dir/.routing-v17-manifest.XXXXXX")
printf '%s routing-preservation-v17.step1r.tsv\n' "$routing_sha" > "$routing_manifest_tmp"
chmod 0600 "$routing_manifest_tmp"
if test -e "$routing_manifest" || test -L "$routing_manifest"; then
  cmp -s "$routing_manifest_tmp" "$routing_manifest"
  unlink "$routing_manifest_tmp"
else
  ln -- "$routing_manifest_tmp" "$routing_manifest"
  unlink "$routing_manifest_tmp"
fi
safe_manifest_check "$routing_manifest"
```

Expected: external path plus manifest SHA authenticate the v17 review package before the approval is read. The execution package remains passive data through safe manifest parsing, every byte comparison, exact schema validation, actual-lock-inode cross-binding, and pointer binding. Only then do the trusted review-package verifier and live recovery verifier run.

- [ ] **Step 2R: Establish three bounded composite readiness observations and publish one exact seal**

```bash
set -euo pipefail
umask 077
base=/opt/thoidai-reconciliation
timeout_bin=/usr/bin/timeout
test -x "$timeout_bin" && test "$(command -v timeout)" = "$timeout_bin"
"$timeout_bin" --foreground 2s true
pending_pointer="$base/phase0-v5-execution.pending"
expected_recovery="$base/phase0-v5-execution-20260815T041430Z-7fa3f327f5c8"
expected_container=thoidai_phase0_v3_cd3186598cd4
expected_container_id=c8d8916b639cb40ae19d7dfeeb0cf43bf52edea51ca4dc4be1e4e34dcd1ffc4c
expected_volume=thoidai_phase0_v3_data_cd3186598cd4
expected_logging=$'log_destination|stderr\nlog_error_verbosity|terse\nlog_min_error_statement|panic\nlog_statement|none\nlogging_collector|off'
deadline=$((SECONDS + 120))
probe_output=
probe_rc=0
run_bounded() {
  local remaining limit
  remaining=$((deadline - SECONDS))
  if test "$remaining" -le 0; then probe_output=; probe_rc=124; return 124; fi
  limit=5
  test "$remaining" -lt "$limit" && limit=$remaining
  set +e
  probe_output=$("$timeout_bin" --foreground "${limit}s" "$@" 2>/dev/null)
  probe_rc=$?
  set -e
  return "$probe_rc"
}
require_bounded() {
  if run_bounded "$@"; then return 0; fi
  case "$probe_rc" in 124) exit 42 ;; *) exit 41 ;; esac
}
test "$(sha256sum "$pending_pointer" | awk '{print $1}')" = d6c20209be2254dc9cb2788c6ad495ecb372516dd905b2c8e4cd7a76b5779af9
IFS= read -r recovery_dir < "$pending_pointer"
test "$recovery_dir" = "$expected_recovery"
test "$(realpath -e -- "$recovery_dir")" = "$expected_recovery"
test -d "$recovery_dir" && test ! -L "$recovery_dir"
test "$(stat -c '%U|%G|%a' "$recovery_dir")" = 'root|root|700'
require_bounded docker inspect -f '{{.Id}}' "$expected_container"; test "$probe_output" = "$expected_container_id"
require_bounded docker inspect -f '{{.Name}}' "$expected_container"; test "$probe_output" = "/$expected_container"
require_bounded docker inspect -f '{{.Image}}|{{.Platform}}|{{.State.Status}}|{{.State.Running}}|{{.RestartCount}}' "$expected_container"
test "$probe_output" = 'sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d|linux|running|true|0'
require_bounded docker inspect -f '{{.HostConfig.NetworkMode}}|{{.HostConfig.LogConfig.Type}}|{{.HostConfig.Privileged}}|{{.HostConfig.RestartPolicy.Name}}|{{.HostConfig.AutoRemove}}|{{.HostConfig.NanoCpus}}|{{.HostConfig.Memory}}|{{.HostConfig.MemorySwap}}|{{.HostConfig.PidsLimit}}|{{len .NetworkSettings.Ports}}|{{len .Mounts}}' "$expected_container"
test "$probe_output" = 'none|none|false|no|false|1000000000|1073741824|1073741824|256|0|2'
require_bounded docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Type}}|{{.Name}}|{{.RW}}{{end}}{{end}}' "$expected_container"
test "$probe_output" = "volume|$expected_volume|true"
require_bounded docker inspect -f '{{range .Mounts}}{{if eq .Destination "/run/secrets/phase0-postgres-password"}}{{.Type}}|{{.Source}}|{{.RW}}{{end}}{{end}}' "$expected_container"
test "$probe_output" = "bind|$recovery_dir/postgres-password.secret|false"
require_bounded docker volume inspect -f '{{.Name}}|{{.Driver}}|{{.Scope}}' "$expected_volume"
test "$probe_output" = "$expected_volume|local|local"
test "$(stat -c '%F|%U|%G|%a|%s' "$recovery_dir/postgres-password.secret")" = 'regular file|root|root|600|65'
readiness_dir="$recovery_dir/readiness-v17"
if test -e "$readiness_dir" || test -L "$readiness_dir"; then
  test -d "$readiness_dir" && test ! -L "$readiness_dir"
  test "$(stat -c '%U|%G|%a' "$readiness_dir")" = 'root|root|700'
  printf 'COMPLETE\nSHA256SUMS\npostgres-logging.actual.tsv\npostgres-logging.expected.tsv\nstatus.tsv\n' | cmp -s - <(find "$readiness_dir" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
  for member in COMPLETE SHA256SUMS postgres-logging.actual.tsv postgres-logging.expected.tsv status.tsv; do
    test -f "$readiness_dir/$member" && test ! -L "$readiness_dir/$member"
    test "$(stat -c '%U|%G|%a' "$readiness_dir/$member")" = 'root|root|600'
  done
  printf 'complete\n' | cmp -s - "$readiness_dir/COMPLETE"
  printf 'stable_observations|3\nprobe_delay_seconds|2\ncommand_timeout_seconds|5\noverall_timeout_seconds|120\ncounter_reset_on_timeout|true\ncounter_reset_on_any_nonzero|true\nlog_read|forbidden\nrestart_stop_remove|forbidden\n' | cmp -s - "$readiness_dir/status.tsv"
  test "$(awk 'END{print NR+0}' "$readiness_dir/SHA256SUMS")" -eq 4
  awk 'NF!=2 || $1 !~ /^[0-9a-f]{64}$/ {exit 41}' "$readiness_dir/SHA256SUMS"
  printf 'postgres-logging.expected.tsv\npostgres-logging.actual.tsv\nstatus.tsv\nCOMPLETE\n' | cmp -s - <(awk '{print $2}' "$readiness_dir/SHA256SUMS")
  (cd "$readiness_dir" && safe_manifest_check SHA256SUMS >/dev/null)
  cmp -s "$readiness_dir/postgres-logging.expected.tsv" "$readiness_dir/postgres-logging.actual.tsv"
else
  consecutive=0
  actual_logging=
  while test "$SECONDS" -lt "$deadline"; do
    observation_ok=true
    if run_bounded docker inspect -f '{{.State.Running}}' "$expected_container"; then test "$probe_output" = true || observation_ok=false; else case "$probe_rc" in 124) observation_ok=false ;; *) observation_ok=false ;; esac; fi
    if test "$observation_ok" = true; then if run_bounded docker exec "$expected_container" pg_isready -q -U phase0_bootstrap -d postgres; then :; else case "$probe_rc" in 124) observation_ok=false ;; *) observation_ok=false ;; esac; fi; fi
    if test "$observation_ok" = true; then if run_bounded docker exec "$expected_container" psql -X -U phase0_bootstrap -d postgres -qAt -v ON_ERROR_STOP=1 -c 'select 1'; then test "$probe_output" = 1 || observation_ok=false; else case "$probe_rc" in 124) observation_ok=false ;; *) observation_ok=false ;; esac; fi; fi
    if test "$observation_ok" = true; then
      if run_bounded docker exec "$expected_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "select name,setting from pg_settings where name in ('log_statement','log_min_error_statement','logging_collector','log_destination','log_error_verbosity') order by name"; then
        actual_logging=$probe_output; test "$actual_logging" = "$expected_logging" || observation_ok=false
      else case "$probe_rc" in 124) observation_ok=false ;; *) observation_ok=false ;; esac; fi
    fi
    if test "$observation_ok" = true; then consecutive=$((consecutive + 1)); test "$consecutive" -eq 3 && break; else consecutive=0; fi
    test "$SECONDS" -lt "$deadline" || break
    sleep 2
  done
  test "$consecutive" -eq 3
  tmp_readiness=$(mktemp -d "$base/.phase0-v17-readiness.XXXXXX")
  chmod 0700 "$tmp_readiness"
  printf '%s\n' "$expected_logging" > "$tmp_readiness/postgres-logging.expected.tsv"
  printf '%s\n' "$actual_logging" > "$tmp_readiness/postgres-logging.actual.tsv"
  printf 'stable_observations|3\nprobe_delay_seconds|2\ncommand_timeout_seconds|5\noverall_timeout_seconds|120\ncounter_reset_on_timeout|true\ncounter_reset_on_any_nonzero|true\nlog_read|forbidden\nrestart_stop_remove|forbidden\n' > "$tmp_readiness/status.tsv"
  printf 'complete\n' > "$tmp_readiness/COMPLETE"
  write_manifest "$tmp_readiness/SHA256SUMS" COMPLETE postgres-logging.actual.tsv postgres-logging.expected.tsv status.tsv
  chmod 0600 "$tmp_readiness"/*
  for member in COMPLETE SHA256SUMS postgres-logging.actual.tsv postgres-logging.expected.tsv status.tsv; do
    test -f "$tmp_readiness/$member" && test ! -L "$tmp_readiness/$member"
    test "$(stat -c '%U|%G|%a' "$tmp_readiness/$member")" = 'root|root|600'
  done
  (cd "$tmp_readiness" && safe_manifest_check SHA256SUMS >/dev/null)
  python3 - "$tmp_readiness" <<'PY'
import os,sys
p=sys.argv[1]
for name in ('COMPLETE','SHA256SUMS','postgres-logging.actual.tsv','postgres-logging.expected.tsv','status.tsv'):
 fd=os.open(os.path.join(p,name),os.O_RDONLY)
 try: os.fsync(fd)
 finally: os.close(fd)
fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY)
try: os.fsync(fd)
finally: os.close(fd)
PY
  python3 - "$tmp_readiness" "$readiness_dir" <<'PY'
import ctypes,errno,os,sys
src,dst=map(os.fsencode,sys.argv[1:3]);libc=ctypes.CDLL(None,use_errno=True)
fn=getattr(libc,'renameat2',None)
if fn is None: raise SystemExit(74)
fn.argtypes=(ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint)
if fn(-100,src,-100,dst,1)!=0:
 e=ctypes.get_errno()
 if e==errno.EEXIST: raise SystemExit(73)
 if e in (errno.ENOSYS,errno.EINVAL,errno.ENOTSUP): raise SystemExit(74)
 raise OSError(e,os.strerror(e))
fd=os.open(os.path.dirname(os.fsdecode(dst)),os.O_RDONLY|os.O_DIRECTORY)
try: os.fsync(fd)
finally: os.close(fd)
PY
fi
```

Expected: every Docker/SQL command has a maximum five-second `timeout --foreground` bound inside the 120-second overall deadline. Exit 124 and every other nonzero result reset the consecutive counter; metadata preflight failures stop. All five seal members are exact regular non-symlink root:root 0600 files with exact content/schema and a four-row manifest. Publication uses `renameat2(RENAME_NOREPLACE)` and hard-fails on EEXIST or unsupported kernels; no check-then-move race exists.

- [ ] **Step 3R: Reject advanced catalog/role state through one bounded credential-mount probe**

```bash
set -euo pipefail
timeout_bin=/usr/bin/timeout
test -x "$timeout_bin" && test "$(command -v timeout)" = "$timeout_bin"
recovery_dir=/opt/thoidai-reconciliation/phase0-v5-execution-20260815T041430Z-7fa3f327f5c8
lane_container=thoidai_phase0_v3_cd3186598cd4
for forbidden in restore.status.tsv FIDELITY.COMPLETE TASK5.COMPLETE; do test ! -e "$recovery_dir/$forbidden" && test ! -L "$recovery_dir/$forbidden"; done
test ! -e /opt/thoidai-reconciliation/phase0-v5-execution.current
test ! -L /opt/thoidai-reconciliation/phase0-v5-execution.current
test -d "$recovery_dir/readiness-v17" && test ! -L "$recovery_dir/readiness-v17"
(cd "$recovery_dir/readiness-v17" && safe_manifest_check SHA256SUMS >/dev/null)
set +e
"$timeout_bin" --foreground 5s docker exec "$lane_container" test -f /run/secrets/phase0-postgres-password >/dev/null 2>&1
credential_file_rc=$?
set -e
case "$credential_file_rc" in 0) ;; 124) exit 42 ;; *) exit 41 ;; esac
set +e
"$timeout_bin" --foreground 5s docker exec "$lane_container" test -r /run/secrets/phase0-postgres-password >/dev/null 2>&1
credential_readable_rc=$?
set -e
case "$credential_readable_rc" in 0) ;; 124) exit 42 ;; *) exit 41 ;; esac
set +e
boundary=$("$timeout_bin" --foreground 5s docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "
 select 'role',rolname,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,(rolpassword is null) from pg_roles where rolname in ('phase0_bootstrap','postgres','supabase_admin','anon','authenticated','service_role') order by rolname;
 select 'database',d.datname,r.rolname from pg_database d join pg_roles r on r.oid=d.datdba where d.datname in ('postgres','phase0_fresh_cd3186598cd4','phase0_diag_cd3186598cd4','phase0_successor_cd3186598cd4') order by d.datname;
 select 'memberships',count(*) from pg_auth_members m join pg_roles a on a.oid=m.roleid join pg_roles b on b.oid=m.member where a.rolname='phase0_bootstrap' or b.rolname='phase0_bootstrap';" 2>/dev/null)
boundary_rc=$?
set -e
case "$boundary_rc" in 0) ;; 124) exit 42 ;; *) exit 41 ;; esac
expected_boundary=$'role|phase0_bootstrap|t|t|t|t|t|t|t|-1|f\ndatabase|postgres|phase0_bootstrap\nmemberships|0'
test "$boundary" = "$expected_boundary"
```

Expected: the only selected role is the exact bootstrap superuser with its audited attributes and no membership; `postgres` database ownership is exact; all three expected databases and five archive roles are absent by exact selected-row equality. The mounted credential path is checked for existence/readability inside the container but its bytes are never read, expanded, printed, hashed, or passed as an argument. Exit 124 is a distinct timeout stop; every other nonzero exit is a hard failure.

- [x] **Historical v5 Step 1: the original immutable gate passed; do not rerun it for v17 re-entry**

This gate is entirely read-only. A failure stops before an evidence directory, secret, volume, container, or database is created. The small bootstrap below authenticates the package and its single reusable `VERIFY.sh`; that helper then performs the complete approval/package/commit/canonical/unrelated-state validation. The exact same invocation is repeated in Step 6.

```text
set -euo pipefail
repo=/opt/thoidai-work
handoff_pointer=/opt/thoidai-reconciliation/HANDOFF.current
invoke_full_immutable_gate() {
  local pointer=$1 package payload
  test -f "$pointer"
  test ! -L "$pointer"
  test "$(stat -c '%U|%G|%a' "$pointer")" = 'root|root|600'
  test "$(awk 'END{print NR+0}' "$pointer")" -eq 1
  IFS= read -r package < "$pointer"
  case "$package" in
    /opt/thoidai-reconciliation/phase0-execution-handoff-*) ;;
    *) return 41 ;;
  esac
  test -d "$package"
  test ! -L "$package"
  test "$(stat -c '%U|%G|%a' "$package")" = 'root|root|700'
  printf 'COMMIT.tsv\nREVIEW.tsv\nSHA256SUMS\nVERIFY.sh\ndesign.md\nplan.md\n' | cmp -s - \
    <(find "$package" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
  for payload in plan.md design.md COMMIT.tsv REVIEW.tsv VERIFY.sh SHA256SUMS; do
    test -f "$package/$payload"
    test ! -L "$package/$payload"
    test "$(stat -c '%U|%G|%a' "$package/$payload")" = 'root|root|600'
  done
  test "$(awk 'END{print NR+0}' "$package/SHA256SUMS")" -eq 5
  awk 'NF!=2 || $1 !~ /^[0-9a-f]{64}$/ {exit 41}' "$package/SHA256SUMS"
  printf 'plan.md\ndesign.md\nCOMMIT.tsv\nREVIEW.tsv\nVERIFY.sh\n' | cmp -s - <(awk '{print $2}' "$package/SHA256SUMS")
  (cd "$package" && safe_manifest_check SHA256SUMS >/dev/null)
  bash "$package/VERIFY.sh" "$pointer"
  printf '%s\n' "$package"
}
handoff_package=$(invoke_full_immutable_gate "$handoff_pointer")
test -n "$handoff_package"
```

Expected: the one sealed full gate rejects any pointer, package, payload, schema, approval, Git object, canonical byte, or unrelated-worktree ambiguity. `REVIEW.tsv` must have exactly the ten approved keys and no duplicate/conflicting/extra record; `COMMIT.tsv` must have exactly its complete bound schema. HEAD is a non-merge direct child of the authorized predecessor with exactly the two documentation paths; the index and canonical paths are clean against HEAD; reviewed, packaged, canonical, and committed bytes are identical.

- [x] **Historical v5 Step 2: baselines and the pending recovery directory exist; do not recreate or replace them**

Only after Step 1 passes, create the execution directory. Quarantine inspection selects metadata fields and never inspects environment values, mounts containing secrets, database state, or log content.

```text
set -euo pipefail
umask 077
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r old_run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r old_run_id quarantine_container quarantine_volume old_bootstrap old_bootstrap_db old_database < "$old_run_dir/names.tsv"
test -n "$quarantine_container"
test -n "$quarantine_volume"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
nonce=$(openssl rand -hex 6)
recovery_dir="/opt/thoidai-reconciliation/phase0-v5-execution-$stamp-$nonce"
install -d -m 0700 "$recovery_dir"
printf '%s\n' "$recovery_dir" > "$recovery_dir/self.path"
chmod 0600 "$recovery_dir/self.path"
pending_tmp=$(mktemp /opt/thoidai-reconciliation/.phase0-v5-execution.pending.XXXXXX)
printf '%s\n' "$recovery_dir" > "$pending_tmp"
chmod 0600 "$pending_tmp"
mv -T "$pending_tmp" /opt/thoidai-reconciliation/phase0-v5-execution.pending
docker inspect -f 'container_id|{{.Id}}{{println}}state|{{.State.Status}}{{println}}image_id|{{.Image}}{{println}}network|{{.HostConfig.NetworkMode}}{{println}}log_driver|{{.HostConfig.LogConfig.Type}}{{println}}privileged|{{.HostConfig.Privileged}}{{println}}restart|{{.HostConfig.RestartPolicy.Name}}{{println}}auto_remove|{{.HostConfig.AutoRemove}}' \
  "$quarantine_container" > "$recovery_dir/quarantine-container.before.tsv"
docker volume inspect -f 'name|{{.Name}}{{println}}driver|{{.Driver}}{{println}}scope|{{.Scope}}' \
  "$quarantine_volume" > "$recovery_dir/quarantine-volume.before.tsv"
printf 'runtime_session|forbidden\nlog_read|forbidden\ncontainer_mutation|false\nvolume_mutation|false\n' \
  > "$recovery_dir/quarantine-policy.tsv"
cd "$repo"
git rev-parse HEAD > "$recovery_dir/head.before"
git rev-parse HEAD^{tree} > "$recovery_dir/tree.before"
git status --porcelain=v1 --untracked-files=all > "$recovery_dir/root-status.before"
sha256sum "$recovery_dir/root-status.before" | awk '{print $1}' > "$recovery_dir/root-status.before.sha256"
test "$(git diff --cached --name-only | wc -l)" -eq 0
systemctl show thoidai-work -p ActiveState -p SubState -p MainPID -p NRestarts -p ExecMainStartTimestampMonotonic --value \
  > "$recovery_dir/application-systemd.before.tsv"
systemctl cat thoidai-work | sha256sum | awk '{print $1}' > "$recovery_dir/application-unit.before.sha256"
main_pid=$(systemctl show thoidai-work -p MainPID --value)
test "$main_pid" -gt 1
readlink -f "/proc/$main_pid/exe" | sha256sum | awk '{print $1}' > "$recovery_dir/application-exe-path.before.sha256"
sha256sum "$(readlink -f "/proc/$main_pid/exe")" | awk '{print $1}' > "$recovery_dir/application-exe.before.sha256"
sha256sum "$repo/.next/BUILD_ID" | awk '{print $1}' > "$recovery_dir/build-id.before.sha256"
stat -c '%d|%i|%s|%Y|%F' "$repo/.next" > "$recovery_dir/next-stat.before.tsv"
ss -H -lntup | awk '{print $1"|"$5"|"$7}' | LC_ALL=C sort | sha256sum | awk '{print $1}' \
  > "$recovery_dir/socket-topology.before.sha256"
docker ps --format '{{.Names}}|{{.Image}}' | LC_ALL=C sort | sha256sum | awk '{print $1}' \
  > "$recovery_dir/docker-topology.before.sha256"
printf 'provider_model_mutation_authorized|false\nprovider_model_mutation_count|0\nCLIProxyAPI_mutation_authorized|false\nCLIProxyAPI_mutation_count|0\n9router_mutation_authorized|false\n9router_mutation_count|0\nproc_environment_read|false\nprovider_secret_read_or_hash|false\n' \
  > "$recovery_dir/routing-preservation.before.tsv"
test "$(systemctl is-active thoidai-work)" = active
test "$(systemctl is-active nginx)" = active
nginx -t
test "$(docker inspect -f '{{.State.Running}}' supabase_db_thoidai-work)" = true
docker exec supabase_db_thoidai-work pg_isready -q -U postgres -d postgres
curl -sS -o /dev/null --max-time 10 -w '%{http_code}\n' http://127.0.0.1:3001/login > "$recovery_dir/login-http.before.tsv"
test "$(cat "$recovery_dir/login-http.before.tsv")" = 200
curl -sS -o /dev/null --max-time 10 -w '%{http_code}\n' http://127.0.0.1:3001/api/auth/session > "$recovery_dir/session-http.before.tsv"
test "$(cat "$recovery_dir/session-http.before.tsv")" = 401
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "begin read only;
select (select count(*) from supabase_migrations.schema_migrations),
       (select count(*) from supabase_migrations.schema_migrations where version in
       ('20260813172000','20260813210000','20260813220000','20260813230000','20260813233000','20260813234500','20260814070000','20260814102000','20260814130000','20260814160000','20260814170000'));
commit;" > "$recovery_dir/production-history.before.tsv"
grep -Fx '9|0' "$recovery_dir/production-history.before.tsv"
docker exec -i supabase_db_thoidai-work psql -X -U postgres -d postgres -qAtF '|' -v ON_ERROR_STOP=1 <<'SQL' \
  > "$recovery_dir/production-data.before.tsv"
begin read only;
select 'ADMIN_POLICY',count(*) filter(where r.code='admin'),
 count(*) filter(where r.code='admin' and rp.can_manage_users and rp.can_manage_permissions
   and rp.can_create_task and rp.can_edit_all_tasks and rp.can_comment)
from public.roles r join public.role_permissions rp on rp.role_id=r.id;
select 'TBT_POLICY',count(*) filter(where r.code in ('tong_bien_tap','tbt_read_only')),
 count(*) filter(where r.code in ('tong_bien_tap','tbt_read_only')
   and not rp.can_manage_users and not rp.can_manage_permissions
   and not rp.can_create_task and not rp.can_edit_all_tasks and not rp.can_comment)
from public.roles r join public.role_permissions rp on rp.role_id=r.id;
select 'JOB_TITLE',count(*),(select count(*) from public.staff_users where job_title_id is not null),
 (select count(*) from public.staff_users su left join public.job_titles jt on jt.id=su.job_title_id
   where su.job_title_id is not null and jt.id is null)
from public.job_titles;
select 'LIST_ORDER',count(*) filter(where list_order<0),count(*) filter(where list_order>0),
 count(distinct list_order) filter(where list_order>0),
 coalesce(min(list_order) filter(where list_order>0),0),coalesce(max(list_order) filter(where list_order>0),0)
from public.staff_users;
commit;
SQL
test "$(sha256sum "$recovery_dir/production-data.before.tsv" | awk '{print $1}')" = 8a3630780d584b8d75c2ec87ec400d2f6262949e606c08c1465b97b769eaf807
docker exec -i supabase_db_thoidai-work psql -X -U postgres -d postgres -qAtF '|' -v ON_ERROR_STOP=1 <<'SQL' \
  > "$recovery_dir/production-functions.before.tsv"
begin read only;
select p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),
       p.prosecdef,pg_get_userbyid(p.proowner),md5(p.prosrc),coalesce(array_to_string(p.proconfig,','),''),
       has_function_privilege('anon',p.oid,'EXECUTE'),
       has_function_privilege('authenticated',p.oid,'EXECUTE'),
       has_function_privilege('service_role',p.oid,'EXECUTE')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'validate_task_report_recipient','claim_task_plan','save_task_evaluation_checkpoint',
 'ensure_staff_password_hash','consume_password_reset','can_administer_users',
 'touch_job_titles_updated_at','guard_staff_job_title_write','create_bulk_task_plan',
 'report_task_progress','review_task_completion','prepare_admin_password_reset','finalize_admin_password_reset')
order by p.proname,pg_get_function_identity_arguments(p.oid);
commit;
SQL
test "$(sha256sum "$recovery_dir/production-functions.before.tsv" | awk '{print $1}')" = eeaf94c0015d930e3abf84f7309030ba5700fe6df8410430cf9bf6f6f0eddc52
chmod 0600 "$recovery_dir"/*
```

Expected: quarantine policy is explicit; selected metadata, Git, production history `9|0`, service, build, process, HTTP, and topology baselines are sealed. No environment or provider-secret bytes are read or hashed.

- [x] **Historical v5 Step 3: exact names and secret exist; do not reallocate or regenerate them**

```text
set -euo pipefail
umask 077
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.pending
test -d "$recovery_dir"
test "$(stat -c '%U|%a' "$recovery_dir")" = 'root|700'
approved_image='postgres@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d'
approved_image_id='sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d'
test "$(docker image inspect -f '{{.Id}}' "$approved_image")" = "$approved_image_id"
test "$(docker image inspect -f '{{.Os}}|{{.Architecture}}' "$approved_image")" = 'linux|amd64'
available_kib=$(df -Pk /var/lib/docker | awk 'NR==2{print $4}')
available_mem_kib=$(awk '/MemAvailable:/{print $2}' /proc/meminfo)
test "$available_kib" -ge 5242880
test "$available_mem_kib" -ge 2097152
nonce=$(openssl rand -hex 6)
lane_container="thoidai_phase0_v3_$nonce"
lane_volume="thoidai_phase0_v3_data_$nonce"
fresh_db="phase0_fresh_$nonce"
diagnostic_db="phase0_diag_$nonce"
successor_db="phase0_successor_$nonce"
for safe_name in "$lane_container" "$lane_volume" "$fresh_db" "$diagnostic_db" "$successor_db"; do
  [[ "$safe_name" =~ ^[a-z][a-z0-9_]{5,62}$ ]]
done
! docker container inspect "$lane_container" >/dev/null 2>&1
! docker volume inspect "$lane_volume" >/dev/null 2>&1
secret_file="$recovery_dir/postgres-password.secret"
test ! -e "$secret_file"
openssl rand -base64 48 > "$secret_file"
chown root:root "$secret_file"
chmod 0600 "$secret_file"
test -s "$secret_file"
printf 'container|%s\nvolume|%s\nfresh_template|%s\ndiagnostic|%s\nsuccessor|%s\n' \
  "$lane_container" "$lane_volume" "$fresh_db" "$diagnostic_db" "$successor_db" \
  > "$recovery_dir/lane-names.tsv"
printf 'image_id|%s\nnetwork|none\nports|0\nlog_driver|none\ncpu_nano|1000000000\nmemory|1073741824\nmemory_swap|1073741824\npids|256\nrestart|no\nauto_remove|false\nprivileged|false\n' \
  "$approved_image_id" > "$recovery_dir/lane-policy.expected.tsv"
chmod 0600 "$recovery_dir/lane-names.tsv" "$recovery_dir/lane-policy.expected.tsv"
```

Expected: local pinned image and headroom pass; five noncolliding safe names and a new unread/unhashed secret are created. No image pull occurs.

- [x] **Historical v5 Step 4: creation/start completed, then the single-probe sequence failed; do not rerun this block**

```text
set -euo pipefail
umask 077
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.pending
test -d "$recovery_dir"
test "$(stat -c '%U|%a' "$recovery_dir")" = 'root|700'
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
lane_volume=$(awk -F '|' '$1=="volume"{print $2}' "$recovery_dir/lane-names.tsv")
secret_file="$recovery_dir/postgres-password.secret"
approved_image='postgres@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d'
docker volume create "$lane_volume" >/dev/null
docker volume inspect -f 'name|{{.Name}}{{println}}driver|{{.Driver}}{{println}}scope|{{.Scope}}' \
  "$lane_volume" > "$recovery_dir/lane-volume.before.tsv"
docker create --name "$lane_container" \
  --network none \
  --log-driver none \
  --cpus 1 \
  --memory 1g \
  --memory-swap 1g \
  --pids-limit 256 \
  --restart no \
  --mount "type=volume,src=$lane_volume,dst=/var/lib/postgresql/data" \
  --mount "type=bind,src=$secret_file,dst=/run/secrets/phase0-postgres-password,readonly" \
  --tmpfs /run/phase0:rw,noexec,nosuid,size=16m,mode=0700 \
  --env POSTGRES_USER=phase0_bootstrap \
  --env POSTGRES_DB=postgres \
  --env POSTGRES_PASSWORD_FILE=/run/secrets/phase0-postgres-password \
  --env 'POSTGRES_INITDB_ARGS=--encoding=UTF8 --locale-provider=icu --icu-locale=en-US --locale=en_US.UTF-8' \
  "$approved_image" \
  -c log_statement=none \
  -c log_min_error_statement=panic \
  -c logging_collector=off \
  -c log_destination=stderr \
  -c log_error_verbosity=terse >/dev/null
test "$(docker inspect -f '{{.Image}}' "$lane_container")" = 'sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d'
test "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$lane_container")" = none
test "$(docker inspect -f '{{.HostConfig.LogConfig.Type}}' "$lane_container")" = none
test "$(docker inspect -f '{{.HostConfig.Privileged}}' "$lane_container")" = false
test "$(docker inspect -f '{{.HostConfig.NanoCpus}}' "$lane_container")" -eq 1000000000
test "$(docker inspect -f '{{.HostConfig.Memory}}' "$lane_container")" -eq 1073741824
test "$(docker inspect -f '{{.HostConfig.MemorySwap}}' "$lane_container")" -eq 1073741824
test "$(docker inspect -f '{{.HostConfig.PidsLimit}}' "$lane_container")" -eq 256
test "$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$lane_container")" = no
test "$(docker inspect -f '{{.HostConfig.AutoRemove}}' "$lane_container")" = false
test -z "$(docker port "$lane_container")"
test "$(docker inspect -f '{{len .Mounts}}' "$lane_container")" -eq 2
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Type}}|{{.Name}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "volume|$lane_volume|true"
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/run/secrets/phase0-postgres-password"}}{{.Type}}|{{.Source}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "bind|$secret_file|false"
test "$(docker inspect -f '{{index .HostConfig.Tmpfs "/run/phase0"}}' "$lane_container")" = 'rw,noexec,nosuid,size=16m,mode=0700'
test -z "$(docker inspect -f '{{.HostConfig.PidMode}}' "$lane_container")"
test "$(docker inspect -f '{{.HostConfig.IpcMode}}' "$lane_container")" = private
test "$(docker inspect -f '{{len .HostConfig.CapAdd}}|{{len .HostConfig.Devices}}' "$lane_container")" = '0|0'
docker inspect -f 'image_id|{{.Image}}{{println}}network|{{.HostConfig.NetworkMode}}{{println}}ports|{{len .NetworkSettings.Ports}}{{println}}log_driver|{{.HostConfig.LogConfig.Type}}{{println}}cpu_nano|{{.HostConfig.NanoCpus}}{{println}}memory|{{.HostConfig.Memory}}{{println}}memory_swap|{{.HostConfig.MemorySwap}}{{println}}pids|{{.HostConfig.PidsLimit}}{{println}}restart|{{.HostConfig.RestartPolicy.Name}}{{println}}auto_remove|{{.HostConfig.AutoRemove}}{{println}}privileged|{{.HostConfig.Privileged}}' \
  "$lane_container" > "$recovery_dir/lane-policy.actual.tsv"
cmp -s "$recovery_dir/lane-policy.expected.tsv" "$recovery_dir/lane-policy.actual.tsv"
docker start "$lane_container" >/dev/null
ready=false
for attempt in $(seq 1 45); do
  if docker exec "$lane_container" pg_isready -q -U phase0_bootstrap -d postgres; then
    ready=true
    break
  fi
  sleep 1
done
if test "$ready" != true; then
  printf 'ready|false\nlog_read|forbidden\nretained|true\n' > "$recovery_dir/lane-start.failure.tsv"
  chmod 0600 "$recovery_dir/lane-start.failure.tsv"
  exit 42
fi
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select name,setting from pg_settings where name in
   ('log_statement','log_min_error_statement','logging_collector','log_destination','log_error_verbosity') order by name;" \
  > "$recovery_dir/postgres-logging.actual.tsv"
cat > "$recovery_dir/postgres-logging.expected.tsv" <<'EOF'
log_destination|stderr
log_error_verbosity|terse
log_min_error_statement|panic
log_statement|none
logging_collector|off
EOF
cmp -s "$recovery_dir/postgres-logging.expected.tsv" "$recovery_dir/postgres-logging.actual.tsv"
chmod 0600 "$recovery_dir"/*
```

Expected: the container is running with exact image, network, port, log-driver, resource, privilege, restart, mount, tmpfs, and PostgreSQL logging controls. Readiness failure records only generic status and retains the container without restart or cleanup.

- [ ] **Step 5: Bootstrap roles, restore the fresh template, normalize, and clone two new lanes**

```bash
set -euo pipefail
umask 077
: "${V17_REVIEW_PACKAGE:?exact externally supplied v17 review-package path required}"
: "${V17_REVIEW_MANIFEST_SHA256:?exact externally supplied SHA256SUMS digest required}"
review_package=$V17_REVIEW_PACKAGE
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.pending
test -d "$recovery_dir"
test "$(stat -c '%U|%a' "$recovery_dir")" = 'root|700'
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
fresh_db=$(awk -F '|' '$1=="fresh_template"{print $2}' "$recovery_dir/lane-names.tsv")
diagnostic_db=$(awk -F '|' '$1=="diagnostic"{print $2}' "$recovery_dir/lane-names.tsv")
successor_db=$(awk -F '|' '$1=="successor"{print $2}' "$recovery_dir/lane-names.tsv")
archive="$evidence_root/public-history-schema.dump"
test "$(sha256sum "$archive" | awk '{print $1}')" = 674fa9610e9de26afe3716efe4554db9706247c0930dda3e90fd90ec26bb117b
cd "$repo"
source_names=(20260813110000_task_evaluation_checkpoints.sql 20260813155000_allow_tbt_task_evaluation.sql 20260813172000_task_plans_recipients_self_claim.sql 20260813184000_secure_task_rpc_execution.sql 20260813210000_password_reset_security.sql 20260813220000_task_evaluation_total_score.sql 20260813230000_admin_role_user_policy.sql 20260813233000_tbt_evaluation_guard.sql 20260813234500_creator_evaluation_guard.sql 20260814070000_job_titles.sql 20260814090000_task_priority_neutral_default.sql 20260814102000_bulk_task_plans.sql 20260814113000_localize_role_names.sql 20260814130000_staff_list_order.sql 20260814160000_employee_password_reset_admin.sql 20260814170000_employee_password_reset_hardening.sql)
review_exec SAFE_MANIFEST.py manifest --directory "$review_package" --manifest SOURCE-SHA256SUMS --separator one --member-root "$repo/supabase/migrations" --member-root-mode 755 --member-mode 644 --allow-extra "${source_names[@]}"
old_run_dir="$evidence_root/isolated-20260814163047_c35634c9"
(cd "$old_run_dir" && safe_manifest_check TASK4-SHA256SUMS >/dev/null)
docker exec -i "$lane_container" psql -X -U phase0_bootstrap -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
do $guard$
begin
  if not exists (select 1 from pg_roles where rolname='pg_database_owner') then raise exception 'built-in database-owner role missing'; end if;
  if exists (select 1 from pg_roles where rolname in ('postgres','supabase_admin','anon','authenticated','service_role')) then raise exception 'archive role collision'; end if;
end
$guard$;
create role postgres nosuperuser inherit createrole createdb login replication bypassrls password null;
create role supabase_admin superuser inherit createrole createdb login replication bypassrls password null;
create role anon nosuperuser inherit nocreaterole nocreatedb nologin noreplication nobypassrls password null;
create role authenticated nosuperuser inherit nocreaterole nocreatedb nologin noreplication nobypassrls password null;
create role service_role nosuperuser inherit nocreaterole nocreatedb nologin noreplication bypassrls password null;
grant anon,authenticated,service_role,pg_create_subscription,pg_monitor,pg_read_all_data,pg_signal_backend to postgres with admin option;
SQL
awk -F '|' 'BEGIN{OFS="|"}{print $1,$2,$3,$5,$4,$6,$7,$8,-1,$9}' "$old_run_dir/archive-roles.expected.tsv" > "$recovery_dir/role-manifest.expected.unsorted.tsv"
cat >> "$recovery_dir/role-manifest.expected.unsorted.tsv" <<'EOF'
phase0_bootstrap|t|t|t|t|t|t|t|-1|f
pg_create_subscription|f|t|f|f|f|f|f|-1|t
pg_monitor|f|t|f|f|f|f|f|-1|t
pg_read_all_data|f|t|f|f|f|f|f|-1|t
pg_signal_backend|f|t|f|f|f|f|f|-1|t
EOF
LC_ALL=C sort "$recovery_dir/role-manifest.expected.unsorted.tsv" > "$recovery_dir/role-manifest.expected.tsv"
rm -f "$recovery_dir/role-manifest.expected.unsorted.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "
select rolname,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,rolpassword is null
from pg_authid where rolname in ('phase0_bootstrap','postgres','supabase_admin','anon','authenticated','service_role','pg_database_owner','pg_create_subscription','pg_monitor','pg_read_all_data','pg_signal_backend') order by rolname;" > "$recovery_dir/role-manifest.actual.tsv"
cmp -s "$recovery_dir/role-manifest.expected.tsv" "$recovery_dir/role-manifest.actual.tsv"
cat > "$recovery_dir/role-memberships.expected.tsv" <<'EOF'
anon|postgres|t|t|t
authenticated|postgres|t|t|t
pg_create_subscription|postgres|t|t|t
pg_monitor|postgres|t|t|t
pg_read_all_data|postgres|t|t|t
pg_signal_backend|postgres|t|t|t
service_role|postgres|t|t|t
EOF
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "
select granted_role.rolname,member_role.rolname,m.admin_option,m.inherit_option,m.set_option
from pg_auth_members m join pg_roles granted_role on granted_role.oid=m.roleid join pg_roles member_role on member_role.oid=m.member
where member_role.rolname in ('phase0_bootstrap','postgres','supabase_admin','anon','authenticated','service_role') or granted_role.rolname in ('postgres','supabase_admin','anon','authenticated','service_role') order by 1,2,3,4,5;" > "$recovery_dir/role-memberships.actual.tsv"
cmp -s "$recovery_dir/role-memberships.expected.tsv" "$recovery_dir/role-memberships.actual.tsv"
install -m 0600 /dev/null "$recovery_dir/role-forbidden.expected.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "
select rolname from pg_roles where rolname in ('authenticator','supabase_functions_admin','supabase_privileged_role','supabase_realtime_admin') order by rolname;" > "$recovery_dir/role-forbidden.actual.tsv"
cmp -s "$recovery_dir/role-forbidden.expected.tsv" "$recovery_dir/role-forbidden.actual.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -v ON_ERROR_STOP=1 \
  -v fresh_db="$fresh_db" -c "create database :\"fresh_db\" with owner postgres template template0 encoding 'UTF8' locale_provider icu icu_locale 'en-US' locale 'en_US.UTF-8';" >/dev/null
docker exec "$lane_container" psql -X -U phase0_bootstrap -d "$fresh_db" -v ON_ERROR_STOP=1 -c \
  "create schema extensions authorization postgres;" >/dev/null
docker exec "$lane_container" psql -X -U postgres -d "$fresh_db" -v ON_ERROR_STOP=1 -c \
  "create extension pgcrypto with schema extensions;" >/dev/null
test "$(docker exec "$lane_container" psql -X -U phase0_bootstrap -d "$fresh_db" -qAt -v ON_ERROR_STOP=1 -c \
  "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public';")" -eq 0
docker exec "$lane_container" psql -X -U phase0_bootstrap -d "$fresh_db" -v ON_ERROR_STOP=1 -c \
  "drop schema public;" >/dev/null
set +e
docker exec -i "$lane_container" pg_restore -U phase0_bootstrap -d "$fresh_db" --no-comments --exit-on-error --single-transaction \
  < "$archive" >/dev/null 2>/dev/null
restore_status=$?
set -e
printf 'restore_status|%s\nraw_output_persisted|false\n' "$restore_status" > "$recovery_dir/restore.status.tsv"
test "$restore_status" -eq 0
old_run_dir="$evidence_root/isolated-20260814163047_c35634c9"
grep -Fx 'semantic_public_usage_grants|0' "$old_run_dir/archive-public-schema-acl.counts.tsv"
grep -Fx 'production|7|1' "$old_run_dir/production-acl-normalization.before.tsv"
grep -Fx 'production|7|1' "$old_run_dir/production-acl-normalization.after.tsv"
grep -Fx 'normalization_status|0' "$old_run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'pre_guard|6/0' "$old_run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'post_guard|7/1' "$old_run_dir/isolated-acl-normalization.status.tsv"
grep -Fx 'isolated_pre|6|0' "$old_run_dir/isolated-acl-normalization.pre.tsv"
grep -Fx 'isolated_post|7|1' "$old_run_dir/isolated-acl-normalization.post.tsv"
docker exec "$lane_container" psql -X -U postgres -d "$fresh_db" -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select count(*),count(*) filter(where a.grantee=0 and a.privilege_type='USAGE')
   from aclexplode(coalesce((select nspacl from pg_namespace where nspname='public'),
        acldefault('n',(select nspowner from pg_namespace where nspname='public')))) a;" \
  > "$recovery_dir/public-usage.pre.tsv"
grep -Fx '6|0' "$recovery_dir/public-usage.pre.tsv"
docker exec "$lane_container" psql -X -U postgres -d "$fresh_db" -v ON_ERROR_STOP=1 -c \
  "begin; grant usage on schema public to public; commit;" >/dev/null
docker exec "$lane_container" psql -X -U postgres -d "$fresh_db" -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select count(*),count(*) filter(where a.grantee=0 and a.privilege_type='USAGE')
   from aclexplode(coalesce((select nspacl from pg_namespace where nspname='public'),
        acldefault('n',(select nspowner from pg_namespace where nspname='public')))) a;" \
  > "$recovery_dir/public-usage.post.tsv"
grep -Fx '7|1' "$recovery_dir/public-usage.post.tsv"
capture_lane_fidelity() {
  local lane_db=$1
  local prefix=$2
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "
select 'COLUMN',table_name,column_name,data_type,is_nullable,
       case when column_default is null then 'no_default' else 'has_default' end,
       is_generated,md5(coalesce(generation_expression,''))
from information_schema.columns
where table_schema='public' and (
 (table_name='tasks' and column_name in ('plan_period','self_claimable','plan_batch_id'))
 or (table_name='staff_users' and column_name in ('password','password_hash','job_title_id','list_order','session_version'))
 or (table_name='task_evaluation_checkpoints' and column_name='total_score'))
union all
select 'TABLE',c.relname,'-',c.relkind::text,c.relrowsecurity::text,c.relforcerowsecurity::text,'-',
       md5((select string_agg(x.column_name||':'||x.data_type,',' order by x.ordinal_position)
            from information_schema.columns x where x.table_schema='public' and x.table_name=c.relname))
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and c.relname in ('job_titles','password_reset_tokens','password_reset_attempts')
order by 1,2,3;" > "$prefix.catalog.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "
select 'INDEX',c.relname,md5(pg_get_indexdef(c.oid))
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='i' and c.relname in (
 'idx_tasks_self_claimable','idx_password_reset_tokens_user_created','idx_password_reset_tokens_expiry',
 'idx_password_reset_attempts_fingerprint_created','job_titles_code_lower_uidx','job_titles_name_lower_uidx',
 'staff_users_job_title_id_idx','idx_tasks_plan_batch_id','staff_users_list_order_idx')
union all
select 'CONSTRAINT',conname,md5(pg_get_constraintdef(oid,true)) from pg_constraint
where conname in ('tasks_plan_period_check','staff_users_list_order_nonnegative','staff_users_session_version_nonnegative')
union all
select 'TRIGGER',trigger_name,md5(string_agg(event_manipulation,',' order by event_manipulation))
from information_schema.triggers where trigger_schema='public' and trigger_name in (
 'validate_task_report_recipient','trg_staff_users_password_hash','job_titles_set_updated_at','staff_users_guard_job_title_write')
group by trigger_name
union all
select 'POLICY',policyname,md5(cmd||':'||coalesce(qual,'')||':'||coalesce(with_check,''))
from pg_policies where schemaname='public' and policyname in (
 'public read job_titles','protect_password_reset_audit_insert','protect_password_reset_audit_update','protect_password_reset_audit_delete')
order by 1,2;" >> "$prefix.catalog.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "
select p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),
       p.prosecdef,pg_get_userbyid(p.proowner),md5(p.prosrc),coalesce(array_to_string(p.proconfig,','),''),
       has_function_privilege('anon',p.oid,'EXECUTE'),has_function_privilege('authenticated',p.oid,'EXECUTE'),
       has_function_privilege('service_role',p.oid,'EXECUTE')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'validate_task_report_recipient','claim_task_plan','save_task_evaluation_checkpoint','ensure_staff_password_hash',
 'consume_password_reset','can_administer_users','touch_job_titles_updated_at','guard_staff_job_title_write',
 'create_bulk_task_plan','report_task_progress','review_task_completion','prepare_admin_password_reset',
 'finalize_admin_password_reset')
order by p.proname,pg_get_function_identity_arguments(p.oid);" > "$prefix.functions.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "select
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='i'),
 (select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'),
 (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal),
 (select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public');" > "$prefix.core.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "
select kind,schema_name,owner_name,object_count from (
 select 'SCHEMA'::text kind,n.nspname schema_name,pg_get_userbyid(n.nspowner) owner_name,count(*)::bigint object_count
 from pg_namespace n where n.nspname='public' group by n.nspname,n.nspowner
 union all
 select 'RELATION:'||c.relkind::text,n.nspname,pg_get_userbyid(c.relowner),count(*)::bigint
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','i','S') group by c.relkind,n.nspname,c.relowner
 union all
 select 'FUNCTION',n.nspname,pg_get_userbyid(p.proowner),count(*)::bigint
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' group by n.nspname,p.proowner
) q order by kind,schema_name,owner_name;" > "$prefix.owner.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "
select 'default_acl',count(*),count(*) filter(where r.rolname='postgres'),count(*) filter(where r.rolname='supabase_admin')
from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace join pg_roles r on r.oid=d.defaclrole where n.nspname='public';
select 'schema_acl',count(*) from pg_namespace n cross join lateral aclexplode(n.nspacl) a where n.nspname='public';
select 'table_acl',count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(c.relacl) a where n.nspname='public' and c.relkind='r';
select 'function_acl',count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(p.proacl) a where n.nspname='public';
with roles(role_name) as (values ('postgres'),('anon'),('authenticated'),('service_role')),
privs(privilege_name) as (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')),
tables as (select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')
select 'table_effective',count(*) filter(where has_table_privilege(role_name,oid,privilege_name)),count(*) from roles cross join privs cross join tables;
with roles(role_name) as (values ('postgres'),('anon'),('authenticated'),('service_role')),
funcs as (select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')
select 'function_effective',count(*) filter(where has_function_privilege(role_name,oid,'EXECUTE')),count(*) from roles cross join funcs;
with roles(role_name) as (values ('postgres'),('anon'),('authenticated'),('service_role')),
privs(privilege_name) as (values ('USAGE'),('CREATE'))
select 'schema_effective',count(*) filter(where has_schema_privilege(role_name,'public',privilege_name)),count(*) from roles cross join privs;" > "$prefix.acl.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "
select extname,extversion,n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace
where extname in ('plpgsql','pgcrypto') order by extname;" > "$prefix.extensions.tsv"
  docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -v lane_db="$lane_db" -c "
select 'database',pg_get_userbyid(d.datdba),pg_encoding_to_char(d.encoding),d.datlocprovider,
       d.datcollate,d.datctype,d.datlocale,d.datallowconn from pg_database d where d.datname=:'lane_db';" > "$prefix.locale.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "
select 'data_checksums',current_setting('data_checksums');
select 'server_version_num',current_setting('server_version_num');" >> "$prefix.locale.tsv"
  docker exec "$lane_container" psql -X -U postgres -d "$lane_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "select
 (select count(*) from public.roles),(select count(*) from public.role_permissions),
 (select count(*) from public.departments),(select count(*) from public.staff_users),
 (select count(*) from public.tasks),(select count(*) from public.audit_logs),
 (select count(*) from supabase_migrations.schema_migrations);" > "$prefix.zero.tsv"
  chmod 0600 "$prefix".*.tsv
}
fresh_prefix="$recovery_dir/fresh-fidelity"
capture_lane_fidelity "$fresh_db" "$fresh_prefix"
test "$(sha256sum "$evidence_root/production-catalog.before.tsv" | awk '{print $1}')" = f51be200ffe272d0a221302eb492ca3b1c7939b30a6e3e96ebef6750982722b5
test "$(sha256sum "$evidence_root/production-function-body.before.tsv" | awk '{print $1}')" = eeaf94c0015d930e3abf84f7309030ba5700fe6df8410430cf9bf6f6f0eddc52
test "$(sha256sum "$old_run_dir/production-owner.before.tsv" | awk '{print $1}')" = 47141fee0d6dab9edd6711e5b707f620225b7a36c931a2e1bef1addc7c747d98
cmp -s "$evidence_root/production-catalog.before.tsv" "$fresh_prefix.catalog.tsv"
cmp -s "$evidence_root/production-function-body.before.tsv" "$fresh_prefix.functions.tsv"
cmp -s "$old_run_dir/production-owner.before.tsv" "$fresh_prefix.owner.tsv"
grep -Fx '21|53|96|5|39|14' "$fresh_prefix.core.tsv"
grep -Fx 'default_acl|6|3|3' "$fresh_prefix.acl.tsv"
grep -Fx 'schema_acl|7' "$fresh_prefix.acl.tsv"
grep -Fx 'table_acl|653' "$fresh_prefix.acl.tsv"
grep -Fx 'function_acl|46' "$fresh_prefix.acl.tsv"
grep -Fx 'table_effective|571|588' "$fresh_prefix.acl.tsv"
grep -Fx 'function_effective|40|56' "$fresh_prefix.acl.tsv"
grep -Fx 'schema_effective|5|8' "$fresh_prefix.acl.tsv"
grep -Fx 'pgcrypto|1.3|extensions' "$fresh_prefix.extensions.tsv"
grep -Fx 'plpgsql|1.0|pg_catalog' "$fresh_prefix.extensions.tsv"
grep -Fx 'database|postgres|UTF8|i|en_US.UTF-8|en_US.UTF-8|en-US|t' "$fresh_prefix.locale.tsv"
grep -Fx 'data_checksums|off' "$fresh_prefix.locale.tsv"
grep -Fx 'server_version_num|170010' "$fresh_prefix.locale.tsv"
grep -Fx '0|0|0|0|0|0|0' "$fresh_prefix.zero.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -v ON_ERROR_STOP=1 \
  -v fresh_db="$fresh_db" -v diagnostic_db="$diagnostic_db" -v successor_db="$successor_db" -c \
  "select 1/ case when (select count(*) from pg_stat_activity where datname=:'fresh_db')=0 then 1 else 0 end;
   create database :\"diagnostic_db\" with owner postgres template :\"fresh_db\";
   create database :\"successor_db\" with owner postgres template :\"fresh_db\";
   alter database :\"fresh_db\" allow_connections false;" >/dev/null
for lane_name in diagnostic successor; do
  if test "$lane_name" = diagnostic; then lane_db=$diagnostic_db; else lane_db=$successor_db; fi
  lane_prefix="$recovery_dir/$lane_name-fidelity"
  capture_lane_fidelity "$lane_db" "$lane_prefix"
  for surface in catalog functions core owner acl extensions locale zero; do
    cmp -s "$fresh_prefix.$surface.tsv" "$lane_prefix.$surface.tsv"
  done
done
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 \
  -v fresh_db="$fresh_db" -v diagnostic_db="$diagnostic_db" -v successor_db="$successor_db" -c "
with requested(lane,datname,expected_connections) as (values
 ('diagnostic',:'diagnostic_db',true),('successor',:'successor_db',true),('template',:'fresh_db',false))
select requested.lane,count(d.*),coalesce(min(pg_get_userbyid(d.datdba)),''),
       coalesce(bool_and(d.datallowconn=requested.expected_connections),false)
from requested left join pg_database d using(datname) group by requested.lane order by requested.lane;" \
  > "$recovery_dir/fresh-fidelity.database-lanes.tsv"
grep -Fx 'diagnostic|1|postgres|t' "$recovery_dir/fresh-fidelity.database-lanes.tsv"
grep -Fx 'successor|1|postgres|t' "$recovery_dir/fresh-fidelity.database-lanes.tsv"
grep -Fx 'template|1|postgres|t' "$recovery_dir/fresh-fidelity.database-lanes.tsv"
cat > "$recovery_dir/replay-owner.expected.tsv" <<'EOF'
diagnostic|postgres|f
fresh|postgres|f
successor|postgres|f
EOF
role_gate="$recovery_dir/verify-role-manifest"
cat > "$role_gate" <<'BASH'
#!/usr/bin/env bash
set -euo pipefail
lane_container=$1; recovery_dir=$2; fresh_db=$3; diagnostic_db=$4; successor_db=$5
(cd / && safe_manifest_check "$recovery_dir/ROLE-EXPECTED-SHA256SUMS" >/dev/null)
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "
select rolname,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,rolpassword is null
from pg_authid where rolname in ('phase0_bootstrap','postgres','supabase_admin','anon','authenticated','service_role','pg_database_owner','pg_create_subscription','pg_monitor','pg_read_all_data','pg_signal_backend') order by rolname;" | cmp -s - "$recovery_dir/role-manifest.expected.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "
select granted_role.rolname,member_role.rolname,m.admin_option,m.inherit_option,m.set_option
from pg_auth_members m join pg_roles granted_role on granted_role.oid=m.roleid join pg_roles member_role on member_role.oid=m.member
where member_role.rolname in ('phase0_bootstrap','postgres','supabase_admin','anon','authenticated','service_role') or granted_role.rolname in ('postgres','supabase_admin','anon','authenticated','service_role') order by 1,2,3,4,5;" | cmp -s - "$recovery_dir/role-memberships.expected.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "select rolname from pg_roles where rolname in ('authenticator','supabase_functions_admin','supabase_privileged_role','supabase_realtime_admin') order by rolname;" | cmp -s - "$recovery_dir/role-forbidden.expected.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -v fresh_db="$fresh_db" -v diagnostic_db="$diagnostic_db" -v successor_db="$successor_db" -c "
with requested(lane,datname) as (values ('diagnostic',:'diagnostic_db'),('fresh',:'fresh_db'),('successor',:'successor_db')) select requested.lane,r.rolname,r.rolsuper from requested join pg_database d using(datname) join pg_authid r on r.oid=d.datdba order by requested.lane;" | cmp -s - "$recovery_dir/replay-owner.expected.tsv"
BASH
chmod 0600 "$role_gate"
write_manifest "$recovery_dir/ROLE-EXPECTED-SHA256SUMS" replay-owner.expected.tsv role-forbidden.expected.tsv role-manifest.expected.tsv role-memberships.expected.tsv verify-role-manifest
chmod 0600 "$recovery_dir/ROLE-EXPECTED-SHA256SUMS"
bash "$role_gate" "$lane_container" "$recovery_dir" "$fresh_db" "$diagnostic_db" "$successor_db"
printf 'roles|PASS\nattributes|exact\nmemberships|exact\nforbidden_roles|zero\nreplay_owner|postgres-nonsuperuser\n' > "$recovery_dir/ROLE-MANIFEST.COMPLETE"
write_manifest "$recovery_dir/ROLE-SHA256SUMS" ROLE-EXPECTED-SHA256SUMS ROLE-MANIFEST.COMPLETE replay-owner.expected.tsv role-forbidden.actual.tsv role-forbidden.expected.tsv role-manifest.actual.tsv role-manifest.expected.tsv role-memberships.actual.tsv role-memberships.expected.tsv verify-role-manifest
(cd / && safe_manifest_check "$recovery_dir/ROLE-SHA256SUMS" >/dev/null)
printf 'fidelity|PASS\nroles|exact\ncore_objects|exact\nowners|exact\ndefault_acl|exact\nexplicit_acl|exact\neffective_privileges|exact\nfunctions_grants|13-exact\nextensions|exact\nlocale_settings|exact\nclone_count|2\n' \
  > "$recovery_dir/FIDELITY.COMPLETE"
mapfile -t fidelity_members < <(find "$recovery_dir" -maxdepth 1 -type f \
  \( -name '*-fidelity.*.tsv' -o -name 'FIDELITY.COMPLETE' \) -printf '%f\n' | LC_ALL=C sort)
write_manifest "$recovery_dir/FIDELITY-SHA256SUMS" "${fidelity_members[@]}"
(cd / && safe_manifest_check "$recovery_dir/FIDELITY-SHA256SUMS" >/dev/null)
chmod 0600 "$recovery_dir"/*
```

Expected: the sealed Task-4 archive-role expectation is extended into an exact eleven-role executable manifest covering bootstrap, archive, replay-owner, and membership-support roles. Every row includes superuser, inherit, database/role creation, login, replication, bypass-RLS, connection-limit, and password-null attributes; the seven allowed memberships and exact empty forbidden-role set compare byte-for-byte. Restore is zero with no raw-output evidence, and the sole normalization is guarded. Fresh-template catalog, core-object, owner, ACL/effective-privilege, thirteen-function/grant, extension, locale/settings, and zero-row evidence matches sealed production/Task-4 expectations; both clones reproduce it. Fresh, diagnostic, and successor are owned by exact non-superuser `postgres`. `ROLE-MANIFEST.COMPLETE`, `FIDELITY.COMPLETE`, and their manifests exist only after all comparisons pass; any mismatch stops before seal. The retained cluster is not queried.

- [ ] **Step 6: Seal Task 5 and publish only the new execution pointer**

The completion marker is the last evidence payload created. It is unreachable until the executable fidelity manifest, immutable package, all new-lane controls, and both quarantine metadata files reverify.

```bash
set -euo pipefail
: "${V17_REVIEW_PACKAGE:?exact externally supplied v17 review-package path required}"
: "${V17_REVIEW_MANIFEST_SHA256:?exact externally supplied SHA256SUMS digest required}"
review_package=$V17_REVIEW_PACKAGE
umask 077
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
repo=/opt/thoidai-work
plan_rel=docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md
design_rel=docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md
read -r recovery_dir < /opt/thoidai-reconciliation/phase0-v5-execution.pending
test -d "$recovery_dir"
test "$(stat -c '%U|%a' "$recovery_dir")" = 'root|700'
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
lane_volume=$(awk -F '|' '$1=="volume"{print $2}' "$recovery_dir/lane-names.tsv")
fresh_db=$(awk -F '|' '$1=="fresh_template"{print $2}' "$recovery_dir/lane-names.tsv")
diagnostic_db=$(awk -F '|' '$1=="diagnostic"{print $2}' "$recovery_dir/lane-names.tsv")
successor_db=$(awk -F '|' '$1=="successor"{print $2}' "$recovery_dir/lane-names.tsv")
secret_file="$recovery_dir/postgres-password.secret"
(cd / && safe_manifest_check "$recovery_dir/FIDELITY-SHA256SUMS" >/dev/null)
grep -Fx 'fidelity|PASS' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'roles|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'core_objects|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'owners|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'default_acl|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'explicit_acl|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'effective_privileges|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'functions_grants|13-exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'extensions|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'locale_settings|exact' "$recovery_dir/FIDELITY.COMPLETE"
grep -Fx 'clone_count|2' "$recovery_dir/FIDELITY.COMPLETE"
test "$(docker image inspect -f '{{.Id}}|{{.Os}}|{{.Architecture}}' postgres@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d)" = 'sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d|linux|amd64'
test "$(docker inspect -f '{{.State.Running}}' "$lane_container")" = true
test "$(docker inspect -f '{{.Image}}' "$lane_container")" = 'sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d'
test "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$lane_container")" = none
port_bindings=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$lane_container")
[[ "$port_bindings" = '{}' || "$port_bindings" = null ]]
test -z "$(docker port "$lane_container")"
test "$(docker inspect -f '{{.HostConfig.LogConfig.Type}}' "$lane_container")" = none
test "$(docker inspect -f '{{.HostConfig.NanoCpus}}|{{.HostConfig.Memory}}|{{.HostConfig.MemorySwap}}|{{.HostConfig.PidsLimit}}' "$lane_container")" = '1000000000|1073741824|1073741824|256'
test "$(docker inspect -f '{{.HostConfig.Privileged}}|{{.HostConfig.RestartPolicy.Name}}|{{.HostConfig.AutoRemove}}' "$lane_container")" = 'false|no|false'
test -z "$(docker inspect -f '{{.HostConfig.PidMode}}' "$lane_container")"
test "$(docker inspect -f '{{.HostConfig.IpcMode}}' "$lane_container")" = private
test "$(docker inspect -f '{{len .HostConfig.CapAdd}}|{{len .HostConfig.Devices}}' "$lane_container")" = '0|0'
test "$(docker inspect -f '{{len .Mounts}}' "$lane_container")" -eq 2
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Type}}|{{.Name}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "volume|$lane_volume|true"
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/run/secrets/phase0-postgres-password"}}{{.Type}}|{{.Source}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "bind|$secret_file|false"
test "$(docker inspect -f '{{index .HostConfig.Tmpfs "/run/phase0"}}' "$lane_container")" = 'rw,noexec,nosuid,size=16m,mode=0700'
test -f "$secret_file"
test ! -L "$secret_file"
test "$(stat -c '%U|%G|%a' "$secret_file")" = 'root|root|600'
docker volume inspect -f 'name|{{.Name}}{{println}}driver|{{.Driver}}{{println}}scope|{{.Scope}}' \
  "$lane_volume" > "$recovery_dir/lane-volume.after-task5.tsv"
cmp -s "$recovery_dir/lane-volume.before.tsv" "$recovery_dir/lane-volume.after-task5.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select name,setting from pg_settings where name in
   ('log_statement','log_min_error_statement','logging_collector','log_destination','log_error_verbosity') order by name;" \
  > "$recovery_dir/postgres-logging.after-task5.tsv"
cmp -s "$recovery_dir/readiness-v17/postgres-logging.expected.tsv" "$recovery_dir/postgres-logging.after-task5.tsv"
source_names=(20260813110000_task_evaluation_checkpoints.sql 20260813155000_allow_tbt_task_evaluation.sql 20260813172000_task_plans_recipients_self_claim.sql 20260813184000_secure_task_rpc_execution.sql 20260813210000_password_reset_security.sql 20260813220000_task_evaluation_total_score.sql 20260813230000_admin_role_user_policy.sql 20260813233000_tbt_evaluation_guard.sql 20260813234500_creator_evaluation_guard.sql 20260814070000_job_titles.sql 20260814090000_task_priority_neutral_default.sql 20260814102000_bulk_task_plans.sql 20260814113000_localize_role_names.sql 20260814130000_staff_list_order.sql 20260814160000_employee_password_reset_admin.sql 20260814170000_employee_password_reset_hardening.sql)
review_exec SAFE_MANIFEST.py manifest --directory "$review_package" --manifest SOURCE-SHA256SUMS --separator one --member-root "$repo/supabase/migrations" --member-root-mode 755 --member-mode 644 --allow-extra "${source_names[@]}"
read -r old_run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r old_run_id quarantine_container quarantine_volume old_bootstrap old_bootstrap_db old_database < "$old_run_dir/names.tsv"
docker inspect -f 'container_id|{{.Id}}{{println}}state|{{.State.Status}}{{println}}image_id|{{.Image}}{{println}}network|{{.HostConfig.NetworkMode}}{{println}}log_driver|{{.HostConfig.LogConfig.Type}}{{println}}privileged|{{.HostConfig.Privileged}}{{println}}restart|{{.HostConfig.RestartPolicy.Name}}{{println}}auto_remove|{{.HostConfig.AutoRemove}}' \
  "$quarantine_container" > "$recovery_dir/quarantine-container.after-task5.tsv"
cmp -s "$recovery_dir/quarantine-container.before.tsv" "$recovery_dir/quarantine-container.after-task5.tsv"
docker volume inspect -f 'name|{{.Name}}{{println}}driver|{{.Driver}}{{println}}scope|{{.Scope}}' \
  "$quarantine_volume" > "$recovery_dir/quarantine-volume.after-task5.tsv"
cmp -s "$recovery_dir/quarantine-volume.before.tsv" "$recovery_dir/quarantine-volume.after-task5.tsv"
(cd / && safe_manifest_check "$recovery_dir/ROLE-SHA256SUMS" >/dev/null)
role_gate="$recovery_dir/verify-role-manifest"
bash "$role_gate" "$lane_container" "$recovery_dir" "$fresh_db" "$diagnostic_db" "$successor_db"
grep -Fx 'roles|PASS' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'attributes|exact' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'memberships|exact' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'forbidden_roles|zero' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'replay_owner|postgres-nonsuperuser' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
base=/opt/thoidai-reconciliation
: "${V17_REVIEW_PACKAGE:?exact externally supplied v17 review-package path required}"
: "${V17_REVIEW_MANIFEST_SHA256:?exact externally supplied SHA256SUMS digest required}"
review_package=$V17_REVIEW_PACKAGE
review_manifest_sha=$V17_REVIEW_MANIFEST_SHA256
approval=$base/phase0-v17-reentry-review.approved.tsv
current=$base/HANDOFF.recovery-v17.current
task5_current=$base/phase0-v5-execution.current
pin=$recovery_dir/TASK5-CURRENT.pointer
pointer_sha=$(printf '%s\n' "$recovery_dir" | sha256sum | awk '{print $1}')
install -m0600 "$old_run_dir/production-acl-normalization.before.tsv" "$recovery_dir/production-acl-normalization.before.tsv"
install -m0600 "$old_run_dir/production-acl-normalization.after.tsv" "$recovery_dir/production-acl-normalization.after.tsv"
install -m0600 "$old_run_dir/isolated-acl-normalization.status.tsv" "$recovery_dir/isolated-acl-normalization.status.tsv"
install -m0600 "$old_run_dir/isolated-acl-normalization.pre.tsv" "$recovery_dir/isolated-acl-normalization.pre.tsv"
install -m0600 "$old_run_dir/isolated-acl-normalization.post.tsv" "$recovery_dir/isolated-acl-normalization.post.tsv"
write_manifest "$recovery_dir/RESTORE-SHA256SUMS" restore.status.tsv
write_manifest "$recovery_dir/ACL-SHA256SUMS" isolated-acl-normalization.post.tsv isolated-acl-normalization.pre.tsv isolated-acl-normalization.status.tsv production-acl-normalization.after.tsv production-acl-normalization.before.tsv public-usage.post.tsv public-usage.pre.tsv
write_manifest "$recovery_dir/ROLE-EXPECTED-SHA256SUMS" replay-owner.expected.tsv role-forbidden.expected.tsv role-manifest.expected.tsv role-memberships.expected.tsv verify-role-manifest
write_manifest "$recovery_dir/ROLE-SHA256SUMS" ROLE-EXPECTED-SHA256SUMS ROLE-MANIFEST.COMPLETE replay-owner.expected.tsv role-forbidden.actual.tsv role-forbidden.expected.tsv role-manifest.actual.tsv role-manifest.expected.tsv role-memberships.actual.tsv role-memberships.expected.tsv verify-role-manifest
mapfile -t fidelity_members < <(find "$recovery_dir" -maxdepth 1 -type f \( -name '*-fidelity.*.tsv' -o -name FIDELITY.COMPLETE \) -printf '%f\n' | LC_ALL=C sort)
write_manifest "$recovery_dir/FIDELITY-SHA256SUMS" "${fidelity_members[@]}"
review_exec PUBLISH.py completion-prepare "$recovery_dir" "$pin" "$task5_current" "$base" "$pointer_sha"
test -f "$recovery_dir/TASK5-PUBLISH-ARGS.tsv" && test ! -L "$recovery_dir/TASK5-PUBLISH-ARGS.tsv"
test "$(stat -c '%U|%G|%a' "$recovery_dir/TASK5-PUBLISH-ARGS.tsv")" = 'root|root|600'
test -f "$recovery_dir/TASK5-PRECOMPLETE-SHA256SUMS" && test ! -L "$recovery_dir/TASK5-PRECOMPLETE-SHA256SUMS"
test "$(stat -c '%U|%G|%a' "$recovery_dir/TASK5-PRECOMPLETE-SHA256SUMS")" = 'root|root|600'
test -f "$current" && test ! -L "$current"
IFS= read -r execution_package < "$current"
review_exec TRUST-GATE.py \
  --trusted-review "$review_package" --trusted-manifest "$review_manifest_sha" \
  --approval "$approval" --execution "$execution_package" --phase current \
  --pointer "$current" --action both --recovery-stage pre-completion
review_exec PUBLISH.py completion "$recovery_dir" "$pin" "$task5_current" "$base" "$pointer_sha"
review_exec PUBLISH.py completion-verify "$recovery_dir" "$pin" "$task5_current" "$base" "$pointer_sha"
```

Expected: the externally anchored trust gate repeats the complete package/approval/commit/canonical/unrelated/actual-lock-inode gate and finishes with a fresh live trusted recovery verification immediately before completion. The role helper re-queries exact attributes, memberships, forbidden-role absence, and three non-superuser `postgres` owners. Fidelity, image/platform, network/ports, logging, resources, privilege/namespaces/caps/devices, mounts/tmpfs, secret metadata, volume identity, and both quarantine metadata files remain exact. Only then is `TASK5.COMPLETE` created and the new execution pointer published. The secret and every container log remain outside all hashes; all resources remain retained.

## Task 6: Seed the successor and replay the two new isolated lanes

> **Lane boundary:** `diagnostic_db` is the new identity-free clone. `successor_db` alone receives synthetic fixtures. The retained Tasks 1–4 database is not a lane and is never queried.

**Files:**
- Verify: Task-5 seal, package, source manifest, new container policy
- Create outside Git: aggregate fixture, sanitized SQLSTATE, rollback, replay, terminal, idempotency, and Task-6 evidence
- Modify only the two bounded databases in the new container; no production or retained-resource mutation

- [ ] **Step 1: Verify the Task-5 seal and seed the successor through fd 0 binding**

The source parser must observe exactly two approved syntax occurrences resolving to one unique value without printing it. The source stays on fd 0; safe psql commands use fd 3. The value is bound, never interpolated.

```bash
set -euo pipefail
set +x
umask 077
: "${V17_REVIEW_PACKAGE:?exact externally supplied v17 review-package path required}"
: "${V17_REVIEW_MANIFEST_SHA256:?exact externally supplied SHA256SUMS digest required}"
review_package=$V17_REVIEW_PACKAGE
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r execution_package < /opt/thoidai-reconciliation/HANDOFF.recovery-v17.current
read -r recovery_dir < "$execution_package/TASK5.pending"
(cd / && safe_manifest_check "$recovery_dir/TASK5-SHA256SUMS" >/dev/null)
grep -Fx 'status|complete' "$recovery_dir/TASK5.COMPLETE"
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
lane_volume=$(awk -F '|' '$1=="volume"{print $2}' "$recovery_dir/lane-names.tsv")
fresh_db=$(awk -F '|' '$1=="fresh_template"{print $2}' "$recovery_dir/lane-names.tsv")
diagnostic_db=$(awk -F '|' '$1=="diagnostic"{print $2}' "$recovery_dir/lane-names.tsv")
successor_db=$(awk -F '|' '$1=="successor"{print $2}' "$recovery_dir/lane-names.tsv")
secret_file="$recovery_dir/postgres-password.secret"
(cd / && safe_manifest_check "$recovery_dir/FIDELITY-SHA256SUMS" >/dev/null)
grep -Fx 'fidelity|PASS' "$recovery_dir/FIDELITY.COMPLETE"
test "$(docker image inspect -f '{{.Id}}|{{.Os}}|{{.Architecture}}' postgres@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d)" = 'sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d|linux|amd64'
test "$(docker inspect -f '{{.State.Running}}|{{.Image}}|{{.HostConfig.NetworkMode}}|{{.HostConfig.LogConfig.Type}}' "$lane_container")" = 'true|sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d|none|none'
port_bindings=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$lane_container")
[[ "$port_bindings" = '{}' || "$port_bindings" = null ]]
test -z "$(docker port "$lane_container")"
test "$(docker inspect -f '{{.HostConfig.NanoCpus}}|{{.HostConfig.Memory}}|{{.HostConfig.MemorySwap}}|{{.HostConfig.PidsLimit}}' "$lane_container")" = '1000000000|1073741824|1073741824|256'
test "$(docker inspect -f '{{.HostConfig.Privileged}}|{{.HostConfig.RestartPolicy.Name}}|{{.HostConfig.AutoRemove}}' "$lane_container")" = 'false|no|false'
test -z "$(docker inspect -f '{{.HostConfig.PidMode}}' "$lane_container")"
test "$(docker inspect -f '{{.HostConfig.IpcMode}}' "$lane_container")" = private
test "$(docker inspect -f '{{len .HostConfig.CapAdd}}|{{len .HostConfig.Devices}}' "$lane_container")" = '0|0'
test "$(docker inspect -f '{{len .Mounts}}' "$lane_container")" -eq 2
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Type}}|{{.Name}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "volume|$lane_volume|true"
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/run/secrets/phase0-postgres-password"}}{{.Type}}|{{.Source}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "bind|$secret_file|false"
test "$(docker inspect -f '{{index .HostConfig.Tmpfs "/run/phase0"}}' "$lane_container")" = 'rw,noexec,nosuid,size=16m,mode=0700'
test "$(stat -c '%U|%G|%a' "$secret_file")" = 'root|root|600'
docker volume inspect -f 'name|{{.Name}}{{println}}driver|{{.Driver}}{{println}}scope|{{.Scope}}' "$lane_volume" \
  > "$recovery_dir/lane-volume.before-task6.tsv"
cmp -s "$recovery_dir/lane-volume.after-task5.tsv" "$recovery_dir/lane-volume.before-task6.tsv"
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select name,setting from pg_settings where name in
   ('log_statement','log_min_error_statement','logging_collector','log_destination','log_error_verbosity') order by name;" \
  > "$recovery_dir/postgres-logging.before-task6.tsv"
cmp -s "$recovery_dir/readiness-v17/postgres-logging.expected.tsv" "$recovery_dir/postgres-logging.before-task6.tsv"
(cd / && safe_manifest_check "$recovery_dir/ROLE-SHA256SUMS" >/dev/null)
role_gate="$recovery_dir/verify-role-manifest"
bash "$role_gate" "$lane_container" "$recovery_dir" "$fresh_db" "$diagnostic_db" "$successor_db"
grep -Fx 'roles|PASS' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'attributes|exact' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'memberships|exact' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'forbidden_roles|zero' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
grep -Fx 'replay_owner|postgres-nonsuperuser' "$recovery_dir/ROLE-MANIFEST.COMPLETE"
cd "$repo"
source_names=(20260813110000_task_evaluation_checkpoints.sql 20260813155000_allow_tbt_task_evaluation.sql 20260813172000_task_plans_recipients_self_claim.sql 20260813184000_secure_task_rpc_execution.sql 20260813210000_password_reset_security.sql 20260813220000_task_evaluation_total_score.sql 20260813230000_admin_role_user_policy.sql 20260813233000_tbt_evaluation_guard.sql 20260813234500_creator_evaluation_guard.sql 20260814070000_job_titles.sql 20260814090000_task_priority_neutral_default.sql 20260814102000_bulk_task_plans.sql 20260814113000_localize_role_names.sql 20260814130000_staff_list_order.sql 20260814160000_employee_password_reset_admin.sql 20260814170000_employee_password_reset_hardening.sql)
review_exec SAFE_MANIFEST.py manifest --directory "$review_package" --manifest SOURCE-SHA256SUMS --separator one --member-root "$repo/supabase/migrations" --member-root-mode 755 --member-mode 644 --allow-extra "${source_names[@]}"
protected_source="$repo/supabase/migrations/20260813210000_password_reset_security.sql"
review_exec SAFE_MANIFEST.py file --path "$protected_source" --expected-sha a87f815d5494eb733f525917053f1668875aa9d0c03b38c326387a9312a58212 --mode 644
test "$(grep -Ec 'lower[[:space:]]*\([[:space:]]*username[[:space:]]*\)[[:space:]]*=' "$protected_source")" -eq 2
! LC_ALL=C grep -q $'\x1e\|\x1f' "$protected_source"
source_gate="$recovery_dir/verify-source-gate"
test ! -e "$source_gate"
cat > "$source_gate" <<'BASH'
#!/usr/bin/env bash
set -euo pipefail
source_file=$1
trusted_review=$2
trusted_manifest_sha=$3
repo=/opt/thoidai-work
review_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
protected_source="$repo/supabase/migrations/20260813210000_password_reset_security.sql"
review_name=$(basename -- "$trusted_review")
[[ "$trusted_manifest_sha" =~ ^[0-9a-f]{64}$ ]]
test "$(dirname -- "$trusted_review")" = "$review_root"
[[ "$review_name" =~ ^review-runbook-v17-r2-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]]
test "$trusted_review" = "$review_root/$review_name"
test -f "$trusted_review/SAFE_MANIFEST.py" && test ! -L "$trusted_review/SAFE_MANIFEST.py"
test "$(stat -c '%U|%G|%a' "$trusted_review/SAFE_MANIFEST.py")" = 'root|root|600'
review_exec SAFE_MANIFEST.py manifest --directory "$trusted_review" --anchor "$trusted_manifest_sha" --separator one \
  runbook.candidate.md design.candidate.md REVIEW-NOTES.md VALIDATION.tsv FAILURE-STATE.tsv \
  RECOVERY-VERIFY.sh VERIFY.sh PUBLISH.py TRUST-GATE.py TRUST-POLICY.tsv SIMULATE.py SAFE_MANIFEST.py SOURCE-SHA256SUMS
source_names=(20260813110000_task_evaluation_checkpoints.sql 20260813155000_allow_tbt_task_evaluation.sql 20260813172000_task_plans_recipients_self_claim.sql 20260813184000_secure_task_rpc_execution.sql 20260813210000_password_reset_security.sql 20260813220000_task_evaluation_total_score.sql 20260813230000_admin_role_user_policy.sql 20260813233000_tbt_evaluation_guard.sql 20260813234500_creator_evaluation_guard.sql 20260814070000_job_titles.sql 20260814090000_task_priority_neutral_default.sql 20260814102000_bulk_task_plans.sql 20260814113000_localize_role_names.sql 20260814130000_staff_list_order.sql 20260814160000_employee_password_reset_admin.sql 20260814170000_employee_password_reset_hardening.sql)
review_exec SAFE_MANIFEST.py manifest --directory "$trusted_review" --manifest SOURCE-SHA256SUMS --separator one \
  --member-root "$repo/supabase/migrations" --member-root-mode 755 --member-mode 644 --allow-extra "${source_names[@]}"
source_name=$(basename -- "$source_file")
test "$source_file" = "$repo/supabase/migrations/$source_name"
case " ${source_names[*]} " in *" $source_name "*) ;; *) exit 41 ;; esac
! grep -Eqi '(^|;)[[:space:]]*(set[[:space:]]+role|set[[:space:]]+session[[:space:]]+authorization|\\connect)([[:space:];]|$)' "$source_file"
! grep -Eqi 'supabase_admin' "$source_file"
python3 - "$protected_source" "$source_file" <<'PY'
from pathlib import Path
import re
import sys
protected_path = Path(sys.argv[1]).resolve()
stream_path = Path(sys.argv[2]).resolve()
source = protected_path.read_text(encoding="utf-8", errors="strict")
stream = stream_path.read_text(encoding="utf-8", errors="strict")
matches = re.findall(r"lower\s*\(\s*username\s*\)\s*=\s*'([^']{1,128})'", source, flags=re.I)
if len(matches) != 2 or len(set(matches)) != 1:
    raise SystemExit(41)
candidate = matches[0]
if len(candidate) > 128 or len(candidate.encode("utf-8")) != len(candidate) or not re.fullmatch(r"[a-z0-9._@+-]+", candidate):
    raise SystemExit(41)
if source.count(candidate) != 3:
    raise SystemExit(41)
expected_stream_count = 3 if stream_path == protected_path else 0
if stream.count(candidate) != expected_stream_count:
    raise SystemExit(41)
PY
BASH
chmod 0600 "$source_gate"
gate_sha=$(review_exec SAFE_MANIFEST.py file --path "$source_gate" --mode 600 --print-digest)
printf '%s verify-source-gate\n' "$gate_sha" > "$recovery_dir/VERIFY-SOURCE-GATE-SHA256SUMS"
chmod 0600 "$recovery_dir/VERIFY-SOURCE-GATE-SHA256SUMS"
review_exec SAFE_MANIFEST.py manifest --directory "$recovery_dir" --manifest VERIFY-SOURCE-GATE-SHA256SUMS \
  --directory-mode 700 --allow-extra verify-source-gate
read -r -d '' client_script <<'PSQL' || true
\set ECHO none
\set QUIET on
\set VERBOSITY sqlstate
\o /dev/null
begin;
set local client_min_messages=error;
create temp table selector_source(ordinal bigint generated always as identity,line text not null) on commit drop;
\copy selector_source(line) from pstdin with (format csv, delimiter E'\x1f', quote E'\x1e', escape E'\x1e')
create temp table parsed_selector on commit drop as
with hits as (
  select m[1] selector from selector_source s
  cross join lateral regexp_matches(s.line,$rx$lower[[:space:]]*\([[:space:]]*username[[:space:]]*\)[[:space:]]*=[[:space:]]*'([^']{1,128})'$rx$,'g') m
)
select selector from hits;
do $guard$
declare occurrence_count integer; unique_count integer; broad_shape_count integer; candidate text;
begin
  select count(*),count(distinct selector),min(selector) into occurrence_count,unique_count,candidate from parsed_selector;
  select count(*) into broad_shape_count from selector_source where line ~ $rx$lower[[:space:]]*\([[:space:]]*username[[:space:]]*\)$rx$;
  if occurrence_count<>2 or unique_count<>1 or broad_shape_count<>2 then raise exception using errcode='P0001',message='rejected'; end if;
  if candidate is null or length(candidate)>128 or octet_length(candidate)<>length(candidate)
     or candidate ~ '[[:cntrl:]]' or candidate !~ '^[a-z0-9._@+-]+$' collate "C" then
    raise exception using errcode='P0001',message='rejected';
  end if;
  if (select count(*) from public.roles)<>0 or (select count(*) from public.role_permissions)<>0
     or (select count(*) from public.departments)<>0 or (select count(*) from public.staff_users)<>0
     or (select count(*) from supabase_migrations.schema_migrations)<>0 then
    raise exception using errcode='P0001',message='rejected';
  end if;
end
$guard$;
insert into public.roles(id,code,name,level) values
(gen_random_uuid(),'tong_bien_tap','Phase 0 synthetic TBT',4),
(gen_random_uuid(),'tbt_read_only','Phase 0 synthetic read only',0),
(gen_random_uuid(),'pho_tong_bien_tap','Phase 0 synthetic deputy',3),
(gen_random_uuid(),'phu_trach_phong_tri_su','Phase 0 synthetic manager A',3),
(gen_random_uuid(),'phu_trach_phong_phong_vien','Phase 0 synthetic manager B',3),
(gen_random_uuid(),'phu_trach_phong_bien_tap','Phase 0 synthetic manager C',3);
insert into public.role_permissions(role_id,can_manage_users,can_manage_permissions,can_create_task,can_edit_all_tasks,can_comment)
select id,false,false,true,true,true from public.roles;
insert into public.departments(id,code,name,active)
values(gen_random_uuid(),'phase0_fixture_department','Phase 0 synthetic department',true);
select min(selector) as protected_selector from parsed_selector
\gset
insert into public.staff_users(id,full_name,username,role_id,department_id)
select gen_random_uuid(),'Phase 0 synthetic protected shell',$1,r.id,d.id
from public.roles r cross join public.departments d
where r.code='tbt_read_only' and d.code='phase0_fixture_department'
\bind :protected_selector
\g
select 1 / case when (select count(*) from public.staff_users where lower(username)=lower($1))=1 then 1 else 0 end
\bind :protected_selector
\g
\unset protected_selector
truncate parsed_selector,selector_source;
commit;
PSQL
review_exec SAFE_MANIFEST.py manifest --directory "$recovery_dir" --manifest VERIFY-SOURCE-GATE-SHA256SUMS --directory-mode 700 --allow-extra verify-source-gate
bash "$source_gate" "$protected_source" "$review_package" "$V17_REVIEW_MANIFEST_SHA256"
set +e
docker exec -i "$lane_container" bash -c \
  'set +x; exec 3<<<"$1"; exec psql -X -U postgres -d "$2" -v ON_ERROR_STOP=1 -f /dev/fd/3 >/dev/null 2>/dev/null' \
  phase0-selector-client "$client_script" "$successor_db" < "$protected_source"
fixture_status=$?
set -e
unset client_script
printf 'status|%s\noccurrence_count|2\nunique_value_count|1\nsource_fd|0\nbinding|true\nselector_emitted|false\nraw_error_emitted|false\n' \
  "$fixture_status" > "$recovery_dir/selector-fixture.status.tsv"
test "$fixture_status" -eq 0
docker exec "$lane_container" psql -X -U postgres -d "$successor_db" -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select (select count(*) from public.roles),(select count(*) from public.role_permissions),
   (select count(*) from public.departments),(select count(*) from public.staff_users),
   (select count(*) from public.staff_users where email is not null or phone is not null or password is not null or job_title_id is not null),
   (select count(*) from public.tasks),(select count(*) from public.audit_logs),
   (select count(*) from supabase_migrations.schema_migrations);" > "$recovery_dir/successor-fixture.aggregate.tsv"
grep -Fx '6|6|1|1|0|0|0|0' "$recovery_dir/successor-fixture.aggregate.tsv"
docker exec "$lane_container" psql -X -U postgres -d "$diagnostic_db" -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select (select count(*) from public.roles),(select count(*) from public.role_permissions),
   (select count(*) from public.departments),(select count(*) from public.staff_users),
   (select count(*) from supabase_migrations.schema_migrations);" > "$recovery_dir/diagnostic.aggregate.tsv"
grep -Fx '0|0|0|0|0' "$recovery_dir/diagnostic.aggregate.tsv"
chmod 0600 "$recovery_dir"/*
```

Expected: the sealed role manifest re-queries exact role attributes, memberships, forbidden-role absence, and non-superuser `postgres` ownership immediately before replay. Parser shape is `2/1`, successor aggregate is `6/6/1/1`, diagnostic remains empty, and no selector or raw error enters an argument value containing the selector, environment, file, terminal, evidence, hash input, or retained log.

- [ ] **Step 2: Require exact `P0001` and byte-identical rollback in the diagnostic clone**

The sanitizer runs inside bounded tmpfs. It accepts one exact SQLSTATE-form line and emits only `sqlstate|P0001`; it never stores or forwards raw stderr.

```bash
set -euo pipefail
set +x
umask 077
: "${V17_REVIEW_PACKAGE:?exact externally supplied v17 review-package path required}"
: "${V17_REVIEW_MANIFEST_SHA256:?exact externally supplied SHA256SUMS digest required}"
review_package=$V17_REVIEW_PACKAGE
repo=/opt/thoidai-work
read -r execution_package < /opt/thoidai-reconciliation/HANDOFF.recovery-v17.current
read -r recovery_dir < "$execution_package/TASK5.pending"
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
diagnostic_db=$(awk -F '|' '$1=="diagnostic"{print $2}' "$recovery_dir/lane-names.tsv")
source_file="$repo/supabase/migrations/20260814130000_staff_list_order.sql"
source_gate="$recovery_dir/verify-source-gate"
fingerprint_sql="select (select count(*) from public.staff_users),(select count(*) from public.audit_logs),(select count(*) from public.staff_users where list_order>0),(select count(*) from pg_constraint where conrelid='public.staff_users'::regclass and conname='staff_users_list_order_nonnegative');"
docker exec "$lane_container" psql -X -U postgres -d "$diagnostic_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "$fingerprint_sql" \
  > "$recovery_dir/diagnostic-negative.before.tsv"
review_exec SAFE_MANIFEST.py manifest --directory "$recovery_dir" --manifest VERIFY-SOURCE-GATE-SHA256SUMS --directory-mode 700 --allow-extra verify-source-gate
bash "$source_gate" "$source_file" "$review_package" "$V17_REVIEW_MANIFEST_SHA256"
set +e
docker exec -i "$lane_container" bash -ceu '
  set +x
  db=$1
  fifo=/run/phase0/diagnostic-error.fifo
  state=/run/phase0/diagnostic-state.tsv
  rm -f "$fifo" "$state"
  mkfifo -m 0600 "$fifo"
  awk '\''BEGIN{good=0;bad=0} /^ERROR:[[:space:]]+P0001[[:space:]]*$/{good++;next} {bad++} END{if(good==1&&bad==0){print "sqlstate|P0001";exit 0} exit 41}'\'' < "$fifo" > "$state" &
  sanitizer=$!
  set +e
  PGOPTIONS="-c client_min_messages=error" psql -X -U postgres -d "$db" --single-transaction -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate >/dev/null 2> "$fifo"
  client=$?
  wait "$sanitizer"
  sanitized=$?
  set -e
  rm -f "$fifo"
  test "$client" -eq 3
  test "$sanitized" -eq 0
  grep -Fx "sqlstate|P0001" "$state" >/dev/null
  printf "client_status|%s\nsqlstate|P0001\n" "$client"
  rm -f "$state"
' phase0-diagnostic-negative "$diagnostic_db" < "$source_file" > "$recovery_dir/diagnostic-negative.status.tsv"
gate_status=$?
set -e
test "$gate_status" -eq 0
grep -Fx 'client_status|3' "$recovery_dir/diagnostic-negative.status.tsv"
grep -Fx 'sqlstate|P0001' "$recovery_dir/diagnostic-negative.status.tsv"
docker exec "$lane_container" psql -X -U postgres -d "$diagnostic_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "$fingerprint_sql" \
  > "$recovery_dir/diagnostic-negative.after.tsv"
cmp -s "$recovery_dir/diagnostic-negative.before.tsv" "$recovery_dir/diagnostic-negative.after.tsv"
printf 'rollback|byte-identical\n' > "$recovery_dir/diagnostic-negative.rollback.tsv"
sha256sum "$recovery_dir/diagnostic-negative.status.tsv" "$recovery_dir/diagnostic-negative.rollback.tsv" \
  > "$recovery_dir/diagnostic-negative.safe.sha256"
chmod 0600 "$recovery_dir"/diagnostic-negative.*
```

Expected: psql status is exactly `3`, SQLSTATE is exactly `P0001`, and rollback fingerprint is byte-identical. Any other stderr line/state/status stops before successor replay.

- [ ] **Step 3: Replay the locked chain in the successor with sanitized channels**

For the fifteen expected-success files the sanitizer requires empty stderr and emits only generic status. For `20260814130000`, use the same exact-`P0001` gate as Step 2 and require its own byte-identical successor fingerprint.

```bash
set -euo pipefail
set +x
umask 077
: "${V17_REVIEW_PACKAGE:?exact externally supplied v17 review-package path required}"
: "${V17_REVIEW_MANIFEST_SHA256:?exact externally supplied SHA256SUMS digest required}"
review_package=$V17_REVIEW_PACKAGE
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r execution_package < /opt/thoidai-reconciliation/HANDOFF.recovery-v17.current
read -r recovery_dir < "$execution_package/TASK5.pending"
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
successor_db=$(awk -F '|' '$1=="successor"{print $2}' "$recovery_dir/lane-names.tsv")
source_gate="$recovery_dir/verify-source-gate"
cd "$repo"
source_names=(20260813110000_task_evaluation_checkpoints.sql 20260813155000_allow_tbt_task_evaluation.sql 20260813172000_task_plans_recipients_self_claim.sql 20260813184000_secure_task_rpc_execution.sql 20260813210000_password_reset_security.sql 20260813220000_task_evaluation_total_score.sql 20260813230000_admin_role_user_policy.sql 20260813233000_tbt_evaluation_guard.sql 20260813234500_creator_evaluation_guard.sql 20260814070000_job_titles.sql 20260814090000_task_priority_neutral_default.sql 20260814102000_bulk_task_plans.sql 20260814113000_localize_role_names.sql 20260814130000_staff_list_order.sql 20260814160000_employee_password_reset_admin.sql 20260814170000_employee_password_reset_hardening.sql)
review_exec SAFE_MANIFEST.py manifest --directory "$review_package" --manifest SOURCE-SHA256SUMS --separator one --member-root "$repo/supabase/migrations" --member-root-mode 755 --member-mode 644 --allow-extra "${source_names[@]}"
chain=(
  20260813110000_task_evaluation_checkpoints.sql
  20260813155000_allow_tbt_task_evaluation.sql
  20260813172000_task_plans_recipients_self_claim.sql
  20260813184000_secure_task_rpc_execution.sql
  20260813210000_password_reset_security.sql
  20260813220000_task_evaluation_total_score.sql
  20260813230000_admin_role_user_policy.sql
  20260813233000_tbt_evaluation_guard.sql
  20260813234500_creator_evaluation_guard.sql
  20260814070000_job_titles.sql
  20260814090000_task_priority_neutral_default.sql
  20260814102000_bulk_task_plans.sql
  20260814113000_localize_role_names.sql
  20260814130000_staff_list_order.sql
  20260814160000_employee_password_reset_admin.sql
  20260814170000_employee_password_reset_hardening.sql
)
test "${#chain[@]}" -eq 16
fingerprint_sql="select (select count(*) from public.staff_users),(select count(*) from public.audit_logs),(select count(*) from public.staff_users where list_order>0),(select count(*) from pg_constraint where conrelid='public.staff_users'::regclass and conname='staff_users_list_order_nonnegative');"
: > "$recovery_dir/successor-replay.status.tsv"
for migration in "${chain[@]}"; do
  version=${migration%%_*}
  source_file="$repo/supabase/migrations/$migration"
  if test "$version" = 20260814130000; then
    docker exec "$lane_container" psql -X -U postgres -d "$successor_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "$fingerprint_sql" \
      > "$recovery_dir/successor-negative.before.tsv"
    review_exec SAFE_MANIFEST.py manifest --directory "$recovery_dir" --manifest VERIFY-SOURCE-GATE-SHA256SUMS --directory-mode 700 --allow-extra verify-source-gate
    bash "$source_gate" "$source_file" "$review_package" "$V17_REVIEW_MANIFEST_SHA256"
    set +e
    docker exec -i "$lane_container" bash -ceu '
      set +x
      db=$1
      fifo=/run/phase0/successor-error.fifo
      state=/run/phase0/successor-state.tsv
      rm -f "$fifo" "$state"
      mkfifo -m 0600 "$fifo"
      awk '\''BEGIN{good=0;bad=0} /^ERROR:[[:space:]]+P0001[[:space:]]*$/{good++;next} {bad++} END{if(good==1&&bad==0){print "sqlstate|P0001";exit 0} exit 41}'\'' < "$fifo" > "$state" &
      sanitizer=$!
      set +e
      PGOPTIONS="-c client_min_messages=error" psql -X -U postgres -d "$db" --single-transaction -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate >/dev/null 2> "$fifo"
      client=$?
      wait "$sanitizer"
      sanitized=$?
      set -e
      rm -f "$fifo"
      test "$client" -eq 3
      test "$sanitized" -eq 0
      grep -Fx "sqlstate|P0001" "$state" >/dev/null
      printf "client_status|%s\nsqlstate|P0001\n" "$client"
      rm -f "$state"
    ' phase0-successor-negative "$successor_db" < "$source_file" > "$recovery_dir/successor-negative.status.tsv"
    negative_gate=$?
    set -e
    test "$negative_gate" -eq 0
    grep -Fx 'client_status|3' "$recovery_dir/successor-negative.status.tsv"
    grep -Fx 'sqlstate|P0001' "$recovery_dir/successor-negative.status.tsv"
    docker exec "$lane_container" psql -X -U postgres -d "$successor_db" -qAtF '|' -v ON_ERROR_STOP=1 -c "$fingerprint_sql" \
      > "$recovery_dir/successor-negative.after.tsv"
    cmp -s "$recovery_dir/successor-negative.before.tsv" "$recovery_dir/successor-negative.after.tsv"
    printf '%s|3|P0001|rollback-byte-identical\n' "$version" >> "$recovery_dir/successor-replay.status.tsv"
  else
    review_exec SAFE_MANIFEST.py manifest --directory "$recovery_dir" --manifest VERIFY-SOURCE-GATE-SHA256SUMS --directory-mode 700 --allow-extra verify-source-gate
    bash "$source_gate" "$source_file" "$review_package" "$V17_REVIEW_MANIFEST_SHA256"
    set +e
    docker exec -i "$lane_container" bash -ceu '
      set +x
      db=$1
      fifo=/run/phase0/success-error.fifo
      rm -f "$fifo"
      mkfifo -m 0600 "$fifo"
      awk '\''NF{bad=1} END{exit bad?41:0}'\'' < "$fifo" &
      sanitizer=$!
      set +e
      PGOPTIONS="-c client_min_messages=error" psql -X -U postgres -d "$db" --single-transaction -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate >/dev/null 2> "$fifo"
      client=$?
      wait "$sanitizer"
      sanitized=$?
      set -e
      rm -f "$fifo"
      test "$client" -eq 0
      test "$sanitized" -eq 0
      printf "client_status|0\n"
    ' phase0-success "$successor_db" < "$source_file" > "$recovery_dir/success-$version.status.tsv"
    success_gate=$?
    set -e
    test "$success_gate" -eq 0
    grep -Fx 'client_status|0' "$recovery_dir/success-$version.status.tsv"
    printf '%s|0|none|committed\n' "$version" >> "$recovery_dir/successor-replay.status.tsv"
  fi
done
test "$(wc -l < "$recovery_dir/successor-replay.status.tsv")" -eq 16
test "$(awk -F '|' '$2==0{n++} END{print n+0}' "$recovery_dir/successor-replay.status.tsv")" -eq 15
test "$(awk -F '|' '$2!=0{print $1"|"$2"|"$3}' "$recovery_dir/successor-replay.status.tsv")" = '20260814130000|3|P0001'
sha256sum "$recovery_dir/successor-negative.status.tsv" "$recovery_dir/successor-replay.status.tsv" \
  > "$recovery_dir/successor-replay.safe.sha256"
chmod 0600 "$recovery_dir"/*
```

Expected: exactly fifteen success rows and one exact `20260814130000|3|P0001` rollback row. No raw replay output is emitted, persisted, or hashed.

- [ ] **Step 4: Verify terminal state, rerun the fifteen safe files, and seal Task 6**

```bash
set -euo pipefail
set +x
umask 077
: "${V17_REVIEW_PACKAGE:?exact externally supplied v17 review-package path required}"
: "${V17_REVIEW_MANIFEST_SHA256:?exact externally supplied SHA256SUMS digest required}"
review_package=$V17_REVIEW_PACKAGE
repo=/opt/thoidai-work
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r execution_package < /opt/thoidai-reconciliation/HANDOFF.recovery-v17.current
read -r recovery_dir < "$execution_package/TASK5.pending"
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
successor_db=$(awk -F '|' '$1=="successor"{print $2}' "$recovery_dir/lane-names.tsv")
source_gate="$recovery_dir/verify-source-gate"
safe_chain=(
  20260813110000_task_evaluation_checkpoints.sql 20260813155000_allow_tbt_task_evaluation.sql
  20260813172000_task_plans_recipients_self_claim.sql 20260813184000_secure_task_rpc_execution.sql
  20260813210000_password_reset_security.sql 20260813220000_task_evaluation_total_score.sql
  20260813230000_admin_role_user_policy.sql 20260813233000_tbt_evaluation_guard.sql
  20260813234500_creator_evaluation_guard.sql 20260814070000_job_titles.sql
  20260814090000_task_priority_neutral_default.sql 20260814102000_bulk_task_plans.sql
  20260814113000_localize_role_names.sql 20260814160000_employee_password_reset_admin.sql
  20260814170000_employee_password_reset_hardening.sql
)
test "${#safe_chain[@]}" -eq 15
: > "$recovery_dir/successor-idempotency.status.tsv"
for migration in "${safe_chain[@]}"; do
  version=${migration%%_*}
  source_file="$repo/supabase/migrations/$migration"
  review_exec SAFE_MANIFEST.py manifest --directory "$recovery_dir" --manifest VERIFY-SOURCE-GATE-SHA256SUMS --directory-mode 700 --allow-extra verify-source-gate
  bash "$source_gate" "$source_file" "$review_package" "$V17_REVIEW_MANIFEST_SHA256"
  set +e
  docker exec -i "$lane_container" bash -ceu '
    set +x
    db=$1
    fifo=/run/phase0/idempotency-error.fifo
    rm -f "$fifo"
    mkfifo -m 0600 "$fifo"
    awk '\''NF{bad=1} END{exit bad?41:0}'\'' < "$fifo" &
    sanitizer=$!
    set +e
    PGOPTIONS="-c client_min_messages=error" psql -X -U postgres -d "$db" --single-transaction -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate >/dev/null 2> "$fifo"
    client=$?
    wait "$sanitizer"
    sanitized=$?
    set -e
    rm -f "$fifo"
    test "$client" -eq 0
    test "$sanitized" -eq 0
    printf "client_status|0\n"
  ' phase0-idempotency "$successor_db" < "$source_file" > "$recovery_dir/idempotency-$version.status.tsv"
  idempotency_gate=$?
  set -e
  test "$idempotency_gate" -eq 0
  printf '%s|0\n' "$version" >> "$recovery_dir/successor-idempotency.status.tsv"
done
test "$(wc -l < "$recovery_dir/successor-idempotency.status.tsv")" -eq 15
docker exec "$lane_container" psql -X -U postgres -d "$successor_db" -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select (select count(*) from public.staff_users),(select count(*) from public.staff_users where password_hash is not null),
   (select count(*) from public.password_reset_tokens),(select count(*) from public.password_reset_attempts),
   (select count(*) from public.tasks),(select count(*) from public.audit_logs),
   (select count(*) from supabase_migrations.schema_migrations);" > "$recovery_dir/successor-terminal.aggregate.tsv"
grep -Fx '1|1|0|0|0|0|0' "$recovery_dir/successor-terminal.aggregate.tsv"
docker exec "$lane_container" psql -X -U postgres -d "$successor_db" -qAtF '|' -v ON_ERROR_STOP=1 -c \
  "select r.code,rp.can_manage_users,rp.can_manage_permissions,rp.can_create_task,rp.can_edit_all_tasks,rp.can_comment
   from public.roles r join public.role_permissions rp on rp.role_id=r.id
   where r.code in ('tong_bien_tap','tbt_read_only') order by r.code;" > "$recovery_dir/successor-terminal.tbt.tsv"
test "$(wc -l < "$recovery_dir/successor-terminal.tbt.tsv")" -eq 2
printf 'phase|task6\nstatus|complete\nnegative_sqlstate|P0001\nnegative_paths|2\nraw_error_evidence|false\nhistory_write|false\n' \
  > "$recovery_dir/TASK6.COMPLETE"
mapfile -t task6_members < <(find "$recovery_dir" -maxdepth 1 -type f \
  \( -name '*negative*' -o -name '*replay*' -o -name '*idempotency*' -o -name '*terminal*' -o -name 'selector-fixture.status.tsv' -o -name 'verify-source-gate*' -o -name 'TASK6.COMPLETE' \) \
  -printf '%f\n' | LC_ALL=C sort)
write_manifest "$recovery_dir/TASK6-SHA256SUMS" "${task6_members[@]}"
(cd / && safe_manifest_check "$recovery_dir/TASK6-SHA256SUMS" >/dev/null)
chmod 0600 "$recovery_dir"/*
```

Expected: fifteen safe files are idempotent, terminal gates match, both negative paths are recorded only as status/SQLSTATE/rollback, and the running new lane remains retained.

## Task 7: Classify exactly four taxonomy classes and seal the mandatory STOP

**Files:**
- Verify: Task-5/6 manifests, production and lane-separated evidence
- Create outside Git: classification and STOP evidence
- No database, container, service, source, or history mutation

- [ ] **Step 1: Write the exact approved classification matrix**

```bash
set -euo pipefail
umask 077
read -r execution_package < /opt/thoidai-reconciliation/HANDOFF.recovery-v17.current
read -r recovery_dir < "$execution_package/TASK5.pending"
(cd / && safe_manifest_check "$recovery_dir/TASK5-SHA256SUMS" >/dev/null)
(cd / && safe_manifest_check "$recovery_dir/TASK6-SHA256SUMS" >/dev/null)
cat > "$recovery_dir/classification.tsv" <<'EOF'
20260813172000|exact-applied|blocked-all-or-nothing
20260813210000|semantically-applied-but-source-differs|STOP
20260813220000|exact-applied|blocked-all-or-nothing
20260813230000|semantically-applied-but-source-differs|STOP
20260813233000|semantically-applied-but-source-differs|STOP
20260813234500|exact-applied|blocked-all-or-nothing
20260814070000|exact-applied|blocked-all-or-nothing
20260814102000|exact-applied|blocked-all-or-nothing
20260814130000|semantically-applied-but-source-differs|STOP
20260814160000|exact-applied|blocked-all-or-nothing
20260814170000|exact-applied|blocked-all-or-nothing
EOF
test "$(wc -l < "$recovery_dir/classification.tsv")" -eq 11
test "$(awk -F '|' '$2=="exact-applied"{n++} END{print n+0}' "$recovery_dir/classification.tsv")" -eq 7
test "$(awk -F '|' '$2=="semantically-applied-but-source-differs"{n++} END{print n+0}' "$recovery_dir/classification.tsv")" -eq 4
test "$(awk -F '|' '$2=="partially-applied"{n++} END{print n+0}' "$recovery_dir/classification.tsv")" -eq 0
test "$(awk -F '|' '$2=="not-applied"{n++} END{print n+0}' "$recovery_dir/classification.tsv")" -eq 0
for version in 20260813210000 20260813230000 20260813233000 20260814130000; do
  awk -F '|' -v version="$version" '$1==version && $2=="semantically-applied-but-source-differs" && $3=="STOP"{ok=1} END{exit !ok}' \
    "$recovery_dir/classification.tsv"
done
```

Expected: only the four approved class strings appear; seven rows are exact and four mandatory semantic-difference rows are STOP. `20260814130000` is not exact.

- [ ] **Step 2: Seal lane separation and all-or-nothing STOP**

```bash
set -euo pipefail
umask 077
read -r execution_package < /opt/thoidai-reconciliation/HANDOFF.recovery-v17.current
read -r recovery_dir < "$execution_package/TASK5.pending"
grep -Fx 'sqlstate|P0001' "$recovery_dir/diagnostic-negative.status.tsv"
grep -Fx 'sqlstate|P0001' "$recovery_dir/successor-negative.status.tsv"
cmp -s "$recovery_dir/diagnostic-negative.before.tsv" "$recovery_dir/diagnostic-negative.after.tsv"
cmp -s "$recovery_dir/successor-negative.before.tsv" "$recovery_dir/successor-negative.after.tsv"
printf 'gate|STOP\nnon_exact_count|4\nproduction_replay|false\nhistory_write|false\ntask8|skipped_unreachable\n' \
  > "$recovery_dir/HISTORY-GATE.status"
grep -Fx 'gate|STOP' "$recovery_dir/HISTORY-GATE.status"
grep -Fx 'non_exact_count|4' "$recovery_dir/HISTORY-GATE.status"
write_manifest "$recovery_dir/TASK7-SHA256SUMS" \
  classification.tsv HISTORY-GATE.status
printf 'phase|task7\nstatus|complete\ngate|STOP\n' > "$recovery_dir/TASK7.COMPLETE"
chmod 0600 "$recovery_dir"/*
```

Expected: diagnostic and successor evidence stay separate. Synthetic replayability does not upgrade historical application, and the gate is irrevocably STOP for this run.

## Task 8: Record the unreachable history boundary with zero write SQL

**Files:**
- Verify: Task-7 STOP
- Create outside Git: one skip record
- No SQL implementation and no database session in this task

- [ ] **Step 1: Record the skip and stop**

```bash
set -euo pipefail
umask 077
read -r execution_package < /opt/thoidai-reconciliation/HANDOFF.recovery-v17.current
read -r recovery_dir < "$execution_package/TASK5.pending"
(cd / && safe_manifest_check "$recovery_dir/TASK7-SHA256SUMS" >/dev/null)
grep -Fx 'gate|STOP' "$recovery_dir/HISTORY-GATE.status"
printf 'phase|task8\nstatus|skipped_unreachable\nreason|four_non_exact_rows\nhistory_write|false\nproduction_replay|false\nwrite_sql_count|0\n' \
  > "$recovery_dir/TASK8.SKIPPED"
grep -Fx 'write_sql_count|0' "$recovery_dir/TASK8.SKIPPED"
chmod 0600 "$recovery_dir/TASK8.SKIPPED"
```

Expected: Task 8 creates only a root-only skip record and immediately stops. There is no history-write SQL in this task.

## Task 9: Verify production, application, quarantine, and new-lane preservation

**Files:**
- Verify read-only: Git, production, services, application build/process/topology, quarantine metadata, new-lane metadata and databases
- Create outside Git: safe post-run comparisons and final manifest
- No mutation or cleanup

- [ ] **Step 1: Reverify production, Git, services, provider/routing surfaces, and active build**

```bash
set -euo pipefail
umask 077
: "${V17_REVIEW_PACKAGE:?exact externally supplied v17 review-package path required}"
: "${V17_REVIEW_MANIFEST_SHA256:?exact externally supplied SHA256SUMS digest required}"
repo=/opt/thoidai-work
base=/opt/thoidai-reconciliation
review_root=$base/phase0-20260814T135943Z
review_package=$V17_REVIEW_PACKAGE
review_manifest_sha=$V17_REVIEW_MANIFEST_SHA256
review_exec() {
  python3 - "$review_package" "$review_manifest_sha" "$@" <<'PY'
import hashlib,os,re,stat,sys,types
MEMBERS=(
 "runbook.candidate.md","design.candidate.md","REVIEW-NOTES.md","VALIDATION.tsv",
 "FAILURE-STATE.tsv","RECOVERY-VERIFY.sh","VERIFY.sh","PUBLISH.py",
 "TRUST-GATE.py","TRUST-POLICY.tsv","SIMULATE.py","SAFE_MANIFEST.py","SOURCE-SHA256SUMS")
review,anchor,target,*target_args=sys.argv[1:]
sig=lambda s:(s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_uid,s.st_gid,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
if not re.fullmatch(r"[0-9a-f]{64}",anchor): raise SystemExit(41)
if not os.path.isabs(review) or os.path.normpath(review)!=review or os.path.realpath(review)!=review: raise SystemExit(41)
if target not in ("SAFE_MANIFEST.py","TRUST-GATE.py","PUBLISH.py"): raise SystemExit(41)
try: dfd=os.open(review,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
except OSError: raise SystemExit(41)
try:
 dst=os.fstat(dfd)
 if not stat.S_ISDIR(dst.st_mode) or dst.st_uid!=0 or dst.st_gid!=0 or stat.S_IMODE(dst.st_mode)!=0o700: raise SystemExit(41)
 def stable(name):
  if name not in (*MEMBERS,"SHA256SUMS"): raise SystemExit(41)
  try: fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=dfd)
  except OSError: raise SystemExit(41)
  try:
   before=os.fstat(fd);parts=[]
   if not stat.S_ISREG(before.st_mode) or before.st_uid!=0 or before.st_gid!=0 or stat.S_IMODE(before.st_mode)!=0o600: raise SystemExit(41)
   while True:
    chunk=os.read(fd,1<<20)
    if not chunk: break
    parts.append(chunk)
   after=os.fstat(fd)
  finally: os.close(fd)
  data=b"".join(parts)
  try: named=os.stat(name,dir_fd=dfd,follow_symlinks=False)
  except OSError: raise SystemExit(41)
  if sig(before)!=sig(after) or sig(named)!=sig(before): raise SystemExit(41)
  if b"\r" in data or b"\0" in data or not data or not data.endswith(b"\n"): raise SystemExit(41)
  return data
 manifest=stable("SHA256SUMS")
 if hashlib.sha256(manifest).hexdigest()!=anchor: raise SystemExit(41)
 try: lines=manifest.decode("ascii").splitlines()
 except UnicodeDecodeError: raise SystemExit(41)
 rows=[]
 for raw in lines:
  match=re.fullmatch(r"([0-9a-f]{64}) ([A-Za-z0-9][A-Za-z0-9._-]*)",raw)
  if not match: raise SystemExit(41)
  rows.append((match.group(1),match.group(2)))
 if tuple(name for _,name in rows)!=MEMBERS: raise SystemExit(41)
 if sorted(os.listdir(dfd))!=sorted((*MEMBERS,"SHA256SUMS")): raise SystemExit(41)
 digests={name:digest for digest,name in rows}
 safe_source=stable("SAFE_MANIFEST.py");target_source=stable(target)
 if hashlib.sha256(safe_source).hexdigest()!=digests["SAFE_MANIFEST.py"]: raise SystemExit(41)
 if hashlib.sha256(target_source).hexdigest()!=digests[target]: raise SystemExit(41)
 if sig(os.fstat(dfd))!=sig(dst): raise SystemExit(41)
 try: named_dir=os.stat(review,follow_symlinks=False)
 except OSError: raise SystemExit(41)
 if not stat.S_ISDIR(named_dir.st_mode) or (named_dir.st_dev,named_dir.st_ino)!=(dst.st_dev,dst.st_ino): raise SystemExit(41)
finally:
 os.close(dfd)
safe=types.ModuleType("SAFE_MANIFEST");safe.__file__=review+"/SAFE_MANIFEST.py";safe.__package__=None
exec(compile(safe_source,safe.__file__,"exec"),safe.__dict__)
sys.modules["SAFE_MANIFEST"]=safe
sys.argv=[review+"/"+target,*target_args]
scope={"__name__":"__main__","__file__":review+"/"+target,"__package__":None}
exec(compile(target_source,scope["__file__"],"exec"),scope)
PY
}
safe_manifest_check() {
  local manifest=$1
  case "$manifest" in /*) ;; *) manifest=$PWD/$manifest ;; esac
  review_exec SAFE_MANIFEST.py declared --directory "$(dirname -- "$manifest")" \
    --manifest "$(basename -- "$manifest")" --directory-mode 700 --allow-empty-members
}
write_manifest() {
  local output=$1 directory member_root member_root_mode member_mode name digest tmp
  shift
  directory=$(dirname -- "$output")
  member_root=$directory
  member_root_mode=700
  member_mode=600
  if [ "${1:-}" = --member-root ]; then
    test "$#" -ge 7
    member_root=$2
    test "$3" = --member-root-mode
    member_root_mode=$4
    test "$5" = --member-mode
    member_mode=$6
    shift 6
  fi
  mapfile -t manifest_names < <(printf '%s\n' "$@" | LC_ALL=C sort -u)
  test "${#manifest_names[@]}" -eq "$#"
  tmp=$(mktemp "$directory/.manifest.XXXXXX")
  : > "$tmp"
  for name in "${manifest_names[@]}"; do
    [[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]
    digest=$(review_exec SAFE_MANIFEST.py file --path "$member_root/$name" \
      --mode "$member_mode" --allow-empty --print-digest)
    printf '%s %s\n' "$digest" "$name" >> "$tmp"
  done
  chmod 0600 "$tmp"
  mv -f -- "$tmp" "$output"
  if [ "$member_root" = "$directory" ]; then
    safe_manifest_check "$output"
  else
    review_exec SAFE_MANIFEST.py manifest --directory "$directory" \
      --manifest "$(basename -- "$output")" --directory-mode 700 --allow-extra \
      --member-root "$member_root" --member-root-mode "$member_root_mode" \
      --member-mode "$member_mode" "${manifest_names[@]}"
  fi
}
approval=$base/phase0-v17-reentry-review.approved.tsv
current=$base/HANDOFF.recovery-v17.current
review_name=$(basename -- "$review_package")
[[ "$review_manifest_sha" =~ ^[0-9a-f]{64}$ ]]
test "$(dirname -- "$review_package")" = "$review_root"
[[ "$review_name" =~ ^review-runbook-v17-r2-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]]
test "$review_package" = "$review_root/$review_name"
test -f "$review_package/SAFE_MANIFEST.py" && test ! -L "$review_package/SAFE_MANIFEST.py"
test "$(stat -c '%U|%G|%a' "$review_package/SAFE_MANIFEST.py")" = 'root|root|600'
review_exec SAFE_MANIFEST.py manifest --directory "$review_package" \
  --anchor "$review_manifest_sha" --separator one \
  runbook.candidate.md design.candidate.md REVIEW-NOTES.md VALIDATION.tsv FAILURE-STATE.tsv \
  RECOVERY-VERIFY.sh VERIFY.sh PUBLISH.py TRUST-GATE.py TRUST-POLICY.tsv SIMULATE.py SAFE_MANIFEST.py SOURCE-SHA256SUMS
test -f "$approval" && test ! -L "$approval"
test "$(stat -c '%U|%G|%a' "$approval")" = 'root|root|600'
test -f "$current" && test ! -L "$current"
test "$(stat -c '%U|%G|%a' "$current")" = 'root|root|600'
IFS= read -r execution_package < "$current"
review_exec TRUST-GATE.py \
  --trusted-review "$review_package" --trusted-manifest "$review_manifest_sha" \
  --approval "$approval" --execution "$execution_package" --phase current \
  --pointer "$current" --action verify
# COMMIT.tsv, HISTORY.tsv, and TASK5.pending remain unread until the fresh gate succeeds.
measure_routing_preservation() {
  local output=$1 name path resolved version version_rc doctor_json doctor_rc provider_rows
  {
    printf 'provider_model_mutation_authorized|false\nprovider_model_mutation_count|0\nCLIProxyAPI_mutation_authorized|false\nCLIProxyAPI_mutation_count|0\n9router_mutation_authorized|false\n9router_mutation_count|0\nproc_environment_read|false\nprovider_secret_read_or_hash|false\n'
    if path=$(command -v codex 2>/dev/null); then
      resolved=$(readlink -f -- "$path")
      printf 'command|codex|present|%s\n' "$resolved"
      stat -Lc 'command_stat|codex|%U|%G|%a|%s|%Y|%F' -- "$resolved"
      set +e
      version=$("$resolved" --version 2>/dev/null)
      version_rc=$?
      set -e
      test -n "$version" && test "${#version}" -le 200
      [[ "$version" != *$'\n'* && "$version" != *$'\r'* && "$version" != *'|'* ]]
      printf 'command_version|codex|%s|%s\n' "$version_rc" "$version"
      set +e
      doctor_json=$("$resolved" doctor --json 2>/dev/null)
      doctor_rc=$?
      set -e
      printf 'doctor_exit|%s\n' "$doctor_rc"
      provider_rows=$(printf '%s' "$doctor_json" | python3 -c 'import json,re,sys
try: x=json.load(sys.stdin)
except Exception: x={}
rows=[]; allowed={"provider","provider_name","model","model_name"}
def walk(v,p=()):
 if isinstance(v,dict):
  for k in sorted(v):
   n=v[k]
   if k in allowed and isinstance(n,(str,int,float,bool)):
    key=".".join(p+(k,)); value=str(n)
    if not re.fullmatch(r"[A-Za-z0-9_.-]+",key) or not re.fullmatch(r"[A-Za-z0-9._:/+@<>=-]+",value): raise SystemExit(41)
    rows.append(f"provider_model|{key}|{value}")
   elif isinstance(n,(dict,list)): walk(n,p+(k,))
 elif isinstance(v,list):
  for i,n in enumerate(v):
   if isinstance(n,(dict,list)): walk(n,p+(str(i),))
walk(x)
print("\n".join(sorted(rows)) if rows else "provider_model|model|<default>")')
      printf 'provider_model_fields|%s\n' "$(test -n "$provider_rows" && printf '%s\n' "$provider_rows" | wc -l || printf 0)"
      test -z "$provider_rows" || printf '%s\n' "$provider_rows"
    else
      printf 'command|codex|absent|-\ndoctor_exit|not-run\nprovider_model_fields|0\n'
    fi
    for name in CLIProxyAPI 9router; do
      if path=$(command -v "$name" 2>/dev/null); then
        resolved=$(readlink -f -- "$path")
        printf 'command|%s|present|%s\n' "$name" "$resolved"
        stat -Lc "command_stat|$name|%U|%G|%a|%s|%Y|%F" -- "$resolved"
        set +e
        version=$("$resolved" --version 2>/dev/null)
        version_rc=$?
        set -e
        test -n "$version" && test "${#version}" -le 200
        [[ "$version" != *$'\n'* && "$version" != *$'\r'* && "$version" != *'|'* ]]
        printf 'command_version|%s|%s|%s\n' "$name" "$version_rc" "$version"
      else
        printf 'command|%s|absent|-\n' "$name"
      fi
    done
    mapfile -t routing_units < <(systemctl list-unit-files --type=service --no-legend --no-pager 2>/dev/null | \
      awk 'tolower($1) ~ /(cliproxyapi|9router)/ {print $1"|"$2}' | LC_ALL=C sort -u)
    printf 'routing_unit_count|%s\n' "${#routing_units[@]}"
    for unit_row in "${routing_units[@]}"; do
      IFS='|' read -r unit_name unit_enabled <<< "$unit_row"
      [[ "$unit_name" =~ ^[A-Za-z0-9_.@:-]+\.service$ ]]
      unit_active=$(systemctl is-active "$unit_name" 2>/dev/null || true)
      printf 'routing_unit|%s|enabled=%s|active=%s\n' "$unit_name" "$unit_enabled" "$unit_active"
    done
  } > "$output"
}
read -r recovery_dir < "$execution_package/TASK5.pending"
measure_routing_preservation "$recovery_dir/routing-preservation-v17.before.tsv"
commit_tsv=$execution_package/COMMIT.tsv
history_tsv=$execution_package/HISTORY.tsv
kv(){ awk -F '|' -v k="$1" '$1==k{print $2}' "$2"; }
test "$(kv head "$commit_tsv")|$(kv tree "$commit_tsv")|$(kv parent "$commit_tsv")" = "$(kv commit_head "$history_tsv")|$(kv commit_tree "$history_tsv")|$(kv commit_parent "$history_tsv")"
cd "$repo"
test "$(git rev-parse HEAD)" = "$(kv head "$commit_tsv")"
test "$(git rev-parse HEAD^{tree})" = "$(kv tree "$commit_tsv")"
test "$(git rev-parse HEAD^)" = "$(kv parent "$commit_tsv")"
test "$(git diff --cached --name-only | wc -l)" -eq 0
git status --porcelain=v1 --untracked-files=all > "$recovery_dir/root-status.after"
sha256sum "$recovery_dir/root-status.after" | awk '{print $1}' > "$recovery_dir/root-status.after.sha256"
cmp -s "$recovery_dir/root-status.before.sha256" "$recovery_dir/root-status.after.sha256"
test "$(systemctl is-active thoidai-work)" = active
test "$(systemctl is-active nginx)" = active
nginx -t
systemctl show thoidai-work -p ActiveState -p SubState -p MainPID -p NRestarts -p ExecMainStartTimestampMonotonic --value \
  > "$recovery_dir/application-systemd.after.tsv"
cmp -s "$recovery_dir/application-systemd.before.tsv" "$recovery_dir/application-systemd.after.tsv"
systemctl cat thoidai-work | sha256sum | awk '{print $1}' > "$recovery_dir/application-unit.after.sha256"
cmp -s "$recovery_dir/application-unit.before.sha256" "$recovery_dir/application-unit.after.sha256"
main_pid=$(systemctl show thoidai-work -p MainPID --value)
readlink -f "/proc/$main_pid/exe" | sha256sum | awk '{print $1}' > "$recovery_dir/application-exe-path.after.sha256"
sha256sum "$(readlink -f "/proc/$main_pid/exe")" | awk '{print $1}' > "$recovery_dir/application-exe.after.sha256"
cmp -s "$recovery_dir/application-exe-path.before.sha256" "$recovery_dir/application-exe-path.after.sha256"
cmp -s "$recovery_dir/application-exe.before.sha256" "$recovery_dir/application-exe.after.sha256"
sha256sum "$repo/.next/BUILD_ID" | awk '{print $1}' > "$recovery_dir/build-id.after.sha256"
stat -c '%d|%i|%s|%Y|%F' "$repo/.next" > "$recovery_dir/next-stat.after.tsv"
cmp -s "$recovery_dir/build-id.before.sha256" "$recovery_dir/build-id.after.sha256"
cmp -s "$recovery_dir/next-stat.before.tsv" "$recovery_dir/next-stat.after.tsv"
ss -H -lntup | awk '{print $1"|"$5"|"$7}' | LC_ALL=C sort | sha256sum | awk '{print $1}' \
  > "$recovery_dir/socket-topology.after.sha256"
docker ps --format '{{.Names}}|{{.Image}}' | grep -v "^$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")|" \
  | LC_ALL=C sort | sha256sum | awk '{print $1}' > "$recovery_dir/docker-topology.after.sha256"
cmp -s "$recovery_dir/socket-topology.before.sha256" "$recovery_dir/socket-topology.after.sha256"
cmp -s "$recovery_dir/docker-topology.before.sha256" "$recovery_dir/docker-topology.after.sha256"
measure_routing_preservation "$recovery_dir/routing-preservation-v17.after.tsv"
cmp -s "$recovery_dir/routing-preservation-v17.before.tsv" "$recovery_dir/routing-preservation-v17.after.tsv"
curl -sS -o /dev/null --max-time 10 -w '%{http_code}\n' http://127.0.0.1:3001/login > "$recovery_dir/login-http.after.tsv"
curl -sS -o /dev/null --max-time 10 -w '%{http_code}\n' http://127.0.0.1:3001/api/auth/session > "$recovery_dir/session-http.after.tsv"
cmp -s "$recovery_dir/login-http.before.tsv" "$recovery_dir/login-http.after.tsv"
cmp -s "$recovery_dir/session-http.before.tsv" "$recovery_dir/session-http.after.tsv"
docker exec supabase_db_thoidai-work psql -X -U postgres -d postgres -qAtF '|' -v ON_ERROR_STOP=1 -c "begin read only;
select (select count(*) from supabase_migrations.schema_migrations),
       (select count(*) from supabase_migrations.schema_migrations where version in
       ('20260813172000','20260813210000','20260813220000','20260813230000','20260813233000','20260813234500','20260814070000','20260814102000','20260814130000','20260814160000','20260814170000'));
commit;" > "$recovery_dir/production-history.after.tsv"
grep -Fx '9|0' "$recovery_dir/production-history.after.tsv"
cmp -s "$recovery_dir/production-history.before.tsv" "$recovery_dir/production-history.after.tsv"
docker exec -i supabase_db_thoidai-work psql -X -U postgres -d postgres -qAtF '|' -v ON_ERROR_STOP=1 <<'SQL' \
  > "$recovery_dir/production-data.after.tsv"
begin read only;
select 'ADMIN_POLICY',count(*) filter(where r.code='admin'),
 count(*) filter(where r.code='admin' and rp.can_manage_users and rp.can_manage_permissions
   and rp.can_create_task and rp.can_edit_all_tasks and rp.can_comment)
from public.roles r join public.role_permissions rp on rp.role_id=r.id;
select 'TBT_POLICY',count(*) filter(where r.code in ('tong_bien_tap','tbt_read_only')),
 count(*) filter(where r.code in ('tong_bien_tap','tbt_read_only')
   and not rp.can_manage_users and not rp.can_manage_permissions
   and not rp.can_create_task and not rp.can_edit_all_tasks and not rp.can_comment)
from public.roles r join public.role_permissions rp on rp.role_id=r.id;
select 'JOB_TITLE',count(*),(select count(*) from public.staff_users where job_title_id is not null),
 (select count(*) from public.staff_users su left join public.job_titles jt on jt.id=su.job_title_id
   where su.job_title_id is not null and jt.id is null)
from public.job_titles;
select 'LIST_ORDER',count(*) filter(where list_order<0),count(*) filter(where list_order>0),
 count(distinct list_order) filter(where list_order>0),
 coalesce(min(list_order) filter(where list_order>0),0),coalesce(max(list_order) filter(where list_order>0),0)
from public.staff_users;
commit;
SQL
cmp -s "$recovery_dir/production-data.before.tsv" "$recovery_dir/production-data.after.tsv"
test "$(sha256sum "$recovery_dir/production-data.after.tsv" | awk '{print $1}')" = 8a3630780d584b8d75c2ec87ec400d2f6262949e606c08c1465b97b769eaf807
docker exec -i supabase_db_thoidai-work psql -X -U postgres -d postgres -qAtF '|' -v ON_ERROR_STOP=1 <<'SQL' \
  > "$recovery_dir/production-functions.after.tsv"
begin read only;
select p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),
       p.prosecdef,pg_get_userbyid(p.proowner),md5(p.prosrc),coalesce(array_to_string(p.proconfig,','),''),
       has_function_privilege('anon',p.oid,'EXECUTE'),
       has_function_privilege('authenticated',p.oid,'EXECUTE'),
       has_function_privilege('service_role',p.oid,'EXECUTE')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'validate_task_report_recipient','claim_task_plan','save_task_evaluation_checkpoint',
 'ensure_staff_password_hash','consume_password_reset','can_administer_users',
 'touch_job_titles_updated_at','guard_staff_job_title_write','create_bulk_task_plan',
 'report_task_progress','review_task_completion','prepare_admin_password_reset','finalize_admin_password_reset')
order by p.proname,pg_get_function_identity_arguments(p.oid);
commit;
SQL
cmp -s "$recovery_dir/production-functions.before.tsv" "$recovery_dir/production-functions.after.tsv"
test "$(sha256sum "$recovery_dir/production-functions.after.tsv" | awk '{print $1}')" = eeaf94c0015d930e3abf84f7309030ba5700fe6df8410430cf9bf6f6f0eddc52
chmod 0600 "$recovery_dir"/*
```

Expected: production history remains `9|0`; Git/index, service/restart identity, unit, process, executable, build, socket topology, original Docker topology, HTTP behavior, provider/model, CLIProxyAPI, and `9router` preservation gates are unchanged. No environment or provider secret is read or hashed.

- [ ] **Step 2: Reverify quarantine metadata and every new-lane control exactly**

```bash
set -euo pipefail
umask 077
: "${V17_REVIEW_PACKAGE:?exact externally supplied v17 review-package path required}"
: "${V17_REVIEW_MANIFEST_SHA256:?exact externally supplied SHA256SUMS digest required}"
base=/opt/thoidai-reconciliation
review_root=$base/phase0-20260814T135943Z
review_package=$V17_REVIEW_PACKAGE
review_manifest_sha=$V17_REVIEW_MANIFEST_SHA256
review_exec() {
  python3 - "$review_package" "$review_manifest_sha" "$@" <<'PY'
import hashlib,os,re,stat,sys,types
MEMBERS=(
 "runbook.candidate.md","design.candidate.md","REVIEW-NOTES.md","VALIDATION.tsv",
 "FAILURE-STATE.tsv","RECOVERY-VERIFY.sh","VERIFY.sh","PUBLISH.py",
 "TRUST-GATE.py","TRUST-POLICY.tsv","SIMULATE.py","SAFE_MANIFEST.py","SOURCE-SHA256SUMS")
review,anchor,target,*target_args=sys.argv[1:]
sig=lambda s:(s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_uid,s.st_gid,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
if not re.fullmatch(r"[0-9a-f]{64}",anchor): raise SystemExit(41)
if not os.path.isabs(review) or os.path.normpath(review)!=review or os.path.realpath(review)!=review: raise SystemExit(41)
if target not in ("SAFE_MANIFEST.py","TRUST-GATE.py","PUBLISH.py"): raise SystemExit(41)
try: dfd=os.open(review,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
except OSError: raise SystemExit(41)
try:
 dst=os.fstat(dfd)
 if not stat.S_ISDIR(dst.st_mode) or dst.st_uid!=0 or dst.st_gid!=0 or stat.S_IMODE(dst.st_mode)!=0o700: raise SystemExit(41)
 def stable(name):
  if name not in (*MEMBERS,"SHA256SUMS"): raise SystemExit(41)
  try: fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=dfd)
  except OSError: raise SystemExit(41)
  try:
   before=os.fstat(fd);parts=[]
   if not stat.S_ISREG(before.st_mode) or before.st_uid!=0 or before.st_gid!=0 or stat.S_IMODE(before.st_mode)!=0o600: raise SystemExit(41)
   while True:
    chunk=os.read(fd,1<<20)
    if not chunk: break
    parts.append(chunk)
   after=os.fstat(fd)
  finally: os.close(fd)
  data=b"".join(parts)
  try: named=os.stat(name,dir_fd=dfd,follow_symlinks=False)
  except OSError: raise SystemExit(41)
  if sig(before)!=sig(after) or sig(named)!=sig(before): raise SystemExit(41)
  if b"\r" in data or b"\0" in data or not data or not data.endswith(b"\n"): raise SystemExit(41)
  return data
 manifest=stable("SHA256SUMS")
 if hashlib.sha256(manifest).hexdigest()!=anchor: raise SystemExit(41)
 try: lines=manifest.decode("ascii").splitlines()
 except UnicodeDecodeError: raise SystemExit(41)
 rows=[]
 for raw in lines:
  match=re.fullmatch(r"([0-9a-f]{64}) ([A-Za-z0-9][A-Za-z0-9._-]*)",raw)
  if not match: raise SystemExit(41)
  rows.append((match.group(1),match.group(2)))
 if tuple(name for _,name in rows)!=MEMBERS: raise SystemExit(41)
 if sorted(os.listdir(dfd))!=sorted((*MEMBERS,"SHA256SUMS")): raise SystemExit(41)
 digests={name:digest for digest,name in rows}
 safe_source=stable("SAFE_MANIFEST.py");target_source=stable(target)
 if hashlib.sha256(safe_source).hexdigest()!=digests["SAFE_MANIFEST.py"]: raise SystemExit(41)
 if hashlib.sha256(target_source).hexdigest()!=digests[target]: raise SystemExit(41)
 if sig(os.fstat(dfd))!=sig(dst): raise SystemExit(41)
 try: named_dir=os.stat(review,follow_symlinks=False)
 except OSError: raise SystemExit(41)
 if not stat.S_ISDIR(named_dir.st_mode) or (named_dir.st_dev,named_dir.st_ino)!=(dst.st_dev,dst.st_ino): raise SystemExit(41)
finally:
 os.close(dfd)
safe=types.ModuleType("SAFE_MANIFEST");safe.__file__=review+"/SAFE_MANIFEST.py";safe.__package__=None
exec(compile(safe_source,safe.__file__,"exec"),safe.__dict__)
sys.modules["SAFE_MANIFEST"]=safe
sys.argv=[review+"/"+target,*target_args]
scope={"__name__":"__main__","__file__":review+"/"+target,"__package__":None}
exec(compile(target_source,scope["__file__"],"exec"),scope)
PY
}
safe_manifest_check() {
  local manifest=$1
  case "$manifest" in /*) ;; *) manifest=$PWD/$manifest ;; esac
  review_exec SAFE_MANIFEST.py declared --directory "$(dirname -- "$manifest")" \
    --manifest "$(basename -- "$manifest")" --directory-mode 700 --allow-empty-members
}
write_manifest() {
  local output=$1 directory member_root member_root_mode member_mode name digest tmp
  shift
  directory=$(dirname -- "$output")
  member_root=$directory
  member_root_mode=700
  member_mode=600
  if [ "${1:-}" = --member-root ]; then
    test "$#" -ge 7
    member_root=$2
    test "$3" = --member-root-mode
    member_root_mode=$4
    test "$5" = --member-mode
    member_mode=$6
    shift 6
  fi
  mapfile -t manifest_names < <(printf '%s\n' "$@" | LC_ALL=C sort -u)
  test "${#manifest_names[@]}" -eq "$#"
  tmp=$(mktemp "$directory/.manifest.XXXXXX")
  : > "$tmp"
  for name in "${manifest_names[@]}"; do
    [[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]
    digest=$(review_exec SAFE_MANIFEST.py file --path "$member_root/$name" \
      --mode "$member_mode" --allow-empty --print-digest)
    printf '%s %s\n' "$digest" "$name" >> "$tmp"
  done
  chmod 0600 "$tmp"
  mv -f -- "$tmp" "$output"
  if [ "$member_root" = "$directory" ]; then
    safe_manifest_check "$output"
  else
    review_exec SAFE_MANIFEST.py manifest --directory "$directory" \
      --manifest "$(basename -- "$output")" --directory-mode 700 --allow-extra \
      --member-root "$member_root" --member-root-mode "$member_root_mode" \
      --member-mode "$member_mode" "${manifest_names[@]}"
  fi
}
review_root=$base/phase0-20260814T135943Z
review_name=$(basename -- "$review_package")
[[ "$review_manifest_sha" =~ ^[0-9a-f]{64}$ ]]
test "$(dirname -- "$review_package")" = "$review_root"
[[ "$review_name" =~ ^review-runbook-v17-r2-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]]
test "$review_package" = "$review_root/$review_name"
approval=$base/phase0-v17-reentry-review.approved.tsv
current=$base/HANDOFF.recovery-v17.current
test -f "$review_package/SAFE_MANIFEST.py" && test ! -L "$review_package/SAFE_MANIFEST.py"
test "$(stat -c '%U|%G|%a' "$review_package/SAFE_MANIFEST.py")" = 'root|root|600'
review_exec SAFE_MANIFEST.py manifest --directory "$review_package" \
  --anchor "$review_manifest_sha" --separator one \
  runbook.candidate.md design.candidate.md REVIEW-NOTES.md VALIDATION.tsv FAILURE-STATE.tsv \
  RECOVERY-VERIFY.sh VERIFY.sh PUBLISH.py TRUST-GATE.py TRUST-POLICY.tsv SIMULATE.py SAFE_MANIFEST.py SOURCE-SHA256SUMS
test -f "$approval" && test ! -L "$approval" && test -f "$current" && test ! -L "$current"
IFS= read -r execution_package < "$current"
review_exec TRUST-GATE.py \
  --trusted-review "$review_package" --trusted-manifest "$review_manifest_sha" \
  --approval "$approval" --execution "$execution_package" --phase current \
  --pointer "$current" --action verify
evidence_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
read -r recovery_dir < "$execution_package/TASK5.pending"
read -r old_run_dir < "$evidence_root/isolated-run.current"
IFS='|' read -r old_run_id quarantine_container quarantine_volume old_bootstrap old_bootstrap_db old_database < "$old_run_dir/names.tsv"
docker inspect -f 'container_id|{{.Id}}{{println}}state|{{.State.Status}}{{println}}image_id|{{.Image}}{{println}}network|{{.HostConfig.NetworkMode}}{{println}}log_driver|{{.HostConfig.LogConfig.Type}}{{println}}privileged|{{.HostConfig.Privileged}}{{println}}restart|{{.HostConfig.RestartPolicy.Name}}{{println}}auto_remove|{{.HostConfig.AutoRemove}}' \
  "$quarantine_container" > "$recovery_dir/quarantine-container.final.tsv"
docker volume inspect -f 'name|{{.Name}}{{println}}driver|{{.Driver}}{{println}}scope|{{.Scope}}' \
  "$quarantine_volume" > "$recovery_dir/quarantine-volume.final.tsv"
cmp -s "$recovery_dir/quarantine-container.before.tsv" "$recovery_dir/quarantine-container.final.tsv"
cmp -s "$recovery_dir/quarantine-volume.before.tsv" "$recovery_dir/quarantine-volume.final.tsv"
grep -Fx 'runtime_session|forbidden' "$recovery_dir/quarantine-policy.tsv"
grep -Fx 'log_read|forbidden' "$recovery_dir/quarantine-policy.tsv"
lane_container=$(awk -F '|' '$1=="container"{print $2}' "$recovery_dir/lane-names.tsv")
lane_volume=$(awk -F '|' '$1=="volume"{print $2}' "$recovery_dir/lane-names.tsv")
fresh_db=$(awk -F '|' '$1=="fresh_template"{print $2}' "$recovery_dir/lane-names.tsv")
diagnostic_db=$(awk -F '|' '$1=="diagnostic"{print $2}' "$recovery_dir/lane-names.tsv")
successor_db=$(awk -F '|' '$1=="successor"{print $2}' "$recovery_dir/lane-names.tsv")
test "$(docker inspect -f '{{.State.Running}}' "$lane_container")" = true
docker inspect -f 'image_id|{{.Image}}{{println}}network|{{.HostConfig.NetworkMode}}{{println}}ports|{{len .NetworkSettings.Ports}}{{println}}log_driver|{{.HostConfig.LogConfig.Type}}{{println}}cpu_nano|{{.HostConfig.NanoCpus}}{{println}}memory|{{.HostConfig.Memory}}{{println}}memory_swap|{{.HostConfig.MemorySwap}}{{println}}pids|{{.HostConfig.PidsLimit}}{{println}}restart|{{.HostConfig.RestartPolicy.Name}}{{println}}auto_remove|{{.HostConfig.AutoRemove}}{{println}}privileged|{{.HostConfig.Privileged}}' \
  "$lane_container" > "$recovery_dir/lane-policy.final.tsv"
cmp -s "$recovery_dir/lane-policy.expected.tsv" "$recovery_dir/lane-policy.final.tsv"
test -z "$(docker port "$lane_container")"
test "$(docker inspect -f '{{len .Mounts}}' "$lane_container")" -eq 2
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Type}}|{{.Name}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "volume|$lane_volume|true"
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/run/secrets/phase0-postgres-password"}}{{.Type}}|{{.Source}}|{{.RW}}{{end}}{{end}}' "$lane_container")" = "bind|$recovery_dir/postgres-password.secret|false"
test "$(docker inspect -f '{{index .HostConfig.Tmpfs "/run/phase0"}}' "$lane_container")" = 'rw,noexec,nosuid,size=16m,mode=0700'
test -z "$(docker inspect -f '{{.HostConfig.PidMode}}' "$lane_container")"
test "$(docker inspect -f '{{.HostConfig.IpcMode}}' "$lane_container")" = private
test "$(docker inspect -f '{{len .HostConfig.CapAdd}}|{{len .HostConfig.Devices}}' "$lane_container")" = '0|0'
docker volume inspect "$lane_volume" >/dev/null
test "$(stat -c '%U|%a' "$recovery_dir/postgres-password.secret")" = 'root|600'
docker exec "$lane_container" psql -X -U phase0_bootstrap -d postgres -qAtF '|' -v ON_ERROR_STOP=1 \
  -v fresh_db="$fresh_db" -v diagnostic_db="$diagnostic_db" -v successor_db="$successor_db" -c \
  "with requested(lane,datname) as (values ('diagnostic',:'diagnostic_db'),('successor',:'successor_db'),('template',:'fresh_db'))
   select requested.lane,count(d.*),coalesce(min(pg_get_userbyid(d.datdba)),'')
   from requested left join pg_database d using(datname) group by requested.lane order by requested.lane;" \
  > "$recovery_dir/lane-databases.final.tsv"
grep -Fx 'diagnostic|1|postgres' "$recovery_dir/lane-databases.final.tsv"
grep -Fx 'successor|1|postgres' "$recovery_dir/lane-databases.final.tsv"
grep -Fx 'template|1|postgres' "$recovery_dir/lane-databases.final.tsv"
chmod 0600 "$recovery_dir"/*
```

Expected: quarantine metadata is byte-identical without a runtime session or log read. The new lane is running and retained with exact image, logging, isolation, security, resource, mount, tmpfs, volume, secret-mode, and database-identity controls.

- [ ] **Step 3: Seal final evidence without secret or log inputs**

```bash
set -euo pipefail
umask 077
: "${V17_REVIEW_PACKAGE:?exact externally supplied v17 review-package path required}"
: "${V17_REVIEW_MANIFEST_SHA256:?exact externally supplied SHA256SUMS digest required}"
base=/opt/thoidai-reconciliation
review_root=$base/phase0-20260814T135943Z
review_package=$V17_REVIEW_PACKAGE
review_manifest_sha=$V17_REVIEW_MANIFEST_SHA256
review_exec() {
  python3 - "$review_package" "$review_manifest_sha" "$@" <<'PY'
import hashlib,os,re,stat,sys,types
MEMBERS=(
 "runbook.candidate.md","design.candidate.md","REVIEW-NOTES.md","VALIDATION.tsv",
 "FAILURE-STATE.tsv","RECOVERY-VERIFY.sh","VERIFY.sh","PUBLISH.py",
 "TRUST-GATE.py","TRUST-POLICY.tsv","SIMULATE.py","SAFE_MANIFEST.py","SOURCE-SHA256SUMS")
review,anchor,target,*target_args=sys.argv[1:]
sig=lambda s:(s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_uid,s.st_gid,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
if not re.fullmatch(r"[0-9a-f]{64}",anchor): raise SystemExit(41)
if not os.path.isabs(review) or os.path.normpath(review)!=review or os.path.realpath(review)!=review: raise SystemExit(41)
if target not in ("SAFE_MANIFEST.py","TRUST-GATE.py","PUBLISH.py"): raise SystemExit(41)
try: dfd=os.open(review,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
except OSError: raise SystemExit(41)
try:
 dst=os.fstat(dfd)
 if not stat.S_ISDIR(dst.st_mode) or dst.st_uid!=0 or dst.st_gid!=0 or stat.S_IMODE(dst.st_mode)!=0o700: raise SystemExit(41)
 def stable(name):
  if name not in (*MEMBERS,"SHA256SUMS"): raise SystemExit(41)
  try: fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=dfd)
  except OSError: raise SystemExit(41)
  try:
   before=os.fstat(fd);parts=[]
   if not stat.S_ISREG(before.st_mode) or before.st_uid!=0 or before.st_gid!=0 or stat.S_IMODE(before.st_mode)!=0o600: raise SystemExit(41)
   while True:
    chunk=os.read(fd,1<<20)
    if not chunk: break
    parts.append(chunk)
   after=os.fstat(fd)
  finally: os.close(fd)
  data=b"".join(parts)
  try: named=os.stat(name,dir_fd=dfd,follow_symlinks=False)
  except OSError: raise SystemExit(41)
  if sig(before)!=sig(after) or sig(named)!=sig(before): raise SystemExit(41)
  if b"\r" in data or b"\0" in data or not data or not data.endswith(b"\n"): raise SystemExit(41)
  return data
 manifest=stable("SHA256SUMS")
 if hashlib.sha256(manifest).hexdigest()!=anchor: raise SystemExit(41)
 try: lines=manifest.decode("ascii").splitlines()
 except UnicodeDecodeError: raise SystemExit(41)
 rows=[]
 for raw in lines:
  match=re.fullmatch(r"([0-9a-f]{64}) ([A-Za-z0-9][A-Za-z0-9._-]*)",raw)
  if not match: raise SystemExit(41)
  rows.append((match.group(1),match.group(2)))
 if tuple(name for _,name in rows)!=MEMBERS: raise SystemExit(41)
 if sorted(os.listdir(dfd))!=sorted((*MEMBERS,"SHA256SUMS")): raise SystemExit(41)
 digests={name:digest for digest,name in rows}
 safe_source=stable("SAFE_MANIFEST.py");target_source=stable(target)
 if hashlib.sha256(safe_source).hexdigest()!=digests["SAFE_MANIFEST.py"]: raise SystemExit(41)
 if hashlib.sha256(target_source).hexdigest()!=digests[target]: raise SystemExit(41)
 if sig(os.fstat(dfd))!=sig(dst): raise SystemExit(41)
 try: named_dir=os.stat(review,follow_symlinks=False)
 except OSError: raise SystemExit(41)
 if not stat.S_ISDIR(named_dir.st_mode) or (named_dir.st_dev,named_dir.st_ino)!=(dst.st_dev,dst.st_ino): raise SystemExit(41)
finally:
 os.close(dfd)
safe=types.ModuleType("SAFE_MANIFEST");safe.__file__=review+"/SAFE_MANIFEST.py";safe.__package__=None
exec(compile(safe_source,safe.__file__,"exec"),safe.__dict__)
sys.modules["SAFE_MANIFEST"]=safe
sys.argv=[review+"/"+target,*target_args]
scope={"__name__":"__main__","__file__":review+"/"+target,"__package__":None}
exec(compile(target_source,scope["__file__"],"exec"),scope)
PY
}
safe_manifest_check() {
  local manifest=$1
  case "$manifest" in /*) ;; *) manifest=$PWD/$manifest ;; esac
  review_exec SAFE_MANIFEST.py declared --directory "$(dirname -- "$manifest")" \
    --manifest "$(basename -- "$manifest")" --directory-mode 700 --allow-empty-members
}
write_manifest() {
  local output=$1 directory member_root member_root_mode member_mode name digest tmp
  shift
  directory=$(dirname -- "$output")
  member_root=$directory
  member_root_mode=700
  member_mode=600
  if [ "${1:-}" = --member-root ]; then
    test "$#" -ge 7
    member_root=$2
    test "$3" = --member-root-mode
    member_root_mode=$4
    test "$5" = --member-mode
    member_mode=$6
    shift 6
  fi
  mapfile -t manifest_names < <(printf '%s\n' "$@" | LC_ALL=C sort -u)
  test "${#manifest_names[@]}" -eq "$#"
  tmp=$(mktemp "$directory/.manifest.XXXXXX")
  : > "$tmp"
  for name in "${manifest_names[@]}"; do
    [[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]
    digest=$(review_exec SAFE_MANIFEST.py file --path "$member_root/$name" \
      --mode "$member_mode" --allow-empty --print-digest)
    printf '%s %s\n' "$digest" "$name" >> "$tmp"
  done
  chmod 0600 "$tmp"
  mv -f -- "$tmp" "$output"
  if [ "$member_root" = "$directory" ]; then
    safe_manifest_check "$output"
  else
    review_exec SAFE_MANIFEST.py manifest --directory "$directory" \
      --manifest "$(basename -- "$output")" --directory-mode 700 --allow-extra \
      --member-root "$member_root" --member-root-mode "$member_root_mode" \
      --member-mode "$member_mode" "${manifest_names[@]}"
  fi
}
approval=$base/phase0-v17-reentry-review.approved.tsv
current=$base/HANDOFF.recovery-v17.current
test -f "$review_package/SAFE_MANIFEST.py" && test ! -L "$review_package/SAFE_MANIFEST.py"
review_name=$(basename -- "$review_package")
[[ "$review_manifest_sha" =~ ^[0-9a-f]{64}$ ]]
test "$(dirname -- "$review_package")" = "$review_root"
[[ "$review_name" =~ ^review-runbook-v17-r2-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]]
test "$review_package" = "$review_root/$review_name"
test "$(stat -c '%U|%G|%a' "$review_package/SAFE_MANIFEST.py")" = 'root|root|600'
review_exec SAFE_MANIFEST.py manifest --directory "$review_package" \
  --anchor "$review_manifest_sha" --separator one \
  runbook.candidate.md design.candidate.md REVIEW-NOTES.md VALIDATION.tsv FAILURE-STATE.tsv \
  RECOVERY-VERIFY.sh VERIFY.sh PUBLISH.py TRUST-GATE.py TRUST-POLICY.tsv SIMULATE.py SAFE_MANIFEST.py SOURCE-SHA256SUMS
test -f "$approval" && test ! -L "$approval" && test -f "$current" && test ! -L "$current"
IFS= read -r execution_package < "$current"
review_exec TRUST-GATE.py \
  --trusted-review "$review_package" --trusted-manifest "$review_manifest_sha" \
  --approval "$approval" --execution "$execution_package" --phase current \
  --pointer "$current" --action verify
read -r recovery_dir < "$execution_package/TASK5.pending"
printf 'phase|task9\nstatus|complete\nproduction_history|9|0\nquarantine_log_read|false\nprovider_model_mutation|false\nCLIProxyAPI_mutation|false\n9router_mutation|false\nactive_build_mutation|false\nnew_lane|running_retained\nhistory_write|false\n' \
  > "$recovery_dir/TASK9.COMPLETE"
mapfile -t final_members < <(find "$recovery_dir" -maxdepth 1 -type f \
  ! -name 'postgres-password.secret' ! -name 'FINAL-SHA256SUMS' -printf '%f\n' | LC_ALL=C sort)
write_manifest "$recovery_dir/FINAL-SHA256SUMS" "${final_members[@]}"
(cd / && safe_manifest_check "$recovery_dir/FINAL-SHA256SUMS" >/dev/null)
chmod 0600 "$recovery_dir/TASK9.COMPLETE" "$recovery_dir/FINAL-SHA256SUMS"
```

Expected: all safe evidence verifies. The new secret and every container log are excluded from hashing. Nothing is stopped, removed, truncated, or cleaned up.

## Task 10: Executable v17 externally anchored, anonymous-inode, no-replace publication

Task 10 remains unreachable in this documentation turn. The future transaction below never modifies `HANDOFF.current`, never executes a helper selected from an execution package, and never resumes Task 5 or mutates its runtime. The operator supplies the exact trusted review path and manifest SHA independently; only `TRUST-GATE.py`, validators, and publisher from that anchored review package may execute.

- [ ] **Run the externally anchored v17 state machine under the immutable-old-authority lock**

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${V17_REVIEW_PACKAGE:?exact externally supplied v17 review-package path required}"
: "${V17_REVIEW_MANIFEST_SHA256:?exact externally supplied SHA256SUMS digest required}"
repo=/opt/thoidai-work
base=/opt/thoidai-reconciliation
review_root=$base/phase0-20260814T135943Z
review_package=$V17_REVIEW_PACKAGE
review_manifest_sha=$V17_REVIEW_MANIFEST_SHA256
review_exec() {
  python3 - "$review_package" "$review_manifest_sha" "$@" <<'PY'
import hashlib,os,re,stat,sys,types
MEMBERS=(
 "runbook.candidate.md","design.candidate.md","REVIEW-NOTES.md","VALIDATION.tsv",
 "FAILURE-STATE.tsv","RECOVERY-VERIFY.sh","VERIFY.sh","PUBLISH.py",
 "TRUST-GATE.py","TRUST-POLICY.tsv","SIMULATE.py","SAFE_MANIFEST.py","SOURCE-SHA256SUMS")
review,anchor,target,*target_args=sys.argv[1:]
sig=lambda s:(s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_uid,s.st_gid,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
if not re.fullmatch(r"[0-9a-f]{64}",anchor): raise SystemExit(41)
if not os.path.isabs(review) or os.path.normpath(review)!=review or os.path.realpath(review)!=review: raise SystemExit(41)
if target not in ("SAFE_MANIFEST.py","TRUST-GATE.py","PUBLISH.py"): raise SystemExit(41)
try: dfd=os.open(review,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
except OSError: raise SystemExit(41)
try:
 dst=os.fstat(dfd)
 if not stat.S_ISDIR(dst.st_mode) or dst.st_uid!=0 or dst.st_gid!=0 or stat.S_IMODE(dst.st_mode)!=0o700: raise SystemExit(41)
 def stable(name):
  if name not in (*MEMBERS,"SHA256SUMS"): raise SystemExit(41)
  try: fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=dfd)
  except OSError: raise SystemExit(41)
  try:
   before=os.fstat(fd);parts=[]
   if not stat.S_ISREG(before.st_mode) or before.st_uid!=0 or before.st_gid!=0 or stat.S_IMODE(before.st_mode)!=0o600: raise SystemExit(41)
   while True:
    chunk=os.read(fd,1<<20)
    if not chunk: break
    parts.append(chunk)
   after=os.fstat(fd)
  finally: os.close(fd)
  data=b"".join(parts)
  try: named=os.stat(name,dir_fd=dfd,follow_symlinks=False)
  except OSError: raise SystemExit(41)
  if sig(before)!=sig(after) or sig(named)!=sig(before): raise SystemExit(41)
  if b"\r" in data or b"\0" in data or not data or not data.endswith(b"\n"): raise SystemExit(41)
  return data
 manifest=stable("SHA256SUMS")
 if hashlib.sha256(manifest).hexdigest()!=anchor: raise SystemExit(41)
 try: lines=manifest.decode("ascii").splitlines()
 except UnicodeDecodeError: raise SystemExit(41)
 rows=[]
 for raw in lines:
  match=re.fullmatch(r"([0-9a-f]{64}) ([A-Za-z0-9][A-Za-z0-9._-]*)",raw)
  if not match: raise SystemExit(41)
  rows.append((match.group(1),match.group(2)))
 if tuple(name for _,name in rows)!=MEMBERS: raise SystemExit(41)
 if sorted(os.listdir(dfd))!=sorted((*MEMBERS,"SHA256SUMS")): raise SystemExit(41)
 digests={name:digest for digest,name in rows}
 safe_source=stable("SAFE_MANIFEST.py");target_source=stable(target)
 if hashlib.sha256(safe_source).hexdigest()!=digests["SAFE_MANIFEST.py"]: raise SystemExit(41)
 if hashlib.sha256(target_source).hexdigest()!=digests[target]: raise SystemExit(41)
 if sig(os.fstat(dfd))!=sig(dst): raise SystemExit(41)
 try: named_dir=os.stat(review,follow_symlinks=False)
 except OSError: raise SystemExit(41)
 if not stat.S_ISDIR(named_dir.st_mode) or (named_dir.st_dev,named_dir.st_ino)!=(dst.st_dev,dst.st_ino): raise SystemExit(41)
finally:
 os.close(dfd)
safe=types.ModuleType("SAFE_MANIFEST");safe.__file__=review+"/SAFE_MANIFEST.py";safe.__package__=None
exec(compile(safe_source,safe.__file__,"exec"),safe.__dict__)
sys.modules["SAFE_MANIFEST"]=safe
sys.argv=[review+"/"+target,*target_args]
scope={"__name__":"__main__","__file__":review+"/"+target,"__package__":None}
exec(compile(target_source,scope["__file__"],"exec"),scope)
PY
}
safe_manifest_check() {
  local manifest=$1
  case "$manifest" in /*) ;; *) manifest=$PWD/$manifest ;; esac
  review_exec SAFE_MANIFEST.py declared --directory "$(dirname -- "$manifest")" \
    --manifest "$(basename -- "$manifest")" --directory-mode 700 --allow-empty-members
}
write_manifest() {
  local output=$1 directory member_root member_root_mode member_mode name digest tmp
  shift
  directory=$(dirname -- "$output")
  member_root=$directory
  member_root_mode=700
  member_mode=600
  if [ "${1:-}" = --member-root ]; then
    test "$#" -ge 7
    member_root=$2
    test "$3" = --member-root-mode
    member_root_mode=$4
    test "$5" = --member-mode
    member_mode=$6
    shift 6
  fi
  mapfile -t manifest_names < <(printf '%s\n' "$@" | LC_ALL=C sort -u)
  test "${#manifest_names[@]}" -eq "$#"
  tmp=$(mktemp "$directory/.manifest.XXXXXX")
  : > "$tmp"
  for name in "${manifest_names[@]}"; do
    [[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]
    digest=$(review_exec SAFE_MANIFEST.py file --path "$member_root/$name" \
      --mode "$member_mode" --allow-empty --print-digest)
    printf '%s %s\n' "$digest" "$name" >> "$tmp"
  done
  chmod 0600 "$tmp"
  mv -f -- "$tmp" "$output"
  if [ "$member_root" = "$directory" ]; then
    safe_manifest_check "$output"
  else
    review_exec SAFE_MANIFEST.py manifest --directory "$directory" \
      --manifest "$(basename -- "$output")" --directory-mode 700 --allow-extra \
      --member-root "$member_root" --member-root-mode "$member_root_mode" \
      --member-mode "$member_mode" "${manifest_names[@]}"
  fi
}
approval=$base/phase0-v17-reentry-review.approved.tsv
v5_approval=$base/phase0-v5-primary-review.approved.tsv
old_current=$base/HANDOFF.current
old_package=$base/phase0-execution-handoff-20260815T041006Z-2be71271104d
task5_pending=$base/phase0-v5-execution.pending
recovery=$base/phase0-v5-execution-20260815T041430Z-7fa3f327f5c8
pending=$base/phase0-v17-execution-handoff.pending
current=$base/HANDOFF.recovery-v17.current
plan_rel=docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md
design_rel=docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md
old_sha=a7e4ef17ee3eaa00bacc6693772940b5308390fcbd9ef4c2275ec9b788c01005
package=
lock_inode=
test -z "${PHASE0_V17_FAULT+x}${PHASE0_V17_BARRIER+x}"

fsync_path(){ python3 - "$1" <<'PY'
import os,sys
fd=os.open(sys.argv[1],os.O_RDONLY|os.O_CLOEXEC)
try: os.fsync(fd)
finally: os.close(fd)
PY
}
fsync_dir(){ python3 - "$1" <<'PY'
import os,sys
fd=os.open(sys.argv[1],os.O_RDONLY|os.O_DIRECTORY|os.O_CLOEXEC)
try: os.fsync(fd)
finally: os.close(fd)
PY
}
kv(){ awk -F '|' -v k="$1" '$1==k{print $2}' "$2"; }
assert_text(){
  local f cr nul last
  for f in "$@"; do
    test -f "$f" && test ! -L "$f" || return 41
    cr=$(LC_ALL=C tr -cd '\r' < "$f" | wc -c)
    nul=$(LC_ALL=C tr -cd '\000' < "$f" | wc -c)
    test "$cr" -eq 0 && test "$nul" -eq 0 || return 41
    last=$(tail -c 1 -- "$f" | od -An -t x1 | tr -d ' \n')
    test "$last" = 0a || return 41
  done
}
exact_schema(){
  local file=$1 count=$2 keys=$3
  awk -F '|' -v keys="$keys" -v count="$count" \
    'BEGIN{split(keys,a," ");for(i in a)e[a[i]]=1}
     NF!=2||!($1 in e)||seen[$1]++{bad=1}
     END{if(NR!=count)bad=1;for(k in e)if(seen[k]!=1)bad=1;exit bad?41:0}' "$file"
}
review_keys='verdict scope critical_open important_open task5_reentry_authorized authorized_predecessor review_package review_manifest_sha256 old_handoff_package old_handoff_pointer_sha256 old_handoff_manifest_sha256 v5_approval_sha256 task5_pending_path task5_pending_sha256 recovery_path failure_state_sha256 new_pending_path new_current_path unrelated_status_count unrelated_status_sha256 lock_path lock_device_inode'
rv(){ kv "$1" "$approval"; }

# Validate the externally supplied review anchor before reading approval or any member.
review_name=$(basename -- "$review_package")
[[ "$review_manifest_sha" =~ ^[0-9a-f]{64}$ ]]
test "$(dirname -- "$review_package")" = "$review_root"
[[ "$review_name" =~ ^review-runbook-v17-r2-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]]
test "$review_package" = "$review_root/$review_name"
test -f "$review_package/SAFE_MANIFEST.py" && test ! -L "$review_package/SAFE_MANIFEST.py"
test "$(stat -c '%U|%G|%a' "$review_package/SAFE_MANIFEST.py")" = 'root|root|600'
review_exec SAFE_MANIFEST.py manifest --directory "$review_package" --anchor "$review_manifest_sha" --separator one \
  runbook.candidate.md design.candidate.md REVIEW-NOTES.md VALIDATION.tsv FAILURE-STATE.tsv \
  RECOVERY-VERIFY.sh VERIFY.sh PUBLISH.py TRUST-GATE.py TRUST-POLICY.tsv SIMULATE.py SAFE_MANIFEST.py SOURCE-SHA256SUMS
safe_digest(){ review_exec SAFE_MANIFEST.py file --path "$1" --mode "${2:-600}" --print-digest; }

for f in "$approval" "$v5_approval" "$old_current" "$task5_pending"; do
  test -f "$f" && test ! -L "$f"
  test "$(stat -c '%U|%G|%a' "$f")" = 'root|root|600'
done
assert_text "$approval" "$v5_approval" "$old_current" "$task5_pending"
exact_schema "$approval" 22 "$review_keys"
test "$(rv verdict)|$(rv scope)|$(rv critical_open)|$(rv important_open)|$(rv task5_reentry_authorized)" = 'APPROVED|phase0-v17-task5-reentry-correction|0|0|true'
test "$(rv review_package)|$(rv review_manifest_sha256)" = "$review_package|$review_manifest_sha"
test "$(rv authorized_predecessor)" = 464d17a652cdd622b5c20891e8f7fe24b55e6dd6
test "$(rv new_pending_path)|$(rv new_current_path)" = "$pending|$current"
test "$(rv lock_path)" = "$old_current"
test "$(safe_digest "$old_current")" = "$old_sha"
test "$(tr -d '\n' < "$old_current")" = "$old_package"
test "$(safe_digest "$v5_approval")" = "$(rv v5_approval_sha256)"
test "$(safe_digest "$task5_pending")" = "$(rv task5_pending_sha256)"

cd "$repo"
git diff --cached --quiet
git diff --quiet -- "$plan_rel" "$design_rel"
test "$(git rev-list --parents -n 1 HEAD | awk '{print NF}')" -eq 2
test "$(git rev-parse HEAD^)" = "$(rv authorized_predecessor)"
printf '%s\n%s\n' "$design_rel" "$plan_rel" | LC_ALL=C sort | \
  cmp -s - <(git diff-tree --no-commit-id --name-only -r HEAD | LC_ALL=C sort)
git show "HEAD:$plan_rel" | cmp -s - "$review_package/runbook.candidate.md"
git show "HEAD:$design_rel" | cmp -s - "$review_package/design.candidate.md"

exec 9<"$old_current"
/usr/bin/flock -x 9
lock_inode=$(stat -Lc '%d:%i' /proc/self/fd/9)
test "$lock_inode" = "$(stat -c '%d:%i' "$old_current")"
test "$lock_inode" = "$(rv lock_device_inode)"
test "$(kv lock_path "$review_package/TRUST-POLICY.tsv")|$(kv lock_device_inode "$review_package/TRUST-POLICY.tsv")" = "$old_current|$lock_inode"

build_package(){
  local stamp nonce staging pointer_sha publication_sha
  cd "$repo"
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  nonce=$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')
  package=$base/phase0-v17-execution-handoff-$stamp-$nonce
  staging=$base/.phase0-v17-execution-handoff-stage-$stamp-$nonce
  test ! -e "$package" && test ! -L "$package"
  test ! -e "$staging" && test ! -L "$staging"
  mkdir -m0700 "$staging"
  git show "HEAD:$plan_rel" > "$staging/plan.md"
  git show "HEAD:$design_rel" > "$staging/design.md"
  cp -- "$v5_approval" "$staging/REVIEW-V5.tsv"
  cp -- "$approval" "$staging/REVIEW-V17.tsv"
  cp -- "$old_current" "$staging/OLD-HANDOFF.current"
  cp -- "$task5_pending" "$staging/TASK5.pending"
  cp -- "$review_package/FAILURE-STATE.tsv" "$staging/FAILURE-STATE.tsv"
  cp -- "$review_package/VERIFY.sh" "$staging/VERIFY.sh"
  cp -- "$review_package/RECOVERY-VERIFY.sh" "$staging/RECOVERY-VERIFY.sh"
  cp -- "$review_package/PUBLISH.py" "$staging/PUBLISH.py"
  cp -- "$review_package/TRUST-GATE.py" "$staging/TRUST-GATE.py"
  cp -- "$review_package/TRUST-POLICY.tsv" "$staging/TRUST-POLICY.tsv"
  cp -- "$review_package/SAFE_MANIFEST.py" "$staging/SAFE_MANIFEST.py"
  cp -- "$review_package/SOURCE-SHA256SUMS" "$staging/SOURCE-SHA256SUMS"
  pointer_sha=$(printf '%s\n' "$package" | sha256sum | awk '{print $1}')
  printf 'publisher_version|phase0-v17-otmpfile-linkat\nsource_strategy|O_TMPFILE+linkat-AT_EMPTY_PATH\npending_path|%s\ncurrent_path|%s\npointer_sha256|%s\nsame_inode_required|true\nno_replace|true\nbase_fsync_required|after-each-link-and-before-pending-resume\n' \
    "$pending" "$current" "$pointer_sha" > "$staging/PUBLICATION.tsv"
  printf 'immutable_old_handoff_path|%s\nimmutable_old_handoff_package|%s\nimmutable_old_handoff_pointer_sha256|%s\ntask5_pending_path|%s\ntask5_pending_sha256|%s\nfailure_state_sha256|%s\nnew_pending_path|%s\nnew_current_path|%s\ncommit_head|%s\ncommit_tree|%s\ncommit_parent|%s\nlock_path|%s\nlock_device_inode|%s\n' \
    "$old_current" "$old_package" "$old_sha" "$task5_pending" "$(rv task5_pending_sha256)" \
    "$(rv failure_state_sha256)" "$pending" "$current" "$(git rev-parse HEAD)" \
    "$(git rev-parse HEAD^{tree})" "$(git rev-parse HEAD^)" "$old_current" "$lock_inode" > "$staging/HISTORY.tsv"
  publication_sha=$(safe_digest "$staging/PUBLICATION.tsv")
  printf 'head|%s\ntree|%s\nparent|%s\nparent_count|1\nplan_blob|%s\ndesign_blob|%s\nreview_package|%s\nreview_manifest_sha256|%s\nv17_approval_sha256|%s\nv5_approval_sha256|%s\nold_handoff_package|%s\nold_handoff_pointer_sha256|%s\nold_handoff_manifest_sha256|%s\ntask5_pending_path|%s\ntask5_pending_sha256|%s\nrecovery_path|%s\nfailure_state_sha256|%s\nnew_pending_path|%s\nnew_current_path|%s\nunrelated_status_count|%s\nunrelated_status_sha256|%s\nold_handoff_copy_sha256|%s\ntask5_pending_copy_sha256|%s\npublication_sha256|%s\npublisher_sha256|%s\nlock_device_inode|%s\n' \
    "$(git rev-parse HEAD)" "$(git rev-parse HEAD^{tree})" "$(git rev-parse HEAD^)" \
    "$(git rev-parse HEAD:$plan_rel)" "$(git rev-parse HEAD:$design_rel)" \
    "$review_package" "$review_manifest_sha" "$(safe_digest "$approval")" \
    "$(rv v5_approval_sha256)" "$(rv old_handoff_package)" "$(rv old_handoff_pointer_sha256)" \
    "$(rv old_handoff_manifest_sha256)" "$(rv task5_pending_path)" "$(rv task5_pending_sha256)" \
    "$(rv recovery_path)" "$(rv failure_state_sha256)" "$pending" "$current" \
    "$(rv unrelated_status_count)" "$(rv unrelated_status_sha256)" \
    "$(safe_digest "$staging/OLD-HANDOFF.current")" \
    "$(safe_digest "$staging/TASK5.pending")" "$publication_sha" \
    "$(safe_digest "$review_package/PUBLISH.py")" "$lock_inode" > "$staging/COMMIT.tsv"
  chmod 0600 "$staging"/*
  execution_members=(plan.md design.md COMMIT.tsv REVIEW-V5.tsv REVIEW-V17.tsv FAILURE-STATE.tsv HISTORY.tsv PUBLICATION.tsv OLD-HANDOFF.current TASK5.pending VERIFY.sh RECOVERY-VERIFY.sh PUBLISH.py TRUST-GATE.py TRUST-POLICY.tsv SAFE_MANIFEST.py SOURCE-SHA256SUMS)
  : > "$staging/SHA256SUMS"
  chmod 0600 "$staging/SHA256SUMS"
  for member in "${execution_members[@]}"; do
    printf '%s %s\n' "$(safe_digest "$staging/$member")" "$member" >> "$staging/SHA256SUMS"
  done
  assert_text "$staging"/*
  review_exec SAFE_MANIFEST.py manifest --directory "$staging" --separator one "${execution_members[@]}"
  for f in "$staging"/*; do fsync_path "$f"; done
  fsync_dir "$staging"
  python3 - "$staging" "$package" <<'PY'
import ctypes,errno,os,sys
src,dst=sys.argv[1:3]
libc=ctypes.CDLL(None,use_errno=True)
renameat2=libc.renameat2
renameat2.argtypes=(ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint)
renameat2.restype=ctypes.c_int
if renameat2(-100,os.fsencode(src),-100,os.fsencode(dst),1)!=0:
    error=ctypes.get_errno()
    if error==errno.EEXIST: raise SystemExit(73)
    raise OSError(error,os.strerror(error))
PY
  fsync_dir "$base"
}

load_pointer_package(){
  local pointer=$1 name
  test -f "$pointer" && test ! -L "$pointer"
  test "$(stat -c '%U|%G|%a' "$pointer")" = 'root|root|600'
  assert_text "$pointer"
  test "$(awk 'END{print NR+0}' "$pointer")" -eq 1
  IFS= read -r package < "$pointer"
  name=$(basename -- "$package")
  test "$(dirname -- "$package")" = "$base"
  [[ "$name" =~ ^phase0-v17-execution-handoff-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]]
  test "$package" = "$base/$name"
  test -d "$package" && test ! -L "$package"
  test "$(realpath -e -- "$package")" = "$package"
  test "$(stat -c '%U|%G|%a' "$package")" = 'root|root|700'
}

trusted_gate(){
  local subject=$1 phase=$2 action=$3 stage=$4
  case "$phase" in
    package)
      review_exec TRUST-GATE.py \
        --trusted-review "$review_package" --trusted-manifest "$review_manifest_sha" \
        --approval "$approval" --execution "$package" --phase package --action "$action" --recovery-stage "$stage"
      ;;
    pending|current)
      review_exec TRUST-GATE.py \
        --trusted-review "$review_package" --trusted-manifest "$review_manifest_sha" \
        --approval "$approval" --execution "$package" --phase "$phase" \
        --pointer "$subject" --action "$action" --recovery-stage "$stage"
      ;;
    *) return 41 ;;
  esac
}

pending_present=false
current_present=false
if test -e "$pending" || test -L "$pending"; then pending_present=true; fi
if test -e "$current" || test -L "$current"; then current_present=true; fi
test "$pending_present|$current_present" != 'false|true'

if test "$pending_present|$current_present" = 'false|false'; then
  build_package
  pointer_sha=$(printf '%s\n' "$package" | sha256sum | awk '{print $1}')
  trusted_gate "$package" package both pre-resume
  review_exec PUBLISH.py initial "$package" "$pending" "$current" "$base" "$pointer_sha"
fi

pending_present=false
current_present=false
if test -e "$pending" || test -L "$pending"; then pending_present=true; fi
if test -e "$current" || test -L "$current"; then current_present=true; fi
test "$pending_present|$current_present" != 'false|true'

if test "$pending_present|$current_present" = 'true|false'; then
  fsync_dir "$base"
  load_pointer_package "$pending"
  pointer_sha=$(printf '%s\n' "$package" | sha256sum | awk '{print $1}')
  trusted_gate "$pending" pending both pre-resume
  review_exec PUBLISH.py current "$package" "$pending" "$current" "$base" "$pointer_sha"
fi

load_pointer_package "$current"
pointer_sha=$(printf '%s\n' "$package" | sha256sum | awk '{print $1}')
trusted_gate "$current" current both pre-resume
review_exec PUBLISH.py verify "$package" "$pending" "$current" "$base" "$pointer_sha"
test "$(safe_digest "$old_current")" = "$old_sha"
test "$(stat -c '%d:%i' "$old_current")" = "$lock_inode"
printf 'v17_publication|verified\nsource_strategy|O_TMPFILE+linkat-AT_EMPTY_PATH\nexternal_review_anchor|required\npassive_before_execute|required\nlate_pending_rebind|required\npending_resume_base_fsync|required\nsame_inode|true\nold_handoff_immutable|true\n'
```

Expected: the externally anchored review package is authenticated before approval interpretation. The 22-key approval, 26-key commit, 13-key history, 8-key publication, 19-key trust policy, and actual lock inode agree. Execution packages remain passive; only trusted review copies execute. Initial and resumed publication retain the authenticated anonymous-inode same-inode no-replace state machine, while real subprocess fault/race simulations prove deterministic recovery and B-pending/B-current behavior.

## Superseded v13 Task 10 (historical reference only; do not execute)

The first sealed v13 candidate is retained at `/opt/thoidai-reconciliation/phase0-20260814T135943Z/review-runbook-v13-20260816T112722Z-9aedd8c2e29a`, manifest SHA-256 `6b2e44c2efa8a22edb6971b6b91a5973c61da0716257c9f527faf36382b08578`. It is non-authoritative: although all passive gates and adversarial simulations passed, `TRUST-GATE.py` emitted one status line after live recovery returned. v14 moves and flushes all status before trusted helpers and returns the live recovery invocation directly. No v13 approval or fixed pointer may be created.

## Superseded v12 Task 10 (historical reference only; do not execute)

The complete v12 transaction is retained byte-for-byte in sealed review package `/opt/thoidai-reconciliation/phase0-20260814T135943Z/review-runbook-v12-20260816T103022Z-46caafaf1b9d`. It is non-authoritative because its consumers can derive trust too early, it does not externally cross-bind the actual lock inode through every authority record, and its simulations do not execute all adversarial crash/race paths as real subprocesses. No v12 approval or fixed pointer may be created.

## Superseded v11 Task 10 (historical reference only; do not execute)

The complete v11 pathname-candidate transaction is retained byte-for-byte in sealed review package `/opt/thoidai-reconciliation/phase0-20260814T135943Z/review-runbook-v11-20260816T095034Z-330da4d51a11`. It is not executable because candidate-path replacement, late-pending rebinding, pending-only durability, and passive-consumer trust defects are corrected only by v12. No v11 approval or fixed pointer may be created.

## Superseded v10 Task 10 (historical reference only; do not execute)

The v10 exchange/rollback block below is retained only as historical evidence of the superseded architecture. It must not execute, create v10 authority, or be mixed with v12.

- [ ] **Run the one-lock byte-clean package, publication, rollback, and postverification transaction**

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077
repo=/opt/thoidai-work
base=/opt/thoidai-reconciliation
review_root=$base/phase0-20260814T135943Z
approval=$base/phase0-v10-reentry-review.approved.tsv
v5_approval=$base/phase0-v5-primary-review.approved.tsv
current=$base/HANDOFF.current
old_package=$base/phase0-execution-handoff-20260815T041006Z-2be71271104d
task5_pending=$base/phase0-v5-execution.pending
recovery=$base/phase0-v5-execution-20260815T041430Z-7fa3f327f5c8
pending=$base/phase0-v10-execution-handoff.pending
lock_path=$base/phase0-v10-handoff.lock
plan_rel=docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md
design_rel=docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md
timeout_bin=/usr/bin/timeout
finalized=false
rollback_armed=false
pending_cleanup_armed=false
candidate_cleanup_armed=false
history=
package=
candidate_pointer=
candidate_inode=
candidate_sha=
pending_tmp=
pending_inode=
pending_sha=
new_tmp=
exchanged=
rollback_source=
new_pointer_sha=
stage=bootstrap

fsync_path(){
 python3 - "$1" <<'PY'
import os,sys
fd=os.open(sys.argv[1],os.O_RDONLY)
try: os.fsync(fd)
finally: os.close(fd)
PY
}
fsync_dir(){
 python3 - "$1" <<'PY'
import os,sys
fd=os.open(sys.argv[1],os.O_RDONLY|os.O_DIRECTORY)
try: os.fsync(fd)
finally: os.close(fd)
PY
}
rename_noreplace(){
 python3 - "$1" "$2" <<'PY'
import ctypes,errno,os,sys
src,dst=map(os.fsencode,sys.argv[1:3])
libc=ctypes.CDLL(None,use_errno=True);fn=getattr(libc,'renameat2',None)
if fn is None: raise SystemExit(74)
fn.argtypes=(ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint)
if fn(-100,src,-100,dst,1)!=0:
 e=ctypes.get_errno()
 if e==errno.EEXIST: raise SystemExit(73)
 if e in (errno.ENOSYS,errno.EINVAL,errno.ENOTSUP): raise SystemExit(74)
 raise OSError(e,os.strerror(e))
PY
}
rename_exchange(){
 python3 - "$1" "$2" <<'PY'
import ctypes,errno,os,sys
a,b=map(os.fsencode,sys.argv[1:3])
libc=ctypes.CDLL(None,use_errno=True);fn=getattr(libc,'renameat2',None)
if fn is None: raise SystemExit(74)
fn.argtypes=(ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint)
if fn(-100,a,-100,b,2)!=0:
 e=ctypes.get_errno()
 if e in (errno.ENOSYS,errno.EINVAL,errno.ENOTSUP): raise SystemExit(74)
 raise OSError(e,os.strerror(e))
PY
}
assert_text_bytes(){
 local f cr nul last
 for f in "$@";do
  test -f "$f" && test ! -L "$f" || return 41
  cr=$(LC_ALL=C tr -cd '\r'<"$f"|wc -c) || return 41
  nul=$(LC_ALL=C tr -cd '\000'<"$f"|wc -c) || return 41
  test "$cr" -eq 0 && test "$nul" -eq 0 || return 41
  last=$(tail -c 1 -- "$f"|od -An -t x1|tr -d ' \n') || return 41
  test "$last" = 0a || return 41
 done
}
record_event(){
 local event=$1 detail=$2
 if test -n "$history" && test -d "$history";then
  printf 'event|%s|%s\n' "$event" "$detail" >> "$history/ROLLBACK.tsv" || return 41
  chmod 0600 "$history/ROLLBACK.tsv" || return 41
  fsync_path "$history/ROLLBACK.tsv" || return 41
  fsync_dir "$history" || return 41
 fi
}
exact_unlink(){
 local path=$1 expected_inode=$2 expected_sha=$3
 test -f "$path" && test ! -L "$path" || return 41
 test "$(stat -c '%d:%i' "$path")" = "$expected_inode" || return 41
 test "$(sha256sum "$path"|awk '{print $1}')" = "$expected_sha" || return 41
 unlink "$path" || return 41
 fsync_dir "$(dirname -- "$path")" || return 41
}
locate_rollback_source(){
 if test -n "$rollback_source"&&test -f "$rollback_source"&&test ! -L "$rollback_source";then
  printf '%s\n' "$rollback_source"
 elif test -n "$new_tmp"&&test -f "$new_tmp"&&test ! -L "$new_tmp";then
  printf '%s\n' "$new_tmp"
 elif test -n "$exchanged"&&test -f "$exchanged"&&test ! -L "$exchanged";then
  printf '%s\n' "$exchanged"
 else
  return 41
 fi
}
rollback_current(){
 local src target_inode target_sha current_sha retained
 test "$rollback_armed" = true || return 0
 if ! test -f "$current" || test -L "$current";then record_event rollback_failed current_not_regular || true;return 41;fi
 current_sha=$(sha256sum "$current"|awk '{print $1}') || { record_event rollback_failed current_hash_error || true;return 41;}
 if test "$current_sha" != "$new_pointer_sha";then
  record_event rollback_not_needed current_no_longer_new || true
  rollback_armed=false
  return 0
 fi
 src=$(locate_rollback_source) || { record_event rollback_failed source_missing || true;return 41;}
 test "$(stat -c '%U|%G|%a' "$src")" = 'root|root|600' || { record_event rollback_failed source_metadata || true;return 41;}
 test "$(awk 'END{print NR+0}' "$src")" -eq 1 || { record_event rollback_failed source_lines || true;return 41;}
 target_inode=$(stat -c '%d:%i' "$src") || { record_event rollback_failed source_inode || true;return 41;}
 target_sha=$(sha256sum "$src"|awk '{print $1}') || { record_event rollback_failed source_hash || true;return 41;}
 test "$target_sha" = a7e4ef17ee3eaa00bacc6693772940b5308390fcbd9ef4c2275ec9b788c01005 || { record_event rollback_failed source_content || true;return 41;}
 test -f "$history/PREVIOUS-HANDOFF.current" && test ! -L "$history/PREVIOUS-HANDOFF.current" || { record_event rollback_failed prepared_copy_missing || true;return 41;}
 cmp -s "$src" "$history/PREVIOUS-HANDOFF.current" || { record_event rollback_failed source_copy_mismatch || true;return 41;}
 record_event rollback_target "$target_sha" || true
 rename_exchange "$current" "$src" || { record_event rollback_failed exchange_error || true;return 41;}
 test "$(stat -c '%d:%i' "$current")" = "$target_inode" || { record_event rollback_failed restored_inode || true;return 41;}
 test "$(sha256sum "$current"|awk '{print $1}')" = "$target_sha" || { record_event rollback_failed restored_hash || true;return 41;}
 retained=$history/ROLLED-BACK-NEW.current
 if test "$src" != "$retained";then rename_noreplace "$src" "$retained" || { record_event rollback_failed retain_new || true;return 41;};fi
 test -f "$retained" && test ! -L "$retained" || return 41
 chmod 0600 "$retained" || return 41
 cp -- "$current" "$history/ROLLBACK-RESTORED.current" || return 41
 chmod 0600 "$history/ROLLBACK-RESTORED.current" || return 41
 printf 'restored_current_sha256|%s\nfailed_new_pointer_sha256|%s\nfailure_stage|%s\n' "$target_sha" "$new_pointer_sha" "$stage" > "$history/ROLLBACK-RESULT.tsv" || return 41
 chmod 0600 "$history/ROLLBACK-RESULT.tsv" || return 41
 assert_text_bytes "$history/ROLLBACK-RESTORED.current" "$history/ROLLED-BACK-NEW.current" "$history/ROLLBACK-RESULT.tsv" || return 41
 fsync_path "$current" || return 41
 fsync_path "$history/ROLLBACK-RESTORED.current" || return 41
 fsync_path "$history/ROLLED-BACK-NEW.current" || return 41
 fsync_path "$history/ROLLBACK-RESULT.tsv" || return 41
 fsync_dir "$history" || return 41
 fsync_dir "$base" || return 41
 record_event rollback_complete "$target_sha" || return 41
 rollback_armed=false
}
cleanup_candidate(){
 if test "$candidate_cleanup_armed" = true;then
  if exact_unlink "$candidate_pointer" "$candidate_inode" "$candidate_sha";then record_event candidate_cleanup removed;else record_event candidate_cleanup identity_mismatch;return 41;fi
  candidate_cleanup_armed=false
 fi
}
cleanup_pending(){
 local path=
 if test "$pending_cleanup_armed" = true;then
  if test -f "$pending" && ! test -L "$pending" && test "$(stat -c '%d:%i' "$pending")" = "$pending_inode" && test "$(sha256sum "$pending"|awk '{print $1}')" = "$pending_sha";then
   path=$pending
  elif test -n "$pending_tmp" && test -f "$pending_tmp" && ! test -L "$pending_tmp" && test "$(stat -c '%d:%i' "$pending_tmp")" = "$pending_inode" && test "$(sha256sum "$pending_tmp"|awk '{print $1}')" = "$pending_sha";then
   path=$pending_tmp
  else
   record_event pending_cleanup identity_mismatch || true
   return 41
  fi
  unlink "$path" || return 41
  fsync_dir "$base" || return 41
  record_event pending_cleanup removed_exact || return 41
  pending_cleanup_armed=false
 fi
}
on_exit(){
 local rc=$? rollback_rc=0 pending_rc=0 candidate_rc=0
 trap - EXIT INT TERM HUP
 set +e
 if test "$finalized" != true;then
  test "$rc" -ne 0||rc=41
  record_event failure_stage "$stage"
  rollback_current||rollback_rc=$?
  cleanup_pending||pending_rc=$?
  cleanup_candidate||candidate_rc=$?
  record_event exit_status "$rc:$rollback_rc:$pending_rc:$candidate_rc"
 fi
 exit "$rc"
}
trap on_exit EXIT
trap 'exit 130' INT TERM HUP

test "$(id -u)" -eq 0
test -x "$timeout_bin"&&test "$(command -v timeout)" = "$timeout_bin"
test "$(command -v flock)" = /usr/bin/flock
"$timeout_bin" --foreground 2s true
python3 - "$lock_path" <<'PY'
import errno,os,sys
p=sys.argv[1]
try:
 fd=os.open(p,os.O_CREAT|os.O_EXCL|os.O_RDWR|os.O_NOFOLLOW,0o600)
 os.fchmod(fd,0o600);os.fsync(fd);os.close(fd)
except FileExistsError:
 pass
PY
test -f "$lock_path"&&test ! -L "$lock_path"
test "$(stat -c '%U|%G|%a' "$lock_path")" = 'root|root|600'
exec 9<>"$lock_path"
/usr/bin/flock -x 9
test "$(stat -Lc '%d:%i' /proc/self/fd/9)" = "$(stat -Lc '%d:%i' "$lock_path")"
lock_inode=$(stat -c '%d:%i' "$lock_path")
stage=lock_acquired

byte_tmp=$(mktemp "$base/.phase0-v10-byte-negative.XXXXXX")
byte_inode=$(stat -c '%d:%i' "$byte_tmp")
for byte_case in cr nul no_lf;do
 case "$byte_case" in cr) printf 'bad\r\n' > "$byte_tmp";;nul) printf 'bad\000\n' > "$byte_tmp";;no_lf) printf 'bad' > "$byte_tmp";;esac
 byte_sha=$(sha256sum "$byte_tmp"|awk '{print $1}')
 set +e
 assert_text_bytes "$byte_tmp"
 byte_rc=$?
 set -e
 test "$byte_rc" -ne 0
 test "$(stat -c '%d:%i' "$byte_tmp")" = "$byte_inode"
done
byte_sha=$(sha256sum "$byte_tmp"|awk '{print $1}')
exact_unlink "$byte_tmp" "$byte_inode" "$byte_sha"
stage=byte_negative_passed

for f in "$approval" "$v5_approval" "$current" "$task5_pending";do
 test -f "$f"&&test ! -L "$f"&&test "$(stat -c '%U|%G|%a' "$f")" = 'root|root|600'
done
assert_text_bytes "$approval" "$v5_approval" "$current" "$task5_pending"
test "$(sha256sum "$v5_approval"|awk '{print $1}')" = f89cd838975607400b34aea15c3db8e079ed950837da1774e7b7078acc7025aa
test "$(sha256sum "$current"|awk '{print $1}')" = a7e4ef17ee3eaa00bacc6693772940b5308390fcbd9ef4c2275ec9b788c01005
test "$(tr -d '\n'<"$current")" = "$old_package"
test "$(sha256sum "$old_package/SHA256SUMS"|awk '{print $1}')" = 30d3fc6fd40f736441fe3ec3f089ff5bf5c4e3b3525613094ab245e70011b04a
(cd "$old_package"&&sha256sum -c SHA256SUMS>/dev/null)
test "$(sha256sum "$task5_pending"|awk '{print $1}')" = d6c20209be2254dc9cb2788c6ad495ecb372516dd905b2c8e4cd7a76b5779af9
test "$(tr -d '\n'<"$task5_pending")" = "$recovery"
test -d "$recovery"&&test ! -L "$recovery"&&test "$(realpath -e -- "$recovery")" = "$recovery"&&test "$(stat -c '%U|%G|%a' "$recovery")" = 'root|root|700'

review_keys='verdict scope critical_open important_open task5_reentry_authorized authorized_predecessor review_package review_manifest_sha256 old_handoff_package old_handoff_pointer_sha256 old_handoff_manifest_sha256 v5_approval_sha256 task5_pending_path task5_pending_sha256 recovery_path failure_state_sha256 unrelated_status_count unrelated_status_sha256'
awk -F '|' -v keys="$review_keys" 'BEGIN{split(keys,a," ");for(i in a)e[a[i]]=1}NF!=2||!($1 in e)||seen[$1]++{bad=1}END{if(NR!=18)bad=1;for(k in e)if(seen[k]!=1)bad=1;exit bad?41:0}' "$approval"
rv(){ awk -F '|' -v k="$1" '$1==k{print $2}' "$approval";}
test "$(rv verdict)|$(rv scope)|$(rv critical_open)|$(rv important_open)|$(rv task5_reentry_authorized)" = 'APPROVED|phase0-v10-task5-reentry-correction|0|0|true'
test "$(rv authorized_predecessor)" = 464d17a652cdd622b5c20891e8f7fe24b55e6dd6
test "$(rv old_handoff_package)" = "$old_package"
test "$(rv old_handoff_pointer_sha256)" = a7e4ef17ee3eaa00bacc6693772940b5308390fcbd9ef4c2275ec9b788c01005
test "$(rv old_handoff_manifest_sha256)" = 30d3fc6fd40f736441fe3ec3f089ff5bf5c4e3b3525613094ab245e70011b04a
test "$(rv v5_approval_sha256)" = f89cd838975607400b34aea15c3db8e079ed950837da1774e7b7078acc7025aa
test "$(rv task5_pending_path)" = "$task5_pending"
test "$(rv task5_pending_sha256)" = d6c20209be2254dc9cb2788c6ad495ecb372516dd905b2c8e4cd7a76b5779af9
test "$(rv recovery_path)" = "$recovery"
test "$(rv failure_state_sha256)" = 130455a0a92ca76d0372410d4ad60d67d7e8866985f64b5be2cf11a175617faa
test "$(rv unrelated_status_count)|$(rv unrelated_status_sha256)" = '358|20115c9e9358e5883274a642b1e6c302d8c8bb78edd030f1400a52517b69793a'
review_package=$(rv review_package)
review_name=$(basename -- "$review_package")
test "$(dirname -- "$review_package")" = "$review_root"
[[ "$review_name" =~ ^review-runbook-v10-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]]
test "$review_package" = "$review_root/$review_name"
test -d "$review_package"&&test ! -L "$review_package"&&test "$(realpath -e -- "$review_package")" = "$review_package"&&test "$(stat -c '%U|%G|%a' "$review_package")" = 'root|root|700'
printf 'FAILURE-STATE.tsv\nRECOVERY-VERIFY.sh\nREVIEW-NOTES.md\nSHA256SUMS\nVALIDATION.tsv\nVERIFY.sh\ndesign.candidate.md\nrunbook.candidate.md\n'|cmp -s - <(find "$review_package" -mindepth 1 -maxdepth 1 -printf '%f\n'|LC_ALL=C sort)
for f in FAILURE-STATE.tsv RECOVERY-VERIFY.sh REVIEW-NOTES.md SHA256SUMS VALIDATION.tsv VERIFY.sh design.candidate.md runbook.candidate.md;do test -f "$review_package/$f"&&test ! -L "$review_package/$f"&&test "$(stat -c '%U|%G|%a' "$review_package/$f")" = 'root|root|600';done
assert_text_bytes "$review_package"/FAILURE-STATE.tsv "$review_package"/RECOVERY-VERIFY.sh "$review_package"/REVIEW-NOTES.md "$review_package"/SHA256SUMS "$review_package"/VALIDATION.tsv "$review_package"/VERIFY.sh "$review_package"/design.candidate.md "$review_package"/runbook.candidate.md
test "$(sha256sum "$review_package/SHA256SUMS"|awk '{print $1}')" = "$(rv review_manifest_sha256)"
test "$(awk 'END{print NR+0}' "$review_package/SHA256SUMS")" -eq 7
printf 'runbook.candidate.md\ndesign.candidate.md\nREVIEW-NOTES.md\nVALIDATION.tsv\nFAILURE-STATE.tsv\nRECOVERY-VERIFY.sh\nVERIFY.sh\n'|cmp -s - <(awk '{print $2}' "$review_package/SHA256SUMS")
(cd "$review_package"&&sha256sum -c SHA256SUMS>/dev/null)
test "$(sha256sum "$review_package/FAILURE-STATE.tsv"|awk '{print $1}')" = "$(rv failure_state_sha256)"
stage=review_authenticated

cd "$repo"
git diff --cached --quiet
test "$(git rev-list --parents -n 1 HEAD|awk '{print NF}')" -eq 2
test "$(git rev-parse HEAD^)" = "$(rv authorized_predecessor)"
printf '%s\n%s\n' "$design_rel" "$plan_rel"|LC_ALL=C sort|cmp -s - <(git diff-tree --no-commit-id --name-only -r HEAD|LC_ALL=C sort)
test "$(git diff-tree --no-commit-id --name-only -r HEAD|wc -l)" -eq 2
git diff --quiet -- "$plan_rel" "$design_rel"
git show "HEAD:$plan_rel"|cmp -s - "$review_package/runbook.candidate.md"
git show "HEAD:$design_rel"|cmp -s - "$review_package/design.candidate.md"
read -r unrelated_count unrelated_sha < <(git status --short --untracked-files=all -- . ":(exclude)$plan_rel" ":(exclude)$design_rel"|python3 -c 'import hashlib,sys;d=sys.stdin.buffer.read();print(d.count(b"\n"),hashlib.sha256(d).hexdigest())')
test "$unrelated_count|$unrelated_sha" = "$(rv unrelated_status_count)|$(rv unrelated_status_sha256)"
stage=commit_authenticated

stamp=$(date -u +%Y%m%dT%H%M%SZ)
nonce=$(od -An -N6 -tx1 /dev/urandom|tr -d ' \n')
package=$base/phase0-v10-execution-handoff-$stamp-$nonce
mkdir -m 0700 "$package"
test ! -L "$package"&&test "$(stat -c '%U|%G|%a' "$package")" = 'root|root|700'
git show "HEAD:$plan_rel" > "$package/plan.md"
git show "HEAD:$design_rel" > "$package/design.md"
cp -- "$v5_approval" "$package/REVIEW-V5.tsv"
cp -- "$approval" "$package/REVIEW-V10.tsv"
cp -- "$current" "$package/PREVIOUS-HANDOFF.current"
cp -- "$task5_pending" "$package/TASK5.pending"
cp -- "$review_package/FAILURE-STATE.tsv" "$package/FAILURE-STATE.tsv"
cp -- "$review_package/RECOVERY-VERIFY.sh" "$package/RECOVERY-VERIFY.sh"
cp -- "$review_package/VERIFY.sh" "$package/VERIFY.sh"
printf 'old_handoff_path|%s\nold_handoff_package|%s\nold_handoff_pointer_sha256|%s\ntask5_pending_path|%s\ntask5_pending_sha256|%s\nfailure_state_sha256|%s\n' "$current" "$(rv old_handoff_package)" "$(rv old_handoff_pointer_sha256)" "$(rv task5_pending_path)" "$(rv task5_pending_sha256)" "$(rv failure_state_sha256)" > "$package/HISTORY.tsv"
printf 'head|%s\ntree|%s\nparent|%s\nparent_count|1\nplan_blob|%s\ndesign_blob|%s\nreview_package|%s\nreview_manifest_sha256|%s\nv10_approval_sha256|%s\nv5_approval_sha256|%s\nold_handoff_package|%s\nold_handoff_pointer_sha256|%s\nold_handoff_manifest_sha256|%s\ntask5_pending_path|%s\ntask5_pending_sha256|%s\nrecovery_path|%s\nfailure_state_sha256|%s\nunrelated_status_count|%s\nunrelated_status_sha256|%s\nprevious_handoff_copy_sha256|%s\ntask5_pending_copy_sha256|%s\n' "$(git rev-parse HEAD)" "$(git rev-parse HEAD^{tree})" "$(git rev-parse HEAD^)" "$(git rev-parse "HEAD:$plan_rel")" "$(git rev-parse "HEAD:$design_rel")" "$review_package" "$(rv review_manifest_sha256)" "$(sha256sum "$approval"|awk '{print $1}')" "$(rv v5_approval_sha256)" "$(rv old_handoff_package)" "$(rv old_handoff_pointer_sha256)" "$(rv old_handoff_manifest_sha256)" "$(rv task5_pending_path)" "$(rv task5_pending_sha256)" "$(rv recovery_path)" "$(rv failure_state_sha256)" "$(rv unrelated_status_count)" "$(rv unrelated_status_sha256)" "$(sha256sum "$package/PREVIOUS-HANDOFF.current"|awk '{print $1}')" "$(sha256sum "$package/TASK5.pending"|awk '{print $1}')" > "$package/COMMIT.tsv"
chmod 0600 "$package"/*
commit_keys='head tree parent parent_count plan_blob design_blob review_package review_manifest_sha256 v10_approval_sha256 v5_approval_sha256 old_handoff_package old_handoff_pointer_sha256 old_handoff_manifest_sha256 task5_pending_path task5_pending_sha256 recovery_path failure_state_sha256 unrelated_status_count unrelated_status_sha256 previous_handoff_copy_sha256 task5_pending_copy_sha256'
history_keys='old_handoff_path old_handoff_package old_handoff_pointer_sha256 task5_pending_path task5_pending_sha256 failure_state_sha256'
for spec in REVIEW-V10.tsv:18:"$review_keys" COMMIT.tsv:21:"$commit_keys" HISTORY.tsv:6:"$history_keys";do IFS=: read -r file count keys<<<"$spec";awk -F '|' -v keys="$keys" -v count="$count" 'BEGIN{split(keys,a," ");for(i in a)e[a[i]]=1}NF!=2||!($1 in e)||seen[$1]++{bad=1}END{if(NR!=count)bad=1;for(k in e)if(seen[k]!=1)bad=1;exit bad?41:0}' "$package/$file";done
assert_text_bytes "$package"/plan.md "$package"/design.md "$package"/COMMIT.tsv "$package"/REVIEW-V5.tsv "$package"/REVIEW-V10.tsv "$package"/FAILURE-STATE.tsv "$package"/HISTORY.tsv "$package"/PREVIOUS-HANDOFF.current "$package"/TASK5.pending "$package"/VERIFY.sh "$package"/RECOVERY-VERIFY.sh
(cd "$package"&&sha256sum plan.md design.md COMMIT.tsv REVIEW-V5.tsv REVIEW-V10.tsv FAILURE-STATE.tsv HISTORY.tsv PREVIOUS-HANDOFF.current TASK5.pending VERIFY.sh RECOVERY-VERIFY.sh > SHA256SUMS)
chmod 0600 "$package/SHA256SUMS"
printf 'COMMIT.tsv\nFAILURE-STATE.tsv\nHISTORY.tsv\nPREVIOUS-HANDOFF.current\nRECOVERY-VERIFY.sh\nREVIEW-V10.tsv\nREVIEW-V5.tsv\nSHA256SUMS\nTASK5.pending\nVERIFY.sh\ndesign.md\nplan.md\n'|cmp -s - <(find "$package" -mindepth 1 -maxdepth 1 -printf '%f\n'|LC_ALL=C sort)
for f in "$package"/*;do test -f "$f"&&test ! -L "$f"&&test "$(stat -c '%U|%G|%a' "$f")" = 'root|root|600';done
assert_text_bytes "$package"/*
(cd "$package"&&sha256sum -c SHA256SUMS>/dev/null)
for f in "$package"/*;do fsync_path "$f";done
fsync_dir "$package"
fsync_dir "$base"
stage=package_sealed

candidate_pointer=$(mktemp "$base/.phase0-v10-candidate-pointer.XXXXXX")
printf '%s\n' "$package" > "$candidate_pointer"
chmod 0600 "$candidate_pointer"
fsync_path "$candidate_pointer"
candidate_inode=$(stat -c '%d:%i' "$candidate_pointer")
candidate_sha=$(sha256sum "$candidate_pointer"|awk '{print $1}')
candidate_cleanup_armed=true
bash "$package/VERIFY.sh" "$candidate_pointer" pre
set +e
"$timeout_bin" --foreground 30s bash "$package/RECOVERY-VERIFY.sh" "$task5_pending" >/dev/null
rc=$?
set -e
case "$rc" in 0);;124)exit 42;;*)exit 41;;esac
assert_text_bytes "$package"/*
cleanup_candidate
stage=helper_prepublication_passed

history=$base/phase0-v10-handoff-history-$stamp-$nonce
mkdir -m 0700 "$history"
test ! -L "$history"&&test "$(stat -c '%U|%G|%a' "$history")" = 'root|root|700'
cp -- "$package/PREVIOUS-HANDOFF.current" "$history/PREVIOUS-HANDOFF.current"
cp -- "$package/TASK5.pending" "$history/TASK5.pending"
cp -- "$package/HISTORY.tsv" "$history/HISTORY.tsv"
printf 'lock_path|%s\nlock_inode|%s\nlock_mode|root:root:600\nlock_held|true\n' "$lock_path" "$lock_inode" > "$history/LOCK.tsv"
printf 'event|rollback_armed|false\nevent|authoritative_exchange|not_started\n' > "$history/ROLLBACK.tsv"
chmod 0600 "$history"/*
assert_text_bytes "$history"/PREVIOUS-HANDOFF.current "$history"/TASK5.pending "$history"/HISTORY.tsv "$history"/LOCK.tsv "$history"/ROLLBACK.tsv
(cd "$history"&&sha256sum PREVIOUS-HANDOFF.current TASK5.pending HISTORY.tsv LOCK.tsv > PREPUBLISH-SHA256SUMS)
chmod 0600 "$history/PREPUBLISH-SHA256SUMS"
assert_text_bytes "$history/PREPUBLISH-SHA256SUMS"
(cd "$history"&&sha256sum -c PREPUBLISH-SHA256SUMS>/dev/null)
for f in "$history"/*;do fsync_path "$f";done
fsync_dir "$history"
fsync_dir "$base"
stage=history_prepared

pending_tmp=$(mktemp "$base/.phase0-v10-execution-handoff.pending.XXXXXX")
printf '%s\n' "$package" > "$pending_tmp"
chmod 0600 "$pending_tmp"
fsync_path "$pending_tmp"
pending_inode=$(stat -c '%d:%i' "$pending_tmp")
pending_sha=$(sha256sum "$pending_tmp"|awk '{print $1}')
pending_cleanup_armed=true
rename_noreplace "$pending_tmp" "$pending"
test -f "$pending"&&test ! -L "$pending"&&test "$(stat -c '%U|%G|%a|%d:%i' "$pending")" = "root|root|600|$pending_inode"
test "$(sha256sum "$pending"|awk '{print $1}')" = "$pending_sha"
fsync_dir "$base"
stage=pending_published
record_event pending_published "$pending_inode"

bash "$package/VERIFY.sh" "$pending" pre
set +e
"$timeout_bin" --foreground 30s bash "$package/RECOVERY-VERIFY.sh" "$task5_pending" >/dev/null
rc=$?
set -e
case "$rc" in 0);;124)exit 42;;*)exit 41;;esac
assert_text_bytes "$package"/* "$history"/*
stage=pending_reverified
record_event pending_reverified pass

new_tmp=$(mktemp "$base/.HANDOFF.current.v10.XXXXXX")
printf '%s\n' "$package" > "$new_tmp"
chmod 0600 "$new_tmp"
fsync_path "$new_tmp"
new_pointer_sha=$(sha256sum "$new_tmp"|awk '{print $1}')
rollback_source=$new_tmp
exchanged=$history/HANDOFF.current.exchanged
stage=exchange_preflight

test -f "$current"&&test ! -L "$current"&&test "$(stat -c '%U|%G|%a' "$current")" = 'root|root|600'&&test "$(awk 'END{print NR+0}' "$current")" -eq 1
test "$(sha256sum "$current"|awk '{print $1}')" = "$(rv old_handoff_pointer_sha256)"
cmp -s "$current" "$package/PREVIOUS-HANDOFF.current"
rollback_armed=true
rename_exchange "$new_tmp" "$current"
stage=exchanged
record_event authoritative_exchange completed

test "$(sha256sum "$current"|awk '{print $1}')" = "$new_pointer_sha"
test "$(tr -d '\n'<"$current")" = "$package"
test -f "$rollback_source"&&test ! -L "$rollback_source"&&test "$(stat -c '%U|%G|%a' "$rollback_source")" = 'root|root|600'
cmp -s "$rollback_source" "$package/PREVIOUS-HANDOFF.current"
stage=exchanged_old_verified
record_event exchanged_old verified

rename_noreplace "$rollback_source" "$exchanged"
rollback_source=$exchanged
chmod 0600 "$exchanged"
fsync_path "$exchanged"
fsync_dir "$history"
stage=exchanged_old_historized
record_event exchanged_old historized

printf 'new_handoff_path|%s\nnew_package|%s\nexchanged_prior_sha256|%s\nexpected_old_match|true\ntask5_pending_sha256|%s\nlock_inode|%s\n' "$current" "$package" "$(sha256sum "$exchanged"|awk '{print $1}')" "$(sha256sum "$task5_pending"|awk '{print $1}')" "$lock_inode" > "$history/POSTPUBLISH.tsv"
chmod 0600 "$history/POSTPUBLISH.tsv"
assert_text_bytes "$history/POSTPUBLISH.tsv"
fsync_path "$history/POSTPUBLISH.tsv"
stage=postpublish_written
record_event postpublish written

test -f "$current"&&test ! -L "$current"&&test "$(stat -c '%U|%G|%a' "$current")" = 'root|root|600'
test "$(sha256sum "$current"|awk '{print $1}')" = "$new_pointer_sha"
test "$(tr -d '\n'<"$current")" = "$package"
cmp -s "$task5_pending" "$package/TASK5.pending"
stage=current_postchecked
record_event current_postchecked pass

bash "$package/VERIFY.sh" "$current" post
stage=verify_post_passed
record_event verify_post pass
set +e
"$timeout_bin" --foreground 30s bash "$package/RECOVERY-VERIFY.sh" "$task5_pending" >/dev/null
rc=$?
set -e
case "$rc" in 0);;124)exit 42;;*)exit 41;;esac
stage=recovery_post_passed
record_event recovery_post pass

record_event rollback_disarm_ready all_post_gates_passed
assert_text_bytes "$package"/* "$history"/*
(cd "$history"&&sha256sum PREVIOUS-HANDOFF.current TASK5.pending HISTORY.tsv LOCK.tsv PREPUBLISH-SHA256SUMS HANDOFF.current.exchanged POSTPUBLISH.tsv ROLLBACK.tsv > SHA256SUMS)
chmod 0600 "$history/SHA256SUMS"
printf 'HANDOFF.current.exchanged\nHISTORY.tsv\nLOCK.tsv\nPOSTPUBLISH.tsv\nPREPUBLISH-SHA256SUMS\nPREVIOUS-HANDOFF.current\nROLLBACK.tsv\nSHA256SUMS\nTASK5.pending\n'|cmp -s - <(find "$history" -mindepth 1 -maxdepth 1 -printf '%f\n'|LC_ALL=C sort)
for f in "$history"/*;do test -f "$f"&&test ! -L "$f"&&test "$(stat -c '%U|%G|%a' "$f")" = 'root|root|600';done
assert_text_bytes "$history"/*
(cd "$history"&&sha256sum -c PREPUBLISH-SHA256SUMS>/dev/null&&sha256sum -c SHA256SUMS>/dev/null)
for f in "$history"/*;do fsync_path "$f";done
fsync_dir "$history"
fsync_path "$current"
fsync_path "$pending"
fsync_dir "$base"
stage=history_finalized

bash "$package/VERIFY.sh" "$current" post
set +e
"$timeout_bin" --foreground 30s bash "$package/RECOVERY-VERIFY.sh" "$task5_pending" >/dev/null
rc=$?
set -e
case "$rc" in 0);;124)exit 42;;*)exit 41;;esac
(cd "$package"&&sha256sum -c SHA256SUMS>/dev/null)
(cd "$history"&&sha256sum -c SHA256SUMS>/dev/null)
assert_text_bytes "$package"/* "$history"/*
test "$(sha256sum "$current"|awk '{print $1}')" = "$new_pointer_sha"
test "$(sha256sum "$pending"|awk '{print $1}')" = "$pending_sha"
stage=final_success
rollback_armed=false
pending_cleanup_armed=false
finalized=true
trap - EXIT INT TERM HUP
printf 'handoff_publication|verified\nrollback_armed|false\nlock_held_through_final_gate|true\n'
```

Expected: one fixed root-only exclusive lock spans preverification through the final postverification and fsync gate. Every v10 text payload is CR/NUL-free and final-LF-terminated; the built-in negative cases prove malformed bytes are rejected. A private candidate pointer passes both helpers before the sticky no-replace pending pointer is published. Prepared history and an armed rollback source exist before the atomic exchange. Every normal post-exchange failure restores A and retains failed C as sanitized history; a non-cooperating A-to-B race leaves B authoritative and never leaves C authoritative. Cleanup removes only an exact recorded pending/candidate inode and content hash. Task-5 pending authority and runtime remain read-only.

## Superseded v9 Task 10 (historical reference only; do not execute)

The three v9 blocks below are preserved only as historical evidence of the superseded publication design. They are not execution instructions, may not create v9 authority, and may not be mixed with the active v12 block above.

- [ ] **Step 1: Validate the exact 18-key approval, old authority, recovery boundary, review package, and corrected commit**

```bash
set -euo pipefail
umask 077
repo=/opt/thoidai-work
base=/opt/thoidai-reconciliation
review_root=$base/phase0-20260814T135943Z
approval=$base/phase0-v9-reentry-review.approved.tsv
v5_approval=$base/phase0-v5-primary-review.approved.tsv
old_pointer=$base/HANDOFF.current
old_package=$base/phase0-execution-handoff-20260815T041006Z-2be71271104d
task5_pending=$base/phase0-v5-execution.pending
recovery=$base/phase0-v5-execution-20260815T041430Z-7fa3f327f5c8
plan_rel=docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md
design_rel=docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md
timeout_bin=/usr/bin/timeout
test "$(id -u)" -eq 0
test -x "$timeout_bin" && test "$(command -v timeout)" = "$timeout_bin"
"$timeout_bin" --foreground 2s true
python3 - <<'PY'
import ctypes
if getattr(ctypes.CDLL(None,use_errno=True),'renameat2',None) is None: raise SystemExit(74)
PY
for f in "$approval" "$v5_approval" "$old_pointer" "$task5_pending"; do
  test -f "$f" && test ! -L "$f"
  test "$(stat -c '%U|%G|%a' "$f")" = 'root|root|600'
done
test "$(sha256sum "$v5_approval" | awk '{print $1}')" = f89cd838975607400b34aea15c3db8e079ed950837da1774e7b7078acc7025aa
test "$(sha256sum "$old_pointer" | awk '{print $1}')" = a7e4ef17ee3eaa00bacc6693772940b5308390fcbd9ef4c2275ec9b788c01005
test "$(tr -d '\n' < "$old_pointer")" = "$old_package"
test "$(sha256sum "$old_package/SHA256SUMS" | awk '{print $1}')" = 30d3fc6fd40f736441fe3ec3f089ff5bf5c4e3b3525613094ab245e70011b04a
(cd "$old_package" && sha256sum -c SHA256SUMS >/dev/null)
test "$(sha256sum "$task5_pending" | awk '{print $1}')" = d6c20209be2254dc9cb2788c6ad495ecb372516dd905b2c8e4cd7a76b5779af9
test "$(tr -d '\n' < "$task5_pending")" = "$recovery"
test -d "$recovery" && test ! -L "$recovery"
test "$(realpath -e -- "$recovery")" = "$recovery"
test "$(stat -c '%U|%G|%a' "$recovery")" = 'root|root|700'
review_keys='verdict scope critical_open important_open task5_reentry_authorized authorized_predecessor review_package review_manifest_sha256 old_handoff_package old_handoff_pointer_sha256 old_handoff_manifest_sha256 v5_approval_sha256 task5_pending_path task5_pending_sha256 recovery_path failure_state_sha256 unrelated_status_count unrelated_status_sha256'
awk -F '|' -v keys="$review_keys" 'BEGIN{split(keys,a," ");for(i in a)e[a[i]]=1} NF!=2||!($1 in e)||seen[$1]++{bad=1} END{if(NR!=18)bad=1;for(k in e)if(seen[k]!=1)bad=1;exit bad?41:0}' "$approval"
rv(){ awk -F '|' -v k="$1" '$1==k{print $2}' "$approval"; }
test "$(rv verdict)|$(rv scope)|$(rv critical_open)|$(rv important_open)|$(rv task5_reentry_authorized)" = 'APPROVED|phase0-v9-task5-reentry-correction|0|0|true'
test "$(rv authorized_predecessor)" = 464d17a652cdd622b5c20891e8f7fe24b55e6dd6
test "$(rv old_handoff_package)" = "$old_package"
test "$(rv old_handoff_pointer_sha256)" = a7e4ef17ee3eaa00bacc6693772940b5308390fcbd9ef4c2275ec9b788c01005
test "$(rv old_handoff_manifest_sha256)" = 30d3fc6fd40f736441fe3ec3f089ff5bf5c4e3b3525613094ab245e70011b04a
test "$(rv v5_approval_sha256)" = f89cd838975607400b34aea15c3db8e079ed950837da1774e7b7078acc7025aa
test "$(rv task5_pending_path)" = "$task5_pending"
test "$(rv task5_pending_sha256)" = d6c20209be2254dc9cb2788c6ad495ecb372516dd905b2c8e4cd7a76b5779af9
test "$(rv recovery_path)" = "$recovery"
test "$(rv failure_state_sha256)" = 130455a0a92ca76d0372410d4ad60d67d7e8866985f64b5be2cf11a175617faa
test "$(rv unrelated_status_count)|$(rv unrelated_status_sha256)" = '358|20115c9e9358e5883274a642b1e6c302d8c8bb78edd030f1400a52517b69793a'
review_package=$(rv review_package)
review_manifest_sha=$(rv review_manifest_sha256)
[[ "$review_manifest_sha" =~ ^[0-9a-f]{64}$ ]]
review_basename=$(basename -- "$review_package")
test "$(dirname -- "$review_package")" = "$review_root"
[[ "$review_basename" =~ ^review-runbook-v9-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]]
test "$review_package" = "$review_root/$review_basename"
test -d "$review_package" && test ! -L "$review_package"
test "$(realpath -e -- "$review_package")" = "$review_package"
test "$(stat -c '%U|%G|%a' "$review_package")" = 'root|root|700'
printf 'FAILURE-STATE.tsv\nRECOVERY-VERIFY.sh\nREVIEW-NOTES.md\nSHA256SUMS\nVALIDATION.tsv\nVERIFY.sh\ndesign.candidate.md\nrunbook.candidate.md\n' | cmp -s - <(find "$review_package" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
for f in FAILURE-STATE.tsv RECOVERY-VERIFY.sh REVIEW-NOTES.md SHA256SUMS VALIDATION.tsv VERIFY.sh design.candidate.md runbook.candidate.md; do
  test -f "$review_package/$f" && test ! -L "$review_package/$f"
  test "$(stat -c '%U|%G|%a' "$review_package/$f")" = 'root|root|600'
done
test "$(sha256sum "$review_package/SHA256SUMS" | awk '{print $1}')" = "$review_manifest_sha"
test "$(awk 'END{print NR+0}' "$review_package/SHA256SUMS")" -eq 7
awk 'NF!=2 || $1 !~ /^[0-9a-f]{64}$/ {exit 41}' "$review_package/SHA256SUMS"
printf 'runbook.candidate.md\ndesign.candidate.md\nREVIEW-NOTES.md\nVALIDATION.tsv\nFAILURE-STATE.tsv\nRECOVERY-VERIFY.sh\nVERIFY.sh\n' | cmp -s - <(awk '{print $2}' "$review_package/SHA256SUMS")
(cd "$review_package" && sha256sum -c SHA256SUMS >/dev/null)
test "$(sha256sum "$review_package/FAILURE-STATE.tsv" | awk '{print $1}')" = "$(rv failure_state_sha256)"
set +e
"$timeout_bin" --foreground 30s bash "$review_package/RECOVERY-VERIFY.sh" "$task5_pending" >/dev/null
recovery_rc=$?
set -e
case "$recovery_rc" in 0) ;; 124) exit 42 ;; *) exit 41 ;; esac
cd "$repo"
git diff --cached --quiet
test "$(git rev-list --parents -n 1 HEAD | awk '{print NF}')" -eq 2
test "$(git rev-parse HEAD^)" = "$(rv authorized_predecessor)"
printf '%s\n%s\n' "$design_rel" "$plan_rel" | LC_ALL=C sort | cmp -s - <(git diff-tree --no-commit-id --name-only -r HEAD | LC_ALL=C sort)
test "$(git diff-tree --no-commit-id --name-only -r HEAD | wc -l)" -eq 2
git diff --quiet -- "$plan_rel" "$design_rel"
git show "HEAD:$plan_rel" | cmp -s - "$review_package/runbook.candidate.md"
git show "HEAD:$design_rel" | cmp -s - "$review_package/design.candidate.md"
read -r unrelated_count unrelated_sha < <(git status --short --untracked-files=all -- . ":(exclude)$plan_rel" ":(exclude)$design_rel" | python3 -c 'import hashlib,sys;d=sys.stdin.buffer.read();print(d.count(b"\n"),hashlib.sha256(d).hexdigest())')
test "$unrelated_count|$unrelated_sha" = "$(rv unrelated_status_count)|$(rv unrelated_status_sha256)"
```

Expected: the exact additive approval, old sealed authority, live pending/recovery boundary, reviewed failure state/verifier, corrected two-document child commit, canonical bytes, and unrelated state form one tuple. Any duplicate, conflict, extra key, replaced path, timeout, advanced lane, or byte mismatch stops before package creation.

- [ ] **Step 2: Construct, fsync, seal, validate, and no-replace publish the corrected pending package**

```bash
set -euo pipefail
umask 077
repo=/opt/thoidai-work
base=/opt/thoidai-reconciliation
approval=$base/phase0-v9-reentry-review.approved.tsv
v5_approval=$base/phase0-v5-primary-review.approved.tsv
old_pointer=$base/HANDOFF.current
task5_pending=$base/phase0-v5-execution.pending
plan_rel=docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md
design_rel=docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md
timeout_bin=/usr/bin/timeout
rv(){ awk -F '|' -v k="$1" '$1==k{print $2}' "$approval"; }
review_package=$(rv review_package)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
nonce=$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')
package=$base/phase0-v9-execution-handoff-$stamp-$nonce
mkdir -m 0700 "$package"
test ! -L "$package" && test "$(stat -c '%U|%G|%a' "$package")" = 'root|root|700'
cd "$repo"
git show "HEAD:$plan_rel" > "$package/plan.md"
git show "HEAD:$design_rel" > "$package/design.md"
cp -- "$v5_approval" "$package/REVIEW-V5.tsv"
cp -- "$approval" "$package/REVIEW-V9.tsv"
cp -- "$old_pointer" "$package/PREVIOUS-HANDOFF.current"
cp -- "$task5_pending" "$package/TASK5.pending"
cp -- "$review_package/FAILURE-STATE.tsv" "$package/FAILURE-STATE.tsv"
cp -- "$review_package/RECOVERY-VERIFY.sh" "$package/RECOVERY-VERIFY.sh"
cp -- "$review_package/VERIFY.sh" "$package/VERIFY.sh"
cat > "$package/HISTORY.tsv" <<EOF
old_handoff_path|$old_pointer
old_handoff_package|$(rv old_handoff_package)
old_handoff_pointer_sha256|$(rv old_handoff_pointer_sha256)
task5_pending_path|$(rv task5_pending_path)
task5_pending_sha256|$(rv task5_pending_sha256)
failure_state_sha256|$(rv failure_state_sha256)
EOF
cat > "$package/COMMIT.tsv" <<EOF
head|$(git rev-parse HEAD)
tree|$(git rev-parse HEAD^{tree})
parent|$(git rev-parse HEAD^)
parent_count|1
plan_blob|$(git rev-parse "HEAD:$plan_rel")
design_blob|$(git rev-parse "HEAD:$design_rel")
review_package|$(rv review_package)
review_manifest_sha256|$(rv review_manifest_sha256)
v9_approval_sha256|$(sha256sum "$approval" | awk '{print $1}')
v5_approval_sha256|$(rv v5_approval_sha256)
old_handoff_package|$(rv old_handoff_package)
old_handoff_pointer_sha256|$(rv old_handoff_pointer_sha256)
old_handoff_manifest_sha256|$(rv old_handoff_manifest_sha256)
task5_pending_path|$(rv task5_pending_path)
task5_pending_sha256|$(rv task5_pending_sha256)
recovery_path|$(rv recovery_path)
failure_state_sha256|$(rv failure_state_sha256)
unrelated_status_count|$(rv unrelated_status_count)
unrelated_status_sha256|$(rv unrelated_status_sha256)
previous_handoff_copy_sha256|$(sha256sum "$package/PREVIOUS-HANDOFF.current" | awk '{print $1}')
task5_pending_copy_sha256|$(sha256sum "$package/TASK5.pending" | awk '{print $1}')
EOF
chmod 0600 "$package"/*
review_keys='verdict scope critical_open important_open task5_reentry_authorized authorized_predecessor review_package review_manifest_sha256 old_handoff_package old_handoff_pointer_sha256 old_handoff_manifest_sha256 v5_approval_sha256 task5_pending_path task5_pending_sha256 recovery_path failure_state_sha256 unrelated_status_count unrelated_status_sha256'
commit_keys='head tree parent parent_count plan_blob design_blob review_package review_manifest_sha256 v9_approval_sha256 v5_approval_sha256 old_handoff_package old_handoff_pointer_sha256 old_handoff_manifest_sha256 task5_pending_path task5_pending_sha256 recovery_path failure_state_sha256 unrelated_status_count unrelated_status_sha256 previous_handoff_copy_sha256 task5_pending_copy_sha256'
history_keys='old_handoff_path old_handoff_package old_handoff_pointer_sha256 task5_pending_path task5_pending_sha256 failure_state_sha256'
awk -F '|' -v keys="$review_keys" 'BEGIN{split(keys,a," ");for(i in a)e[a[i]]=1} NF!=2||!($1 in e)||seen[$1]++{bad=1} END{if(NR!=18)bad=1;for(k in e)if(seen[k]!=1)bad=1;exit bad?41:0}' "$package/REVIEW-V9.tsv"
awk -F '|' -v keys="$commit_keys" 'BEGIN{split(keys,a," ");for(i in a)e[a[i]]=1} NF!=2||!($1 in e)||seen[$1]++{bad=1} END{if(NR!=21)bad=1;for(k in e)if(seen[k]!=1)bad=1;exit bad?41:0}' "$package/COMMIT.tsv"
awk -F '|' -v keys="$history_keys" 'BEGIN{split(keys,a," ");for(i in a)e[a[i]]=1} NF!=2||!($1 in e)||seen[$1]++{bad=1} END{if(NR!=6)bad=1;for(k in e)if(seen[k]!=1)bad=1;exit bad?41:0}' "$package/HISTORY.tsv"
(cd "$package" && sha256sum plan.md design.md COMMIT.tsv REVIEW-V5.tsv REVIEW-V9.tsv FAILURE-STATE.tsv HISTORY.tsv PREVIOUS-HANDOFF.current TASK5.pending VERIFY.sh RECOVERY-VERIFY.sh > SHA256SUMS)
chmod 0600 "$package/SHA256SUMS"
printf 'COMMIT.tsv\nFAILURE-STATE.tsv\nHISTORY.tsv\nPREVIOUS-HANDOFF.current\nRECOVERY-VERIFY.sh\nREVIEW-V5.tsv\nREVIEW-V9.tsv\nSHA256SUMS\nTASK5.pending\nVERIFY.sh\ndesign.md\nplan.md\n' | cmp -s - <(find "$package" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
for f in "$package"/*; do test -f "$f" && test ! -L "$f" && test "$(stat -c '%U|%G|%a' "$f")" = 'root|root|600'; done
(cd "$package" && sha256sum -c SHA256SUMS >/dev/null)
python3 - "$package" <<'PY'
import os,sys
p=sys.argv[1]
for name in os.listdir(p):
 fd=os.open(os.path.join(p,name),os.O_RDONLY)
 try: os.fsync(fd)
 finally: os.close(fd)
fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY)
try: os.fsync(fd)
finally: os.close(fd)
PY
pending=$base/phase0-v9-execution-handoff.pending
pending_tmp=$(mktemp "$base/.phase0-v9-execution-handoff.pending.XXXXXX")
printf '%s\n' "$package" > "$pending_tmp"
chmod 0600 "$pending_tmp"
python3 - "$pending_tmp" <<'PY'
import os,sys
fd=os.open(sys.argv[1],os.O_RDONLY)
try: os.fsync(fd)
finally: os.close(fd)
PY
python3 - "$pending_tmp" "$pending" <<'PY'
import ctypes,errno,os,sys
src,dst=map(os.fsencode,sys.argv[1:3]);libc=ctypes.CDLL(None,use_errno=True);fn=getattr(libc,'renameat2',None)
if fn is None: raise SystemExit(74)
fn.argtypes=(ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint)
if fn(-100,src,-100,dst,1)!=0:
 e=ctypes.get_errno()
 if e==errno.EEXIST: raise SystemExit(73)
 if e in (errno.ENOSYS,errno.EINVAL,errno.ENOTSUP): raise SystemExit(74)
 raise OSError(e,os.strerror(e))
fd=os.open(os.path.dirname(os.fsdecode(dst)),os.O_RDONLY|os.O_DIRECTORY)
try: os.fsync(fd)
finally: os.close(fd)
PY
bash "$package/VERIFY.sh" "$pending" pre
set +e
"$timeout_bin" --foreground 30s bash "$package/RECOVERY-VERIFY.sh" "$task5_pending" >/dev/null
rc=$?
set -e
case "$rc" in 0) ;; 124) exit 42 ;; *) exit 41 ;; esac
```

Expected: the reviewed complete `VERIFY.sh` and `RECOVERY-VERIFY.sh`, exact schemas, commit, old authority, pending lane, and history metadata are sealed in one fsynced package. The corrected pending pointer uses `RENAME_NOREPLACE`; EEXIST or unsupported kernels hard-fail without clobbering another publisher.

- [ ] **Step 3: Seal recoverable history, atomically exchange `HANDOFF.current`, and postverify**

```bash
set -euo pipefail
umask 077
base=/opt/thoidai-reconciliation
pending=$base/phase0-v9-execution-handoff.pending
task5_pending=$base/phase0-v5-execution.pending
current=$base/HANDOFF.current
timeout_bin=/usr/bin/timeout
test -f "$pending" && test ! -L "$pending"
IFS= read -r package < "$pending"
bash "$package/VERIFY.sh" "$pending" pre
set +e
"$timeout_bin" --foreground 30s bash "$package/RECOVERY-VERIFY.sh" "$task5_pending" >/dev/null
rc=$?
set -e
case "$rc" in 0) ;; 124) exit 42 ;; *) exit 41 ;; esac
stamp=$(date -u +%Y%m%dT%H%M%SZ)
nonce=$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')
history=$base/phase0-v9-handoff-history-$stamp-$nonce
mkdir -m 0700 "$history"
cp -- "$package/PREVIOUS-HANDOFF.current" "$history/PREVIOUS-HANDOFF.current"
cp -- "$package/TASK5.pending" "$history/TASK5.pending"
cp -- "$package/HISTORY.tsv" "$history/HISTORY.tsv"
chmod 0600 "$history"/*
(cd "$history" && sha256sum PREVIOUS-HANDOFF.current TASK5.pending HISTORY.tsv > PREPUBLISH-SHA256SUMS)
chmod 0600 "$history/PREPUBLISH-SHA256SUMS"
(cd "$history" && sha256sum -c PREPUBLISH-SHA256SUMS >/dev/null)
python3 - "$history" <<'PY'
import os,sys
p=sys.argv[1]
for name in os.listdir(p):
 fd=os.open(os.path.join(p,name),os.O_RDONLY)
 try: os.fsync(fd)
 finally: os.close(fd)
fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY)
try: os.fsync(fd)
finally: os.close(fd)
PY
bash "$package/VERIFY.sh" "$pending" pre
set +e
"$timeout_bin" --foreground 30s bash "$package/RECOVERY-VERIFY.sh" "$task5_pending" >/dev/null
rc=$?
set -e
case "$rc" in 0) ;; 124) exit 42 ;; *) exit 41 ;; esac
new_tmp=$(mktemp "$base/.HANDOFF.current.v9.XXXXXX")
printf '%s\n' "$package" > "$new_tmp"
chmod 0600 "$new_tmp"
python3 - "$new_tmp" <<'PY'
import os,sys
fd=os.open(sys.argv[1],os.O_RDONLY)
try: os.fsync(fd)
finally: os.close(fd)
PY
python3 - "$new_tmp" "$current" <<'PY'
import ctypes,errno,os,sys
a,b=map(os.fsencode,sys.argv[1:3]);libc=ctypes.CDLL(None,use_errno=True);fn=getattr(libc,'renameat2',None)
if fn is None: raise SystemExit(74)
fn.argtypes=(ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint)
if fn(-100,a,-100,b,2)!=0:
 e=ctypes.get_errno()
 if e in (errno.ENOSYS,errno.EINVAL,errno.ENOTSUP): raise SystemExit(74)
 raise OSError(e,os.strerror(e))
fd=os.open(os.path.dirname(os.fsdecode(b)),os.O_RDONLY|os.O_DIRECTORY)
try: os.fsync(fd)
finally: os.close(fd)
PY
cmp -s "$new_tmp" "$package/PREVIOUS-HANDOFF.current"
exchanged=$history/HANDOFF.current.exchanged
python3 - "$new_tmp" "$exchanged" <<'PY'
import ctypes,errno,os,sys
src,dst=map(os.fsencode,sys.argv[1:3]);libc=ctypes.CDLL(None,use_errno=True);fn=getattr(libc,'renameat2',None)
if fn is None: raise SystemExit(74)
fn.argtypes=(ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint)
if fn(-100,src,-100,dst,1)!=0:
 e=ctypes.get_errno()
 if e==errno.EEXIST: raise SystemExit(73)
 if e in (errno.ENOSYS,errno.EINVAL,errno.ENOTSUP): raise SystemExit(74)
 raise OSError(e,os.strerror(e))
fd=os.open(os.path.dirname(os.fsdecode(dst)),os.O_RDONLY|os.O_DIRECTORY)
try: os.fsync(fd)
finally: os.close(fd)
PY
printf 'new_handoff_path|%s\nnew_package|%s\nold_handoff_sha256|%s\ntask5_pending_sha256|%s\n' "$current" "$package" "$(sha256sum "$exchanged" | awk '{print $1}')" "$(sha256sum "$task5_pending" | awk '{print $1}')" > "$history/POSTPUBLISH.tsv"
chmod 0600 "$history/POSTPUBLISH.tsv"
(cd "$history" && sha256sum PREVIOUS-HANDOFF.current TASK5.pending HISTORY.tsv PREPUBLISH-SHA256SUMS HANDOFF.current.exchanged POSTPUBLISH.tsv > SHA256SUMS)
chmod 0600 "$history/SHA256SUMS"
printf 'HANDOFF.current.exchanged\nHISTORY.tsv\nPOSTPUBLISH.tsv\nPREPUBLISH-SHA256SUMS\nPREVIOUS-HANDOFF.current\nSHA256SUMS\nTASK5.pending\n' | cmp -s - <(find "$history" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
for f in "$history"/*; do test -f "$f" && test ! -L "$f" && test "$(stat -c '%U|%G|%a' "$f")" = 'root|root|600'; done
(cd "$history" && sha256sum -c PREPUBLISH-SHA256SUMS >/dev/null && sha256sum -c SHA256SUMS >/dev/null)
python3 - "$history" <<'PY'
import os,sys
p=sys.argv[1]
for name in os.listdir(p):
 fd=os.open(os.path.join(p,name),os.O_RDONLY)
 try: os.fsync(fd)
 finally: os.close(fd)
fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY)
try: os.fsync(fd)
finally: os.close(fd)
PY
test -f "$current" && test ! -L "$current"
test "$(stat -c '%U|%G|%a' "$current")" = 'root|root|600'
test "$(tr -d '\n' < "$current")" = "$package"
cmp -s "$task5_pending" "$package/TASK5.pending"
bash "$package/VERIFY.sh" "$current" post
set +e
"$timeout_bin" --foreground 30s bash "$package/RECOVERY-VERIFY.sh" "$task5_pending" >/dev/null
rc=$?
set -e
case "$rc" in 0) ;; 124) exit 42 ;; *) exit 41 ;; esac
```

Expected: the sealed package and standalone prepublication history make the old pointer recoverable before publication. `RENAME_EXCHANGE` atomically swaps `HANDOFF.current` with no missing-pointer window; `RENAME_NOREPLACE` moves the exchanged old pointer into history. The corrected pending pointer is never overwritten and the live Task-5 pending pointer is never moved or replaced. Final history, current pointer, package, recovery boundary, commit, review, and unrelated state all reverify.

## Superseded v5 Task 10 (historical reference only; do not execute)

> **Ordering:** This documentation lifecycle task is completed after primary approval and the exact plan/design commit, but before any Task-5 runtime command. It publishes execution authority. At the current candidate-review boundary it remains unexecuted, and `HANDOFF.current` remains unchanged.

**Files:**
- Verify: exact committed canonical plan/design, empty index, clean canonical paths, exact primary approval, exact unrelated fingerprint
- Create outside Git: one root-only execution package containing the single reusable full gate
- Atomically update only `/opt/thoidai-reconciliation/HANDOFF.current` after that same gate passes immediately before publication
- No runtime, production, service, container, volume, database, source, or history mutation

- [ ] **Step 1: Require the exact v5 approval schema and committed candidate**

The approval is a root-owned regular mode-0600 file with exactly ten two-field records. Duplicate, conflicting, malformed, or extra records fail. The documentation commit is separately authorized; this task provides no staging or commit command.

```text
set -euo pipefail
repo=/opt/thoidai-work
plan_rel=docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md
design_rel=docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md
approval=/opt/thoidai-reconciliation/phase0-v5-primary-review.approved.tsv
test -f "$approval"; test ! -L "$approval"; test "$(stat -c '%U|%G|%a' "$approval")" = 'root|root|600'
awk -F '|' 'BEGIN{split("verdict scope critical_open important_open task5_execution_authorized authorized_predecessor review_package review_manifest_sha256 unrelated_status_count unrelated_status_sha256",a," ");for(i in a)expected[a[i]]=1} NF!=2||!($1 in expected)||seen[$1]++{bad=1} END{if(NR!=10)bad=1;for(k in expected)if(seen[k]!=1)bad=1;exit bad?41:0}' "$approval"
test "$(awk -F '|' '$1=="verdict"{print $2}' "$approval")" = APPROVED
test "$(awk -F '|' '$1=="scope"{print $2}' "$approval")" = phase0-v5-plan-and-design
test "$(awk -F '|' '$1=="critical_open"{print $2}' "$approval")" = 0
test "$(awk -F '|' '$1=="important_open"{print $2}' "$approval")" = 0
test "$(awk -F '|' '$1=="task5_execution_authorized"{print $2}' "$approval")" = true
authorized_predecessor=$(awk -F '|' '$1=="authorized_predecessor"{print $2}' "$approval")
review_package=$(awk -F '|' '$1=="review_package"{print $2}' "$approval")
review_manifest_sha=$(awk -F '|' '$1=="review_manifest_sha256"{print $2}' "$approval")
approved_unrelated_count=$(awk -F '|' '$1=="unrelated_status_count"{print $2}' "$approval")
approved_unrelated_sha=$(awk -F '|' '$1=="unrelated_status_sha256"{print $2}' "$approval")
test "$authorized_predecessor" = f707279ad9028d452d871fddb39d4f0f767ca155; test "$approved_unrelated_count" = 358; test "$approved_unrelated_sha" = 20115c9e9358e5883274a642b1e6c302d8c8bb78edd030f1400a52517b69793a
[[ "$review_manifest_sha" =~ ^[0-9a-f]{64}$ ]]
review_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
test -d "$review_root" && test ! -L "$review_root" && test "$(stat -c '%U|%G|%a' "$review_root")" = 'root|root|700' && test "$(realpath -e -- "$review_root")" = "$review_root" || exit 41
review_basename=$(basename -- "$review_package")
[[ "$review_basename" =~ ^review-runbook-v[1-9][0-9]*-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]] || exit 41
test "$(dirname -- "$review_package")" = "$review_root" && test "$review_package" = "$review_root/$review_basename" || exit 41
test -d "$review_package" && test ! -L "$review_package" && test "$(realpath -e -- "$review_package")" = "$review_package" && test "$(stat -c '%U|%G|%a' "$review_package")" = 'root|root|700' || exit 41
test -d "$review_package"; test ! -L "$review_package"; test "$(stat -c '%U|%G|%a' "$review_package")" = 'root|root|700'
printf 'REVIEW-NOTES.md\nSHA256SUMS\nVALIDATION.tsv\ndesign.candidate.md\nrunbook.candidate.md\n' | cmp -s - <(find "$review_package" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
for payload in runbook.candidate.md design.candidate.md REVIEW-NOTES.md VALIDATION.tsv SHA256SUMS; do test -f "$review_package/$payload"; test ! -L "$review_package/$payload"; test "$(stat -c '%U|%G|%a' "$review_package/$payload")" = 'root|root|600'; done
test "$(sha256sum "$review_package/SHA256SUMS" | awk '{print $1}')" = "$review_manifest_sha"; test "$(awk 'END{print NR+0}' "$review_package/SHA256SUMS")" -eq 4
printf 'runbook.candidate.md\ndesign.candidate.md\nREVIEW-NOTES.md\nVALIDATION.tsv\n' | cmp -s - <(awk '{print $2}' "$review_package/SHA256SUMS")
(cd "$review_package" && sha256sum -c SHA256SUMS >/dev/null)
cd "$repo"; test "$(git rev-list --parents -n 1 HEAD | awk '{print NF}')" -eq 2; test "$(git rev-parse HEAD^)" = "$authorized_predecessor"
printf '%s\n%s\n' "$design_rel" "$plan_rel" | LC_ALL=C sort | cmp -s - <(git diff-tree --no-commit-id --name-only -r HEAD | LC_ALL=C sort)
test "$(git diff-tree --no-commit-id --name-only -r HEAD | wc -l)" -eq 2; git diff --cached --quiet; git diff --quiet -- "$plan_rel" "$design_rel"
git show "HEAD:$plan_rel" | cmp -s - "$repo/$plan_rel"; git show "HEAD:$design_rel" | cmp -s - "$repo/$design_rel"; git show "HEAD:$plan_rel" | cmp -s - "$review_package/runbook.candidate.md"; git show "HEAD:$design_rel" | cmp -s - "$review_package/design.candidate.md"
read -r unrelated_count unrelated_sha < <(git status --short --untracked-files=all -- . ':(exclude)docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md' ':(exclude)docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md' | python3 -c 'import hashlib,sys;data=sys.stdin.buffer.read();print(data.count(b"\n"),hashlib.sha256(data).hexdigest())')
test "$unrelated_count" = "$approved_unrelated_count"; test "$unrelated_sha" = "$approved_unrelated_sha"
```

Expected: approval mode and exact schema pass with one APPROVED verdict, v5 scope, zero open Critical/Important findings, true Task-5 authorization, the exact reviewed package/manifest, authorized predecessor, and unrelated fingerprint. HEAD/canonical/index/reviewed bytes form one exact clean two-document commit.

- [ ] **Step 2: Snapshot approval, bind immutable constants, build the package, and seal the reusable full gate**

The external approval is copied once into the new root-only package. Every constant is then rebound from that exact snapshot, cross-recorded in `COMMIT.tsv`, and sealed by the five-payload manifest. Later validation never trusts a newly replaced external approval.

```text
set -euo pipefail
umask 077
repo=/opt/thoidai-work
plan_rel=docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md
design_rel=docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md
approval=/opt/thoidai-reconciliation/phase0-v5-primary-review.approved.tsv
stamp=$(date -u +%Y%m%dT%H%M%SZ); nonce=$(openssl rand -hex 6); handoff_package="/opt/thoidai-reconciliation/phase0-execution-handoff-$stamp-$nonce"; install -d -m 0700 "$handoff_package"
cp -- "$approval" "$handoff_package/REVIEW.tsv"; chmod 0600 "$handoff_package/REVIEW.tsv"; test ! -L "$handoff_package/REVIEW.tsv"; test "$(stat -c '%U|%G|%a' "$handoff_package/REVIEW.tsv")" = 'root|root|600'
awk -F '|' 'BEGIN{split("verdict scope critical_open important_open task5_execution_authorized authorized_predecessor review_package review_manifest_sha256 unrelated_status_count unrelated_status_sha256",a," ");for(i in a)expected[a[i]]=1} NF!=2||!($1 in expected)||seen[$1]++{bad=1} END{if(NR!=10)bad=1;for(k in expected)if(seen[k]!=1)bad=1;exit bad?41:0}' "$handoff_package/REVIEW.tsv"
readonly authorized_predecessor=$(awk -F '|' '$1=="authorized_predecessor"{print $2}' "$handoff_package/REVIEW.tsv"); readonly review_package=$(awk -F '|' '$1=="review_package"{print $2}' "$handoff_package/REVIEW.tsv"); readonly review_manifest_sha=$(awk -F '|' '$1=="review_manifest_sha256"{print $2}' "$handoff_package/REVIEW.tsv"); readonly approved_unrelated_count=$(awk -F '|' '$1=="unrelated_status_count"{print $2}' "$handoff_package/REVIEW.tsv"); readonly approved_unrelated_sha=$(awk -F '|' '$1=="unrelated_status_sha256"{print $2}' "$handoff_package/REVIEW.tsv"); readonly approval_sha=$(sha256sum "$handoff_package/REVIEW.tsv" | awk '{print $1}')
test "$(awk -F '|' '$1=="verdict"{print $2}' "$handoff_package/REVIEW.tsv")" = APPROVED; test "$(awk -F '|' '$1=="scope"{print $2}' "$handoff_package/REVIEW.tsv")" = phase0-v5-plan-and-design; test "$(awk -F '|' '$1=="critical_open"{print $2}' "$handoff_package/REVIEW.tsv")" = 0; test "$(awk -F '|' '$1=="important_open"{print $2}' "$handoff_package/REVIEW.tsv")" = 0; test "$(awk -F '|' '$1=="task5_execution_authorized"{print $2}' "$handoff_package/REVIEW.tsv")" = true
test "$authorized_predecessor" = f707279ad9028d452d871fddb39d4f0f767ca155; test "$approved_unrelated_count" = 358; test "$approved_unrelated_sha" = 20115c9e9358e5883274a642b1e6c302d8c8bb78edd030f1400a52517b69793a
cd "$repo"; git diff --cached --quiet; git diff --quiet -- "$plan_rel" "$design_rel"; test "$(git rev-list --parents -n 1 HEAD | awk '{print NF}')" -eq 2; test "$(git rev-parse HEAD^)" = "$authorized_predecessor"; printf '%s\n%s\n' "$design_rel" "$plan_rel" | LC_ALL=C sort | cmp -s - <(git diff-tree --no-commit-id --name-only -r HEAD | LC_ALL=C sort)
git show "HEAD:$plan_rel" > "$handoff_package/plan.md"; git show "HEAD:$design_rel" > "$handoff_package/design.md"
cat > "$handoff_package/VERIFY.sh" <<'BASH'
#!/usr/bin/env bash
set -euo pipefail
pointer=$1; repo=/opt/thoidai-work; plan_rel=docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md; design_rel=docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md
test -f "$pointer"; test ! -L "$pointer"; test "$(stat -c '%U|%G|%a' "$pointer")" = 'root|root|600'; test "$(awk 'END{print NR+0}' "$pointer")" -eq 1
IFS= read -r package < "$pointer"; case "$package" in /opt/thoidai-reconciliation/phase0-execution-handoff-*) ;; *) exit 41 ;; esac
test -d "$package"; test ! -L "$package"; test "$(stat -c '%U|%G|%a' "$package")" = 'root|root|700'
printf 'COMMIT.tsv\nREVIEW.tsv\nSHA256SUMS\nVERIFY.sh\ndesign.md\nplan.md\n' | cmp -s - <(find "$package" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
for payload in plan.md design.md COMMIT.tsv REVIEW.tsv VERIFY.sh SHA256SUMS; do test -f "$package/$payload"; test ! -L "$package/$payload"; test "$(stat -c '%U|%G|%a' "$package/$payload")" = 'root|root|600'; done
test "$(awk 'END{print NR+0}' "$package/SHA256SUMS")" -eq 5; awk 'NF!=2||$1!~/^[0-9a-f]{64}$/{exit 41}' "$package/SHA256SUMS"; printf 'plan.md\ndesign.md\nCOMMIT.tsv\nREVIEW.tsv\nVERIFY.sh\n' | cmp -s - <(awk '{print $2}' "$package/SHA256SUMS"); (cd "$package" && sha256sum -c SHA256SUMS >/dev/null)
awk -F '|' 'BEGIN{split("verdict scope critical_open important_open task5_execution_authorized authorized_predecessor review_package review_manifest_sha256 unrelated_status_count unrelated_status_sha256",a," ");for(i in a)expected[a[i]]=1} NF!=2||!($1 in expected)||seen[$1]++{bad=1} END{if(NR!=10)bad=1;for(k in expected)if(seen[k]!=1)bad=1;exit bad?41:0}' "$package/REVIEW.tsv"
awk -F '|' 'BEGIN{split("head tree parent parent_count plan_blob design_blob review_package review_manifest_sha256 approval_sha256 authorized_predecessor unrelated_status_count unrelated_status_sha256",a," ");for(i in a)expected[a[i]]=1} NF!=2||!($1 in expected)||seen[$1]++{bad=1} END{if(NR!=12)bad=1;for(k in expected)if(seen[k]!=1)bad=1;exit bad?41:0}' "$package/COMMIT.tsv"
rv(){ awk -F '|' -v key="$1" '$1==key{print $2}' "$package/REVIEW.tsv"; }; cv(){ awk -F '|' -v key="$1" '$1==key{print $2}' "$package/COMMIT.tsv"; }
test "$(rv verdict)" = APPROVED; test "$(rv scope)" = phase0-v5-plan-and-design; test "$(rv critical_open)" = 0; test "$(rv important_open)" = 0; test "$(rv task5_execution_authorized)" = true
authorized_predecessor=$(rv authorized_predecessor); review_package=$(rv review_package); review_manifest_sha=$(rv review_manifest_sha256); approved_unrelated_count=$(rv unrelated_status_count); approved_unrelated_sha=$(rv unrelated_status_sha256)
test "$authorized_predecessor" = f707279ad9028d452d871fddb39d4f0f767ca155; test "$approved_unrelated_count" = 358; test "$approved_unrelated_sha" = 20115c9e9358e5883274a642b1e6c302d8c8bb78edd030f1400a52517b69793a; [[ "$review_manifest_sha" =~ ^[0-9a-f]{64}$ ]]
review_root=/opt/thoidai-reconciliation/phase0-20260814T135943Z
test -d "$review_root" && test ! -L "$review_root" && test "$(stat -c '%U|%G|%a' "$review_root")" = 'root|root|700' && test "$(realpath -e -- "$review_root")" = "$review_root" || exit 41
review_basename=$(basename -- "$review_package")
[[ "$review_basename" =~ ^review-runbook-v[1-9][0-9]*-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]] || exit 41
test "$(dirname -- "$review_package")" = "$review_root" && test "$review_package" = "$review_root/$review_basename" || exit 41
test -d "$review_package" && test ! -L "$review_package" && test "$(realpath -e -- "$review_package")" = "$review_package" && test "$(stat -c '%U|%G|%a' "$review_package")" = 'root|root|700' || exit 41
test -d "$review_package"; test ! -L "$review_package"; test "$(stat -c '%U|%G|%a' "$review_package")" = 'root|root|700'; printf 'REVIEW-NOTES.md\nSHA256SUMS\nVALIDATION.tsv\ndesign.candidate.md\nrunbook.candidate.md\n' | cmp -s - <(find "$review_package" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
for payload in runbook.candidate.md design.candidate.md REVIEW-NOTES.md VALIDATION.tsv SHA256SUMS; do test -f "$review_package/$payload"; test ! -L "$review_package/$payload"; test "$(stat -c '%U|%G|%a' "$review_package/$payload")" = 'root|root|600'; done
test "$(sha256sum "$review_package/SHA256SUMS" | awk '{print $1}')" = "$review_manifest_sha"; test "$(awk 'END{print NR+0}' "$review_package/SHA256SUMS")" -eq 4; awk 'NF!=2||$1!~/^[0-9a-f]{64}$/{exit 41}' "$review_package/SHA256SUMS"; printf 'runbook.candidate.md\ndesign.candidate.md\nREVIEW-NOTES.md\nVALIDATION.tsv\n' | cmp -s - <(awk '{print $2}' "$review_package/SHA256SUMS"); (cd "$review_package" && sha256sum -c SHA256SUMS >/dev/null)
package_head=$(cv head); package_tree=$(cv tree); package_parent=$(cv parent); package_parent_count=$(cv parent_count); package_plan_blob=$(cv plan_blob); package_design_blob=$(cv design_blob); package_review=$(cv review_package); package_review_sha=$(cv review_manifest_sha256); package_approval_sha=$(cv approval_sha256); package_predecessor=$(cv authorized_predecessor); package_unrelated_count=$(cv unrelated_status_count); package_unrelated_sha=$(cv unrelated_status_sha256)
test "$package_parent_count" = 1; test "$package_review" = "$review_package"; test "$package_review_sha" = "$review_manifest_sha"; test "$package_predecessor" = "$authorized_predecessor"; test "$package_unrelated_count" = "$approved_unrelated_count"; test "$package_unrelated_sha" = "$approved_unrelated_sha"; test "$package_approval_sha" = "$(sha256sum "$package/REVIEW.tsv" | awk '{print $1}')"
cd "$repo"; git diff --cached --quiet; git diff --quiet -- "$plan_rel" "$design_rel"; test "$(git rev-list --parents -n 1 HEAD | awk '{print NF}')" -eq 2; test "$package_head" = "$(git rev-parse HEAD)"; test "$package_tree" = "$(git rev-parse HEAD^{tree})"; test "$package_parent" = "$(git rev-parse HEAD^)"; test "$package_parent" = "$authorized_predecessor"; test "$package_plan_blob" = "$(git rev-parse "HEAD:$plan_rel")"; test "$package_design_blob" = "$(git rev-parse "HEAD:$design_rel")"
printf '%s\n%s\n' "$design_rel" "$plan_rel" | LC_ALL=C sort | cmp -s - <(git diff-tree --no-commit-id --name-only -r HEAD | LC_ALL=C sort); test "$(git diff-tree --no-commit-id --name-only -r HEAD | wc -l)" -eq 2
cmp -s "$package/plan.md" "$repo/$plan_rel"; cmp -s "$package/design.md" "$repo/$design_rel"; git show "HEAD:$plan_rel" | cmp -s - "$package/plan.md"; git show "HEAD:$design_rel" | cmp -s - "$package/design.md"; git show "HEAD:$plan_rel" | cmp -s - "$review_package/runbook.candidate.md"; git show "HEAD:$design_rel" | cmp -s - "$review_package/design.candidate.md"
read -r current_unrelated_count current_unrelated_sha < <(git status --short --untracked-files=all -- . ':(exclude)docs/superpowers/plans/2026-08-14-thoidai-work-phase-0-migration-history-reconciliation.md' ':(exclude)docs/superpowers/specs/2026-08-14-phase0-isolated-postgres-replay-design.md' | python3 -c 'import hashlib,sys;data=sys.stdin.buffer.read();print(data.count(b"\n"),hashlib.sha256(data).hexdigest())'); test "$current_unrelated_count" = "$approved_unrelated_count"; test "$current_unrelated_sha" = "$approved_unrelated_sha"
BASH
chmod 0600 "$handoff_package/VERIFY.sh"
printf 'head|%s\ntree|%s\nparent|%s\nparent_count|1\nplan_blob|%s\ndesign_blob|%s\nreview_package|%s\nreview_manifest_sha256|%s\napproval_sha256|%s\nauthorized_predecessor|%s\nunrelated_status_count|%s\nunrelated_status_sha256|%s\n' "$(git rev-parse HEAD)" "$(git rev-parse HEAD^{tree})" "$(git rev-parse HEAD^)" "$(git rev-parse "HEAD:$plan_rel")" "$(git rev-parse "HEAD:$design_rel")" "$review_package" "$review_manifest_sha" "$approval_sha" "$authorized_predecessor" "$approved_unrelated_count" "$approved_unrelated_sha" > "$handoff_package/COMMIT.tsv"
chmod 0600 "$handoff_package/plan.md" "$handoff_package/design.md" "$handoff_package/COMMIT.tsv"; (cd "$handoff_package" && sha256sum plan.md design.md COMMIT.tsv REVIEW.tsv VERIFY.sh > SHA256SUMS); chmod 0600 "$handoff_package/SHA256SUMS"
for payload in plan.md design.md COMMIT.tsv REVIEW.tsv VERIFY.sh SHA256SUMS; do test -f "$handoff_package/$payload"; test ! -L "$handoff_package/$payload"; test "$(stat -c '%U|%G|%a' "$handoff_package/$payload")" = 'root|root|600'; done; (cd "$handoff_package" && sha256sum -c SHA256SUMS >/dev/null)
pending_tmp=$(mktemp /opt/thoidai-reconciliation/.phase0-execution-handoff.pending.XXXXXX); printf '%s\n' "$handoff_package" > "$pending_tmp"; chown root:root "$pending_tmp"; chmod 0600 "$pending_tmp"; mv -T "$pending_tmp" /opt/thoidai-reconciliation/phase0-execution-handoff.pending
bash "$handoff_package/VERIFY.sh" /opt/thoidai-reconciliation/phase0-execution-handoff.pending
```

Expected: the package contains committed bytes, the exact approval snapshot, the complete bound COMMIT schema, and the single full validator. Five payloads are manifest-sealed; `SHA256SUMS` excludes itself. The full gate passes against the pending pointer before the package can become publication input.

- [ ] **Step 3: Invoke the same full gate immediately before atomic publication**

No value is rebound from the external approval. The package path is read from the root-only pending pointer, the sealed helper performs the complete validation again, and that same validated path is the only value published.

```text
set -euo pipefail
umask 077
pending_pointer=/opt/thoidai-reconciliation/phase0-execution-handoff.pending
invoke_full_immutable_gate() {
  local pointer=$1 package payload
  test -f "$pointer"; test ! -L "$pointer"; test "$(stat -c '%U|%G|%a' "$pointer")" = 'root|root|600'; test "$(awk 'END{print NR+0}' "$pointer")" -eq 1
  IFS= read -r package < "$pointer"; case "$package" in /opt/thoidai-reconciliation/phase0-execution-handoff-*) ;; *) return 41 ;; esac
  test -d "$package"; test ! -L "$package"; test "$(stat -c '%U|%G|%a' "$package")" = 'root|root|700'
  printf 'COMMIT.tsv\nREVIEW.tsv\nSHA256SUMS\nVERIFY.sh\ndesign.md\nplan.md\n' | cmp -s - <(find "$package" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
  for payload in plan.md design.md COMMIT.tsv REVIEW.tsv VERIFY.sh SHA256SUMS; do test -f "$package/$payload"; test ! -L "$package/$payload"; test "$(stat -c '%U|%G|%a' "$package/$payload")" = 'root|root|600'; done
  test "$(awk 'END{print NR+0}' "$package/SHA256SUMS")" -eq 5; awk 'NF!=2||$1!~/^[0-9a-f]{64}$/{exit 41}' "$package/SHA256SUMS"; printf 'plan.md\ndesign.md\nCOMMIT.tsv\nREVIEW.tsv\nVERIFY.sh\n' | cmp -s - <(awk '{print $2}' "$package/SHA256SUMS")
  (cd "$package" && sha256sum -c SHA256SUMS >/dev/null); bash "$package/VERIFY.sh" "$pointer"; printf '%s\n' "$package"
}
handoff_package=$(invoke_full_immutable_gate "$pending_pointer"); test -n "$handoff_package"; test "$(cat "$pending_pointer")" = "$handoff_package"
pointer_tmp=$(mktemp /opt/thoidai-reconciliation/.HANDOFF.current.XXXXXX); printf '%s\n' "$handoff_package" > "$pointer_tmp"; chown root:root "$pointer_tmp"; chmod 0600 "$pointer_tmp"; test "$(stat -c '%U|%G|%a' "$pointer_tmp")" = 'root|root|600'
mv -T "$pointer_tmp" /opt/thoidai-reconciliation/HANDOFF.current; test ! -L /opt/thoidai-reconciliation/HANDOFF.current; test "$(cat /opt/thoidai-reconciliation/HANDOFF.current)" = "$handoff_package"; bash "$handoff_package/VERIFY.sh" /opt/thoidai-reconciliation/HANDOFF.current
```

Expected: the exact same full package/approval/commit/canonical/unrelated gate runs after packaging and immediately before publication. The validated immutable package path-not any re-read external approval value-is atomically published and then verifies once more through the final pointer.

### Current v5 review stop

For the present documentation turn: do not execute any Task-5 through Task-10 checkbox, do not stage or commit, do not create the primary approval or execution package, and do not update `HANDOFF.current`. Only static/live read-only validation and a separate root-only candidate review package are allowed.

### Current v17 documentation-only stop

For this v17 correction turn: do not execute Task 10, resume Task 5, run Task 6, stage, commit, amend, push, create or replace any approval, create either v17 fixed pointer, modify `HANDOFF.current`, replace the Task-5 pending pointer, or mutate any runtime. Only the two canonical document edits, static/read-only validation, the verified sealed v16 review package, the exact root-only v17 final-fix backup, guarded adversarial simulation, and one separate root-only v17 candidate review package are allowed.
