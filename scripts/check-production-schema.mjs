import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { validateSchemaSnapshot } from "./schema-contracts.mjs";

const snapshotPath = process.env.THOIDAI_SCHEMA_SNAPSHOT;
let snapshot;
if (snapshotPath) {
  if (!existsSync(snapshotPath)) throw new Error(`schema snapshot missing: ${snapshotPath}`);
  snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
} else {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    console.error("schema contract check requires THOIDAI_SCHEMA_SNAPSHOT or DATABASE_URL/SUPABASE_DB_URL");
    process.exit(2);
  }
  const sql = `select json_build_object(
    'tables', coalesce((select json_agg(table_name) from information_schema.tables where table_schema='public'), '[]'::json),
    'columns', coalesce((select json_object_agg(table_name, cols) from (select table_name, json_agg(column_name) cols from information_schema.columns where table_schema='public' group by table_name) q), '{}'::json),
    'functions', coalesce((select json_agg(routine_name) from information_schema.routines where routine_schema='public'), '[]'::json),
    'taskStatuses', coalesce((select json_agg(distinct status) from public.tasks where status is not null), '[]'::json)
  );`;
  snapshot = JSON.parse(execFileSync("psql", [databaseUrl, "-At", "-c", sql], { encoding: "utf8" }).trim());
}
const result = validateSchemaSnapshot(snapshot);
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log("database-schema-contract: PASS");
