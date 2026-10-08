import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  classifyTransactionSafety,
  diffLedgers,
  findVersionConflicts,
  parseMigrationFilename,
  parseSqlStatements,
  sha256File,
  sanitizeDatabaseIdentity,
  unwrapOuterTransaction,
  validateExpectedLedgerDiff,
} from "./safe-apply-migration.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const runner = resolve(here, "safe-apply-migration.mjs");
const fakePsql = resolve(here, "fixtures/fake-psql.mjs");

function fixture(name, { sql = "create table fixture(id integer);\n", state = {}, extraArgs = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), `safe-migration-${name}-`));
  const migrations = join(root, "supabase", "migrations");
  const evidence = join(root, "evidence");
  const file = join(migrations, "20261007100000_fixture_migration.sql");
  const postcondition = join(root, "postcondition.sql");
  const statePath = join(root, "state.json");
  mkdirSync(migrations, { recursive: true });
  writeFileSync(file, sql);
  writeFileSync(postcondition, "select 'SAFE_POSTCONDITION';");
  writeFileSync(statePath, JSON.stringify({ ledger: [], migrationFile: file, migrationName: "fixture_migration", ...state }));
  const env = {
    ...process.env,
    TEST_SECRET: "fixture-secret",
    SAFE_MIGRATION_TEST_STATE: statePath,
    SAFE_MIGRATION_PSQL_BIN: process.execPath,
    SAFE_MIGRATION_PSQL_SCRIPT: fakePsql,
    SAFE_MIGRATION_MIGRATIONS_DIR: migrations,
  };
  const resolvedExtraArgs = extraArgs.map((value) => value === "__POSTCONDITION__" ? postcondition : value === "__HASH__" ? sha256File(file) : value);
  const result = spawnSync(process.execPath, [runner, "--file", file, "--db-url-env", "FIXTURE_DB", "--evidence-dir", evidence, ...resolvedExtraArgs], {
    encoding: "utf8",
    env: { ...env, FIXTURE_DB: "postgresql://fixture:secret@fixture-db:5432/postgres" },
  });
  return { result, state: JSON.parse(readFileSync(statePath, "utf8")), file, evidence, root };
}

test("parses the canonical migration filename", () => {
  assert.deepEqual(parseMigrationFilename("20261007100000_personal_weekly_report_reopen_versions.sql"), {
    version: "20261007100000",
    name: "personal_weekly_report_reopen_versions",
    filename: "20261007100000_personal_weekly_report_reopen_versions.sql",
  });
});

test("rejects malformed migration filenames", () => {
  for (const filename of ["migration.sql", "20261007_short.sql", "20261007100000_Bad-Name.sql", "20261007100000_.sql"]) {
    assert.throws(() => parseMigrationFilename(filename), /YYYYMMDDHHMMSS_name\.sql/);
  }
});

test("detects duplicate repository migration versions before database access", () => {
  const root = mkdtempSync(join(tmpdir(), "safe-migration-"));
  writeFileSync(join(root, "20261007100000_first.sql"), "select 1;\n");
  writeFileSync(join(root, "20261007100000_second.sql"), "select 2;\n");
  assert.deepEqual(findVersionConflicts(root, "20261007100000").map((path) => path.split(/[\\/]/).pop()), [
    "20261007100000_first.sql",
    "20261007100000_second.sql",
  ]);
});

test("classifies plain SQL as transaction-safe", () => {
  assert.deepEqual(classifyTransactionSafety("create table demo(id integer);\ninsert into demo values (1);"), {
    safe: true,
    blockers: [],
  });
});

test("unwraps one canonical outer transaction but fails closed for non-transactional statements", () => {
  const result = classifyTransactionSafety(`
    begin;
    create index concurrently demo_idx on demo(id);
    vacuum demo;
    commit;
  `);
  assert.equal(result.safe, false);
  assert.deepEqual(result.blockers, ["create-index-concurrently", "vacuum"]);
});

