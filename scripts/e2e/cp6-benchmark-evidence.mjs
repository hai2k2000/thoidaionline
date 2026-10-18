import { readFileSync } from "node:fs";

const logPath = process.argv[2];
if (!logPath) throw new Error("benchmark log path is required");
const log = readFileSync(logPath, "utf8");

// The SQL fixture deliberately does not claim application HTTP detail or N+1
// evidence. A future companion harness must emit both measured markers before
// this runner can report a complete benchmark.
for (const marker of ["CP6_HTTP_DETAIL_EVIDENCE measured", "CP6_QUERY_COUNT_EVIDENCE measured"]) {
  if (!log.includes(marker)) throw new Error(`CP6 benchmark incomplete: missing ${marker}`);
}

console.log("CP6_BENCHMARK_EVIDENCE_COMPLETE");
