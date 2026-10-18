import { readFileSync } from "node:fs";

const sqlLogPath = process.argv[2];
const httpLogPath = process.argv[3];
if (!sqlLogPath) throw new Error("SQL benchmark log path is required");
if (!httpLogPath) throw new Error("HTTP benchmark log path is required");
const sqlLog = readFileSync(sqlLogPath, "utf8");

for (const marker of [
  "CP6_EXPLAIN_RPC_FUNCTION_BEGIN", "CP6_EXPLAIN_RPC_FUNCTION_END",
  "CP6_EXPLAIN_RPC_INTERNAL_BEGIN", "CP6_EXPLAIN_RPC_INTERNAL_END",
  "CP6_EXPLAIN_SEARCH_INDEX_BEGIN", "CP6_EXPLAIN_SEARCH_INDEX_END",
  "CP6_SQL_BENCHMARK_COMPLETE",
]) {
  if (!sqlLog.includes(marker)) throw new Error(`CP6 benchmark incomplete: missing ${marker}`);
}
if (!sqlLog.includes("db_records_search_idx")) throw new Error("CP6 benchmark missing actual db_records_search_idx plan evidence");

const httpLog = readFileSync(httpLogPath, "utf8");
for (const marker of ["CP6_HTTP_DETAIL_EVIDENCE measured", "CP6_QUERY_COUNT_EVIDENCE measured"]) {
  if (!httpLog.includes(marker)) throw new Error(`CP6 benchmark incomplete: missing ${marker}`);
}

console.log("CP6_BENCHMARK_EVIDENCE_COMPLETE");