test("canonical begin/commit wrapper can be combined atomically with ledger insertion", () => {
  const result = unwrapOuterTransaction("begin;\ncreate table demo(id integer);\ncommit;");
  assert.equal(result.hasOuter, true);
  assert.equal(result.invalidControl, false);
  assert.equal(result.sql, "create table demo(id integer);");
  assert.equal(classifyTransactionSafety("begin; create table demo(id integer); commit;").safe, true);
});

test("does not classify PL/pgSQL function bodies as transaction control", () => {
  const result = classifyTransactionSafety(`
    create function demo_fn() returns text language plpgsql as $$
    begin
      return 'ok';
    end;
    $$;
  `);
  assert.deepEqual(result, { safe: true, blockers: [] });
});

test("nested or ambiguous transaction control is rejected", () => {
  assert.deepEqual(classifyTransactionSafety("begin; savepoint x; select 1; commit;"), {
    safe: false,
    blockers: ["transaction-control"],
  });
});

test("SQL statement parser preserves semicolons inside strings, comments, and dollar quotes", () => {
  assert.deepEqual(parseSqlStatements(`
    -- comment ; stays with statement
    create table demo(value text);
    insert into demo values ('a;b');
    create function demo_fn() returns text language plpgsql as $$ begin return 'x;y'; end; $$;
  `), [
    "-- comment ; stays with statement\n    create table demo(value text)",
    "insert into demo values ('a;b')",
    "create function demo_fn() returns text language plpgsql as $$ begin return 'x;y'; end; $$",
  ]);
});

test("ledger diff identifies only added, removed, and changed versions", () => {
  const before = [
    { version: "1", name: "one", statements: ["select 1"] },
    { version: "2", name: "two", statements: ["select 2"] },
  ];
  const after = [
    { version: "2", name: "changed", statements: ["select 2"] },
    { version: "3", name: "three", statements: ["select 3"] },
  ];
  assert.deepEqual(diffLedgers(before, after), {
    added: ["3"],
    removed: ["1"],
    changed: ["2"],
  });
});

test("normal ledger result adds exactly the approved version", () => {
  const diff = { added: ["20261007100000"], removed: [], changed: [] };
  assert.equal(validateExpectedLedgerDiff(diff, "20261007100000"), true);
  assert.equal(validateExpectedLedgerDiff({ ...diff, added: ["legacy", ...diff.added] }, "20261007100000"), false);
});

test("database identity is sanitized and never includes credentials", () => {
  const identity = sanitizeDatabaseIdentity("postgresql://deploy:super-secret@db.internal:5432/thoidai?sslmode=require");
  assert.equal(identity, "postgresql://db.internal:5432/thoidai");
  assert.doesNotMatch(identity, /deploy|super-secret|sslmode/);
});

test("transaction-safe migration applies SQL and registers one ledger row", () => {
  const run = fixture("transactional");
  assert.equal(run.result.status, 0, run.result.stderr);
  assert.match(run.result.stdout, /PASS/);
  assert.equal(run.state.applyCalls, 1);
  assert.equal(run.state.ledger.filter((row) => row.version === "20261007100000").length, 1);
});

test("dry-run performs zero database writes and redacts credentials", () => {
  const run = fixture("dry-run", { extraArgs: ["--dry-run"] });
  assert.equal(run.result.status, 0, run.result.stderr);
  assert.match(run.result.stdout, /DRY_RUN/);
  assert.equal(run.state.applyCalls || 0, 0, JSON.stringify(run.state));
  assert.doesNotMatch(run.result.stdout, /secret|fixture:secret/);
});

test("already recorded version skips SQL", () => {
  const run = fixture("already-applied", { state: { ledger: [{ version: "20261007100000", name: "fixture_migration", statements: [] }] } });
  assert.equal(run.result.status, 0);
  assert.match(run.result.stdout, /ALREADY_APPLIED/);
  assert.equal(run.state.applyCalls || 0, 0, JSON.stringify(run.state));
});

