import { readFileSync, writeFileSync } from "node:fs";

const statePath = process.env.SAFE_MIGRATION_TEST_STATE;
const state = JSON.parse(readFileSync(statePath, "utf8"));
const args = process.argv.slice(2);
const sqlIndex = args.indexOf("-c");
const sql = sqlIndex >= 0 ? args[sqlIndex + 1] : readFileSync(0, "utf8");
state.psqlCalls = (state.psqlCalls || 0) + 1;

const save = () => writeFileSync(statePath, `${JSON.stringify(state)}\n`);
if (state.mutateFileAtCall === state.psqlCalls && state.migrationFile) {
  writeFileSync(state.migrationFile, `${readFileSync(state.migrationFile, "utf8")}\n-- tampered\n`);
}

if (/information_schema\.columns/.test(sql)) {
  process.stdout.write("version|text|text\nstatements|ARRAY|_text\nname|text|text\n");
  save();
  process.exit(0);
}
if (/json_agg\(json_build_object/.test(sql)) {
  process.stdout.write(`${JSON.stringify(state.ledger || [])}\n`);
  save();
  process.exit(0);
}
if (sql.includes("SAFE_POSTCONDITION")) {
  process.stdout.write(state.postcondition === false ? "false\n" : "pass\n");
  save();
  process.exit(0);
}
if (sql.includes("RAISE_SYNTAX_ERROR")) {
  process.stderr.write(`syntax error password=${process.env.PGPASSWORD || ""}\n`);
  save();
  process.exit(3);
}

const ledgerMatch = sql.match(/insert\s+into\s+supabase_migrations\.schema_migrations/i);
if (ledgerMatch) {
  const beforeLedgerInsert = sql.split(/insert\s+into\s+supabase_migrations\.schema_migrations/i, 1)[0];
  if (/create table|raise_syntax_error|alter table|insert into (?!supabase_migrations)/i.test(beforeLedgerInsert)) state.applyCalls = (state.applyCalls || 0) + 1;
  state.registrationCalls = (state.registrationCalls || 0) + 1;
  if (state.registrationFails) {
    process.stderr.write(`ledger insert failed password=${process.env.PGPASSWORD || ""}\n`);
    save();
    process.exit(3);
  }
  state.ledger ||= [];
  const versionMatch = sql.match(/values\s*\(\s*'([0-9]{14})'/i);
  const version = versionMatch?.[1] || "20261007100000";
  const nameMatch = sql.match(/values\s*\(\s*'[0-9]{14}'\s*,\s*'([^']+)'/i);
  const name = nameMatch?.[1] || state.migrationName || "fixture_migration";
  state.ledger.push({ version, name, statements: ["recorded"] });
  if (state.unexpectedLedgerDiff) state.ledger.push({ version: "19990101000000", name: "unexpected", statements: [] });
} else {
  state.applyCalls = (state.applyCalls || 0) + 1;
  state.schemaApplied = true;
}
save();
