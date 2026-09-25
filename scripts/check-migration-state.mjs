import { execFileSync } from "node:child_process";
import { REQUIRED_MIGRATIONS, validateMigrationState } from "./migration-state.mjs";

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!databaseUrl) {
  console.error("migration state check requires DATABASE_URL/SUPABASE_DB_URL");
  process.exit(2);
}
const rows = execFileSync("psql", [databaseUrl, "-At", "-c", "select version from supabase_migrations.schema_migrations order by version"], { encoding: "utf8" }).trim();
const result = validateMigrationState(rows ? rows.split(/\r?\n/) : []);
if (!result.ok) {
  console.error(`missing migrations: ${result.missing.join(", ")}`);
  process.exit(1);
}
console.log(`migration-state: PASS (${REQUIRED_MIGRATIONS.length} required)`);