test("SQL error fails without ledger registration", () => {
  const run = fixture("sql-failure", { sql: "RAISE_SYNTAX_ERROR;\n" });
  assert.equal(run.result.status, 3);
  assert.match(run.result.stdout, /MIGRATION_SQL_FAILED/);
  assert.equal(run.state.ledger.length, 0);
});

test("reconciliation registers an applied schema without executing migration SQL", () => {
  const run = fixture("reconcile", { state: { schemaApplied: true }, extraArgs: ["--reconcile-applied-version", "--expected-sha256", "__HASH__", "--postcondition-sql", "__POSTCONDITION__"] });
  assert.equal(run.result.status, 0, run.result.stderr);
  assert.match(run.result.stdout, /PASS/);
  assert.equal(run.state.applyCalls || 0, 0, JSON.stringify(run.state));
  assert.equal(run.state.registrationCalls, 1);
  assert.equal(run.state.ledger.length, 1);
});

test("reconciliation rejects partial schema and leaves ledger absent", () => {
  const run = fixture("partial-reconcile", { state: { postcondition: false }, extraArgs: ["--reconcile-applied-version", "--expected-sha256", "__HASH__", "--postcondition-sql", "__POSTCONDITION__"] });
  assert.equal(run.result.status, 4);
  assert.match(run.result.stdout, /POSTCONDITION_FAILED/);
  assert.equal(run.state.repairCalls || 0, 0);
  assert.equal(run.state.ledger.length, 0);
});

test("reconciliation rejects a migration whose hash does not match owner-approved bytes", () => {
  const run = fixture("wrong-reconcile-hash", {
    state: { schemaApplied: true },
    extraArgs: ["--reconcile-applied-version", "--expected-sha256", "0".repeat(64), "--postcondition-sql", "__POSTCONDITION__"],
  });
  assert.equal(run.result.status, 2);
  assert.match(run.result.stdout, /hash does not match/);
  assert.equal(run.state.psqlCalls || 0, 0);
  assert.equal(run.state.ledger.length, 0);
});

test("registration failure tells operator never to replay SQL", () => {
  const run = fixture("repair-failure", { state: { registrationFails: true }, extraArgs: ["--reconcile-applied-version", "--expected-sha256", "__HASH__", "--postcondition-sql", "__POSTCONDITION__"] });
  assert.equal(run.result.status, 5);
  assert.match(run.result.stdout, /DO NOT REPLAY MIGRATION/i);
  assert.doesNotMatch(run.result.stdout, /fixture:secret|fixture-secret/);
});

test("unexpected ledger diff fails closed", () => {
  const run = fixture("unexpected-diff", { state: { unexpectedLedgerDiff: true } });
  assert.equal(run.result.status, 6);
  assert.match(run.result.stdout, /LEDGER_DIFF_UNEXPECTED/);
});

test("file tampering after preflight aborts before apply", () => {
  const run = fixture("tampered", { state: { mutateFileAtCall: 2 } });
  assert.equal(run.result.status, 2);
  assert.match(run.result.stdout, /changed after preflight/);
  assert.equal(run.state.applyCalls || 0, 0);
});

test("non-transactional fallback applies once, verifies postcondition, and registers once", () => {
  const run = fixture("fallback", {
    sql: "create index concurrently fixture_idx on fixture_table(id);\n",
    extraArgs: ["--postcondition-sql", "__POSTCONDITION__"],
  });
  assert.equal(run.result.status, 0, run.result.stderr);
  assert.equal(run.state.applyCalls, 1);
  assert.equal(run.state.registrationCalls, 1);
  assert.equal(run.state.ledger.length, 1);
});

test("known legacy missing versions remain untouched", () => {
  const run = fixture("legacy-untouched", {
    state: { ledger: [{ version: "20260930100000", name: "known", statements: [] }] },
  });
  assert.equal(run.result.status, 0, run.result.stderr);
  assert.deepEqual(run.state.ledger.map((row) => row.version), ["20260930100000", "20261007100000"]);
});
