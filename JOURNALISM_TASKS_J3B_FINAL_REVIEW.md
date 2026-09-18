# JOURNALISM TASKS J3B FINAL REVIEW

Date: 2026-09-18 (Asia/Bangkok)

## A. Commit provenance

- `1e4ca1c93de18779a7a8205baafad4a8139cc112` is a direct child of `8841fb3884654eaf61b2d578c654ae1b26ed62ce`.
- The exact range diff contains only `JOURNALISM_TASKS_J3B_REPORT.md` (2 documentation lines).
- `src` tree IDs are identical: `41983d670e44c06db261077aa20e15d4ecb5388b`.
- `supabase` tree IDs are identical: `baadee3cef0e1ecdeaf3e296b15b5d5b96294604`.
- No runtime/application source, migration, or test changed between the two commits.

## B. Authoritative source

- Authoritative pre-alignment J3B commit: `1e4ca1c93de18779a7a8205baafad4a8139cc112`.
- After this contract correction, the authoritative J3B commit is the new fix commit recorded below.
- The application tree remains the implementation tree from `8841fb3`, plus the narrow metadata route/test correction in this review.

## C. Metadata contract finding

- The route accepted client-visible `expectedUpdatedAt` and forwarded it as `p_expected_updated_at`.
- It was optional, could produce the RPC `40001` concurrent-update error, and introduced stale-client optimistic conflict behavior not approved for J3 v1.
- The field was not needed for authorization; the approved database row lock and `updated_at` trigger already serialize metadata updates.

## D. Source correction

- Removed `expectedUpdatedAt` from the external metadata allowlist.
- Removed client parsing/forwarding of that field.
- The server-side RPC call passes `p_expected_updated_at: null` solely for compatibility with the byte-locked migration signature; no client token reaches the database.
- Publication locking and state-transition behavior were not changed.

## E. Final metadata DTO

The only accepted J3 v1 metadata request fields are:

- `workKindId`
- `plannedPublicationAt`
- `location`
- `editorialNotes`

Unknown fields, including `expectedUpdatedAt`, are rejected with `400 invalid_request`.

## F. Metadata concurrency semantics

- Metadata updates remain transactional and lock the Journalism detail row with `FOR UPDATE`.
- J3 v1 does not promise stale-client optimistic conflict detection, version, ETag, or timestamp preconditions.
- Disposable two-connection gate passed: updates serialized, final state was the second committed update, and exactly two real-change audit events were written.
- True no-op produced no metadata audit.

## G. Migration and RBAC invariants

- Migration remains byte-identical.
- SHA-256: `38a60fc0056a4c0479a5062c412fb5c3a065e15dac6aef30f957690a6efd4ad3`.
- Isolated counts: permissions `19`, grants `128`, J3 permissions `2`, J3 grants `12`, missing `0`, extra `0`.
- Sorted grant tuple hash: `0bc039d7110e1b420349589dfb9f822c766ec3886cfa2f04947e0acab4d4233f`.

## H. Mutation and concurrency gates

- Atomic valid create: PASS.
- Inactive work kind rollback: PASS.
- Forced detail failure rollback: PASS.
- Forced Journalism audit failure rollback: PASS.
- Metadata allow/deny, inactive kind, no-op audit, planned-date rules: PASS.
- Publication state machine, URL policy, withdrawal reason, terminal withdrawn state: PASS.
- Publication audit rollback: PASS.
- Publication two-connection race: first commit, incompatible loser conflict: PASS.
- Direct Journalism table ACL and server-only RPC gate: PASS.

## I. Read and regression gates

- Exact J2 PostgREST regression: PASS (`no_filter=4`, `only=3`, `exclude=1`, `work_kind=1`, `publication=1`, `planned=2`, `scoped=2`, pagination/order/count/nested detail PASS).
- Contract/policy/J3B focused tests: PASS.
- Phase 1A / Task RBAC critical suite: `79/79 PASS`.
- ORG/RBAC R2 suite: PASS.
- Module regression suite: `83/83 PASS`.
- TypeScript: PASS.
- Changed-file ESLint: PASS.
- `git diff --check`: PASS.
- Production-safe Webpack build: PASS, exit code `0`, non-secret build values only.

## J. Production and decision

- Production remains unchanged: no deploy, restart, migration apply, grant change, ledger change, or data mutation.
- No production secrets were copied or recorded.
- Final recommendation: **GO for owner review of J3B contract alignment; NO production activation until separate J3C approval.**

## K. Final commit

- New commit: to be recorded after verification and push.
- Required next step: owner review only; do not deploy or start J3C automatically.
