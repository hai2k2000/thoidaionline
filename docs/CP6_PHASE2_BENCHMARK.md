# CP6 Phase 2 Benchmark Readiness

This checkpoint prepares one controlled performance run for Database Management V1. It does not run the benchmark, register the workflow, push GitHub, or change production.

## Dataset

- 10,000 normal synthetic records with deterministic IDs and codes.
- Eight synthetic departments, two synthetic owners, multiple statuses, and searchable keywords.
- Four sensitive record types, each with a distinct search token.
- Explicit ACL coverage on a detail record: 20 ACL rows and 10 private-file metadata rows.
- The SQL fixture commits its disposable rows so a later HTTP/detail harness can measure them; workflow cleanup must remove the disposable runtime.

## Measurements

The SQL harness performs 35 iterations per scenario after the disposable schema/fixture warmup:

- `search`: unfiltered Search RPC, limit 50, offset 0.
- `filtered_search`: keyword plus status filter, limit 50, offset 0.
- `detail_sql`: one record joined to ACL and file metadata (SQL-only evidence).

It emits p50, p95, and average latency for SQL Search RPC, filtered Search RPC, and SQL detail. It also emits separate EXPLAIN plans for the RPC Function Scan, the searchable expression, and the maintained `search_document` index. The fixture checks pagination population/counts, sensitive deny and positive-control access, searchable-token preconditions, and the expected 20 ACL/10 file fixture shape. Application/HTTP detail latency and measured query count/N+1 are separate acceptance gates and must not be reported as PASS by this SQL-only harness. GNU `time -v` captures elapsed time, CPU, and maximum resident memory in the same bounded log.

The runner requires a companion harness to emit `CP6_HTTP_DETAIL_EVIDENCE measured` and `CP6_QUERY_COUNT_EVIDENCE measured`; without both markers it fails closed as incomplete.

## Acceptance thresholds

- Search p95 <= 250 ms.
- Filtered search p95 <= 400 ms.
- SQL detail p95 <= 200 ms (HTTP detail remains a separate gate).
- Unauthorized rows and metadata/count leaks: 0.
- Pagination ACL consistency: PASS.
- Measured application query count/N+1 evidence is required before claiming the HTTP detail gate.

Thresholds are fixed for this run and must not be relaxed to obtain PASS.

## Workflow safety

`.github/workflows/cp6-phase2-benchmark.yml` is manual-only (`workflow_dispatch`), uses `ubuntu-24.04`, has a 45-minute timeout, requires a full 40-character source SHA and verifies the checkout against it, requires a 10 GiB runner disk floor, uses only disposable PostgreSQL/PostgREST, uploads at most three-day diagnostic retention, and always removes the disposable Docker network/containers. The owner must approve the final committed SHA before dispatch.

The workflow does not use production secrets, deploy, create release artifacts, or trigger on push/pull request. It is prepared but not registered or dispatched in this checkpoint.

## Evidence classification

- CP3 Search/RBAC/ACL/sensitive: runtime PASS from prior local/CI evidence; benchmark fixture re-checks sensitive deny and positive control.
- CP4 HTTP CRUD/file/audit flows: runtime PASS from prior local evidence; not rerun here.
- CP5 security/performance/backup foundation: static/contract PASS; benchmark execution was previously NOT RUN.
- CP6 Phase 1 audit, backup/restore, upload boundary, storage escape, and audit recovery: runtime PASS from prior disposable evidence.
- CP6 Phase 2 benchmark: NOT RUN pending owner approval for one GitHub-hosted runner dispatch.

## Required approval before execution

1. Approve registering the workflow on the intended default branch, if registration is required by repository rules.
2. Approve exactly one `workflow_dispatch` run with `source_sha` pinned to the reviewed SHA.
3. Approve retention of the bounded benchmark artifact for up to three days.
