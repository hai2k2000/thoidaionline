# CP6 Phase 2 Benchmark Readiness

This checkpoint prepares one controlled performance run for Database Management V1. It does not run the benchmark, register the workflow, push GitHub, or change production.

## Dataset

- 10,000 normal synthetic records with deterministic IDs and codes.
- Eight synthetic departments, two synthetic owners, multiple statuses, and searchable keywords.
- Four sensitive record types, each with a distinct search token.
- Explicit ACL coverage on a detail record: 20 ACL rows and 10 private-file metadata rows.
- All data is created inside the disposable PostgreSQL transaction and rolled back after measurements.

## Measurements

The SQL harness performs 35 iterations per scenario after the disposable schema/fixture warmup:

- `search`: unfiltered Search RPC, limit 50, offset 0.
- `filtered_search`: keyword plus status filter, limit 50, offset 0.
- `detail`: one record joined to ACL and file metadata.

It emits p50, p95, and average latency, plus `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` for filtered Search RPC. The result also checks pagination overlap, sensitive-record exclusion, the expected 20 ACL/10 file fixture shape, database size, and the single-query detail model. GNU `time -v` captures elapsed time, CPU, and maximum resident memory in the same bounded log.

## Acceptance thresholds

- Search p95 <= 250 ms.
- Filtered search p95 <= 400 ms.
- Detail p95 <= 200 ms.
- Unauthorized rows and metadata/count leaks: 0.
- Pagination ACL consistency: PASS.
- No N+1 behavior in the benchmark query path; query-plan evidence is required before making an index-use claim.

Thresholds are fixed for this run and must not be relaxed to obtain PASS.

## Workflow safety

`.github/workflows/cp6-phase2-benchmark.yml` is manual-only (`workflow_dispatch`), uses `ubuntu-24.04`, has a 45-minute timeout, requires a full 40-character source SHA and verifies the checkout against it, requires a 10 GiB runner disk floor, uses only disposable PostgreSQL/PostgREST, uploads at most three-day diagnostic retention, and always removes the disposable Docker network/containers. The owner must approve the final committed SHA before dispatch.

The workflow does not use production secrets, deploy, create release artifacts, or trigger on push/pull request. It is prepared but not registered or dispatched in this checkpoint.

## Evidence classification

- CP3 Search/RBAC/ACL/sensitive: runtime PASS from prior local/CI evidence; not rerun here.
- CP4 HTTP CRUD/file/audit flows: runtime PASS from prior local evidence; not rerun here.
- CP5 security/performance/backup foundation: static/contract PASS; benchmark execution was previously NOT RUN.
- CP6 Phase 1 audit, backup/restore, upload boundary, storage escape, and audit recovery: runtime PASS from prior disposable evidence.
- CP6 Phase 2 benchmark: NOT RUN pending owner approval for one GitHub-hosted runner dispatch.

## Required approval before execution

1. Approve registering the workflow on the intended default branch, if registration is required by repository rules.
2. Approve exactly one `workflow_dispatch` run with `source_sha` pinned to the reviewed SHA.
3. Approve retention of the bounded benchmark artifact for up to three days.
