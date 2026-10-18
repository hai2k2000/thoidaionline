import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const sql = readFileSync(new URL("./cp6-benchmark.sql", import.meta.url), "utf8");
const runner = readFileSync(new URL("./cp6-benchmark-run.sh", import.meta.url), "utf8");
const evidence = readFileSync(new URL("./cp6-benchmark-evidence.mjs", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../../.github/workflows/cp6-phase2-benchmark.yml", import.meta.url), "utf8");
const docs = readFileSync(new URL("../../docs/CP6_PHASE2_BENCHMARK.md", import.meta.url), "utf8");

test("CP6 benchmark fixture is synthetic, bounded and covers required dimensions", () => {
  assert.match(sql, /generate_series\(1, 10000\)/);
  assert.match(sql, /generate_series\(1, 8\)/);
  assert.match(sql, /CP6-BENCH-SENSITIVE-/);
  assert.match(sql, /generate_series\(1, 20\)/);
  assert.match(sql, /generate_series\(1, 10\)/);
  assert.match(sql, /api_search_database_records/);
  assert.match(sql, /pagination\/ACL assertion failed/);
  assert.match(sql, /sensitive deny failed/);
  assert.match(sql, /record\.sensitive\.access/);
  assert.match(sql, /filtered_expected/);
  assert.match(sql, /sensitive positive control failed/);
  assert.match(sql, /pagination\/ACL assertion failed/);
  assert.match(sql, /p95 threshold exceeded/);
  assert.doesNotMatch(sql, /detail_query_count/);
  assert.doesNotMatch(sql, /no application N\+1 loop/);
  assert.match(sql, /search_document @@/);
  assert.match(sql, /to_tsvector\('simple', concat_ws/);
  assert.match(sql, /explain \(analyze, buffers, format json\)/i);
  assert.match(sql, /percentile_cont\(0\.50\)/);
  assert.match(sql, /percentile_cont\(0\.95\)/);
  assert.match(sql, /commit;/);
  assert.doesNotMatch(sql, /production|supabase\.co|https?:\/\//i);
});

test("CP6 benchmark runner has a disk guard and disposable-only contract", () => {
  assert.match(runner, /disk_guard_failed/);
  assert.match(runner, /10 \* 1024 \* 1024/);
  assert.match(runner, /E2E_DB_URL/);
  assert.match(runner, /scripts\/e2e\/cp6-benchmark\.sql/);
  assert.match(runner, /cp6-benchmark-evidence\.mjs/);
  assert.match(runner, /CP6_HTTP_EVIDENCE_LOG/);
  assert.match(evidence, /CP6_HTTP_DETAIL_EVIDENCE measured/);
  assert.match(evidence, /CP6_QUERY_COUNT_EVIDENCE measured/);
  assert.match(evidence, /CP6_SQL_BENCHMARK_COMPLETE/);
  assert.match(evidence, /db_records_search_idx/);
  assert.doesNotMatch(runner, /docker push|deploy|production/i);
});

test("CP6 benchmark workflow is manual-only and read-only", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.match(workflow, /timeout-minutes: 45/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /^\s+(push|pull_request|schedule|workflow_run):/m);
  assert.doesNotMatch(workflow, /^\s*uses:.*(?:deploy|production)/im);
  assert.match(workflow, /retention-days: 3/);
  assert.match(docs, /CP6 Phase 2 Benchmark/);
  assert.match(docs, /p95 <= 250 ms/);
});
