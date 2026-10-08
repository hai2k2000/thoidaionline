#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const STATUS = Object.freeze({
  PASS: "PASS",
  DRY_RUN: "DRY_RUN",
  ALREADY_APPLIED: "ALREADY_APPLIED",
  PRECHECK_FAILED: "PRECHECK_FAILED",
  MIGRATION_SQL_FAILED: "MIGRATION_SQL_FAILED",
  POSTCONDITION_FAILED: "POSTCONDITION_FAILED",
  LEDGER_REGISTRATION_FAILED: "LEDGER_REGISTRATION_FAILED",
  LEDGER_DIFF_UNEXPECTED: "LEDGER_DIFF_UNEXPECTED",
});

const EXIT_CODES = {
  [STATUS.PASS]: 0,
  [STATUS.DRY_RUN]: 0,
  [STATUS.ALREADY_APPLIED]: 0,
  [STATUS.PRECHECK_FAILED]: 2,
  [STATUS.MIGRATION_SQL_FAILED]: 3,
  [STATUS.POSTCONDITION_FAILED]: 4,
  [STATUS.LEDGER_REGISTRATION_FAILED]: 5,
  [STATUS.LEDGER_DIFF_UNEXPECTED]: 6,
};

const usage = `Usage: safe-apply-migration.sh --file supabase/migrations/YYYYMMDDHHMMSS_name.sql --db-url-env ENV_NAME [--dry-run] [--reconcile-applied-version --expected-sha256 HASH] [--postcondition-sql FILE]`;

export function parseMigrationFilename(filename) {
  const base = basename(filename);
  const match = /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/.exec(base);
  if (!match) throw new Error(`migration filename must match YYYYMMDDHHMMSS_name.sql: ${base}`);
  return { version: match[1], name: match[2], filename: base };
}

export function findVersionConflicts(migrationsDir, version) {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql") && name.startsWith(`${version}_`))
    .sort()
    .map((name) => resolve(migrationsDir, name));
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function sanitizeDatabaseIdentity(dbUrl) {
  let url;
  try { url = new URL(dbUrl); } catch { throw new Error("database URL is invalid"); }
  const port = url.port ? `:${url.port}` : "";
  return `${url.protocol}//${url.hostname}${port}/${url.pathname.replace(/^\//, "")}`;
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|\n)\s*--[^\n]*/g, "$1");
}

export function classifyTransactionSafety(sql) {
  const { sql: body, invalidControl } = unwrapOuterTransaction(sql);
  const statements = parseSqlStatements(body).map((statement) => stripSqlComments(statement).trim().toLowerCase());
  const hasStatement = (pattern) => statements.some((statement) => pattern.test(statement));
  const blockers = [];
  if (invalidControl || hasStatement(/^(begin|start\s+transaction|commit|rollback|savepoint|release\s+savepoint)\b/)) blockers.push("transaction-control");
  if (hasStatement(/^create\s+(unique\s+)?index\s+concurrently\b/)) blockers.push("create-index-concurrently");
  if (hasStatement(/^drop\s+index\s+concurrently\b/)) blockers.push("drop-index-concurrently");
  if (hasStatement(/^alter\s+type\b[\s\S]*\badd\s+value\b/)) blockers.push("alter-type-add-value");
  if (hasStatement(/^vacuum\b/)) blockers.push("vacuum");
  if (hasStatement(/^reindex\s+concurrently\b/)) blockers.push("reindex-concurrently");
  if (hasStatement(/^cluster\b/)) blockers.push("cluster");
  if (hasStatement(/^(create|drop)\s+database\b/)) blockers.push("database-control");
  return { safe: blockers.length === 0, blockers: [...new Set(blockers)] };
}

export function unwrapOuterTransaction(sql) {
  const statements = parseSqlStatements(sql);
  const first = statements[0]?.trim().toLowerCase();
  const last = statements.at(-1)?.trim().toLowerCase();
  const hasOuter = first === "begin" && last === "commit";
  const body = hasOuter ? statements.slice(1, -1) : statements;
  const invalidControl = body.some((statement) => /^(begin|commit|rollback|savepoint\b|release\s+savepoint\b)/i.test(stripSqlComments(statement).trim()));
  return { sql: body.map((statement) => `${statement};`).join("\n"), hasOuter, invalidControl };
}

export function parseSqlStatements(sql) {
  const statements = [];
  let start = 0;
  let quote = null;
  let dollarTag = null;
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < sql.length; i += 1) {
    const c = sql[i];
    const n = sql[i + 1];
    if (lineComment) {
      if (c === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (c === "*" && n === "/") { blockComment = false; i += 1; }
      continue;
    }
    if (!quote && !dollarTag && c === "-" && n === "-") { lineComment = true; i += 1; continue; }
    if (!quote && !dollarTag && c === "/" && n === "*") { blockComment = true; i += 1; continue; }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) { i += dollarTag.length - 1; dollarTag = null; }
      continue;
    }
    if (quote) {
      if (c === quote && sql[i - 1] !== "\\") {
        if (quote === "'" && n === "'") { i += 1; continue; }
        quote = null;
      }
      continue;
    }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === "$" ) {
      const match = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) { dollarTag = match[0]; i += dollarTag.length - 1; continue; }
    }
    if (c === ";") {
      const statement = sql.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = i + 1;
    }
  }
  const tail = sql.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

export function diffLedgers(before, after) {
  const map = (rows) => new Map(rows.map((row) => [String(row.version), JSON.stringify(row)]));
  const left = map(before);
  const right = map(after);
  return {
    added: [...right.keys()].filter((version) => !left.has(version)).sort(),
    removed: [...left.keys()].filter((version) => !right.has(version)).sort(),
    changed: [...right.keys()].filter((version) => left.has(version) && left.get(version) !== right.get(version)).sort(),
  };
}

export function validateExpectedLedgerDiff(diff, version) {
  return diff.added.length === 1 && diff.added[0] === version && diff.removed.length === 0 && diff.changed.length === 0;
}

function parseArgs(argv) {
  const args = { dryRun: false, reconcile: false, expectedSha256: null, postconditionSql: null, dbUrlEnv: null, file: null, evidenceDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--reconcile-applied-version") args.reconcile = true;
    else if (arg === "--expected-sha256") args.expectedSha256 = argv[++i];
    else if (arg === "--file") args.file = argv[++i];
    else if (arg === "--db-url-env") args.dbUrlEnv = argv[++i];
    else if (arg === "--postcondition-sql") args.postconditionSql = argv[++i];
    else if (arg === "--evidence-dir") args.evidenceDir = argv[++i];
    else if (arg === "--help" || arg === "-h") { console.log(usage); return null; }
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.file || !args.dbUrlEnv) throw new Error(usage);
  if (args.reconcile && !args.postconditionSql) throw new Error("--reconcile-applied-version requires --postcondition-sql");
  if (args.reconcile && !/^[a-f0-9]{64}$/i.test(args.expectedSha256 || "")) throw new Error("--reconcile-applied-version requires --expected-sha256");
  return args;
}

function databaseConnection(dbUrl) {
  const url = new URL(dbUrl);
  const env = { ...process.env };
  if (url.username) env.PGUSER = decodeURIComponent(url.username);
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);
  if (url.hostname) env.PGHOST = url.hostname;
  if (url.port) env.PGPORT = url.port;
  env.PGDATABASE = decodeURIComponent(url.pathname.replace(/^\//, ""));
  for (const [key, value] of url.searchParams) {
    if (key === "sslmode") env.PGSSLMODE = value;
    if (key === "host") env.PGHOST = value;
    if (key === "port") env.PGPORT = value;
  }
  return { env, database: env.PGDATABASE || "postgres" };
}

function redactOutput(text, dbUrl) {
  if (!text) return "";
  let redacted = String(text);
  try {
    const url = new URL(dbUrl);
    if (url.password) redacted = redacted.replaceAll(url.password, "[REDACTED]");
    redacted = redacted.replace(/(postgres(?:ql)?:\/\/[^\s/@:]+):[^\s/@]+@/gi, "$1:[REDACTED]@");
  } catch { /* identity validation reports the original preflight error */ }
  return redacted;
}

function psqlCommand(args, env) {
  const command = env.SAFE_MIGRATION_PSQL_BIN || "psql";
  return { command, args: env.SAFE_MIGRATION_PSQL_SCRIPT ? [env.SAFE_MIGRATION_PSQL_SCRIPT, ...args] : args };
}

function psql(dbUrl, sql, { input = null, json = false } = {}) {
  const connection = databaseConnection(dbUrl);
  const command = psqlCommand(["--no-psqlrc", "-X", "--set", "ON_ERROR_STOP=1", "--dbname", connection.database, ...(json ? ["-At", "-c", sql] : ["-f", "-"])], connection.env);
  const result = spawnSync(command.command, command.args, {
    input: input ?? sql,
    encoding: "utf8",
    env: { ...connection.env, PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || "10" },
  });
  return { ...result, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function ledgerQuerySql(statementsIsArray) {
  const renderedStatements = statementsIsArray ? "coalesce(array_to_json(statements), '[]'::json)" : "to_json(statements)";
  return `select coalesce(json_agg(json_build_object('version', version::text, 'name', name::text, 'statements', ${renderedStatements}) order by version), '[]'::json) from supabase_migrations.schema_migrations`;
}

function readLedger(dbUrl, statementsIsArray) {
  const result = psql(dbUrl, ledgerQuerySql(statementsIsArray), { json: true });
  if (result.status !== 0) throw new Error(redactOutput(result.stderr.trim(), dbUrl) || "ledger inspection failed");
  return JSON.parse(result.stdout.trim() || "[]");
}

function discoverLedger(dbUrl) {
  const query = `select column_name, data_type, udt_name from information_schema.columns where table_schema='supabase_migrations' and table_name='schema_migrations' order by ordinal_position`;
  const result = psql(dbUrl, query, { json: true });
  if (result.status !== 0) throw new Error(redactOutput(result.stderr.trim(), dbUrl) || "ledger schema inspection failed");
  const columns = result.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const [column_name, data_type, udt_name] = line.split("|");
    return { column_name, data_type, udt_name };
  });
  const names = new Set(columns.map((column) => column.column_name));
  if (!["version", "name", "statements"].every((name) => names.has(name))) throw new Error("unsupported migration ledger shape");
  const statements = columns.find((column) => column.column_name === "statements");
  return { statementsIsArray: statements.udt_name === "_text", columns };
}

function ledgerInsertSql(meta, migration, statements) {
  const arrayValue = `array[${statements.map(sqlLiteral).join(",")}]::text[]`;
  const statementValue = meta.statementsIsArray ? arrayValue : sqlLiteral(statements.join(";\n"));
  return `insert into supabase_migrations.schema_migrations(version, name, statements) values (${sqlLiteral(migration.version)}, ${sqlLiteral(migration.name)}, ${statementValue});`;
}

function registerLedger(dbUrl, ledgerMeta, migration, migrationStatements) {
  return psql(dbUrl, ["begin;", ledgerInsertSql(ledgerMeta, migration, migrationStatements), "commit;"].join("\n"));
}

function runPostcondition(dbUrl, path) {
  const sql = readFileSync(path, "utf8");
  const result = psql(dbUrl, sql, { json: true });
  const output = result.stdout.trim();
  const ok = result.status === 0 && /^(pass|true|t|1)$/i.test(output);
  return { ok, output: output.slice(0, 200), error: redactOutput(result.stderr.trim().slice(0, 200), dbUrl) };
}

function evidencePath(dir, version) {
  mkdirSync(dir, { recursive: true });
  return resolve(dir, `${version}-${Date.now()}.json`);
}

function unresolvedEvidence(dir, version) {
  if (!existsSync(dir)) return null;
  for (const name of readdirSync(dir).filter((entry) => entry.startsWith(`${version}-`) && entry.endsWith(".json")).sort().reverse()) {
    try {
      const record = JSON.parse(readFileSync(resolve(dir, name), "utf8"));
      if (record.schema_may_be_applied === true || [STATUS.LEDGER_REGISTRATION_FAILED, STATUS.LEDGER_DIFF_UNEXPECTED].includes(record.status)) return resolve(dir, name);
      if ([STATUS.PASS, STATUS.ALREADY_APPLIED].includes(record.status)) return null;
    } catch { return resolve(dir, name); }
  }
  return null;
}

function sanitizedLedger(rows) {
  return rows.map((row) => ({
    version: String(row.version),
    name: String(row.name ?? ""),
    statements_sha256: createHash("sha256").update(JSON.stringify(row.statements ?? [])).digest("hex"),
  }));
}

function printStatus(status, message = "") {
  console.log(`${status}${message ? `: ${message}` : ""}`);
}

export function execute(argv = process.argv.slice(2), env = process.env) {
  let args;
  try { args = parseArgs(argv); } catch (error) { printStatus(STATUS.PRECHECK_FAILED, error.message); return EXIT_CODES[STATUS.PRECHECK_FAILED]; }
  if (!args) return 0;
  const file = resolve(args.file);
  const migrationsDir = dirname(file);
  const evidenceDir = resolve(args.evidenceDir || env.MIGRATION_EVIDENCE_DIR || "ops/evidence/migrations");
  let evidence = { timestamp: new Date().toISOString(), status: STATUS.PRECHECK_FAILED };
  const finish = (status, message, extra = {}) => {
    evidence = { ...evidence, ...extra, status, message };
    try { writeFileSync(evidencePath(evidenceDir, evidence.version || "unknown"), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 }); } catch (error) {
      printStatus(STATUS.PRECHECK_FAILED, `cannot write migration evidence: ${error instanceof Error ? error.message : String(error)}`);
      return EXIT_CODES[STATUS.PRECHECK_FAILED];
    }
    printStatus(status, message);
    return EXIT_CODES[status];
  };
  try {
    const expectedMigrationsDir = resolve(env.SAFE_MIGRATION_MIGRATIONS_DIR || resolve(process.cwd(), "supabase", "migrations"));
    if (!existsSync(file) || migrationsDir !== expectedMigrationsDir) throw new Error(`migration file must be inside ${expectedMigrationsDir}`);
    mkdirSync(evidenceDir, { recursive: true });
    const migration = parseMigrationFilename(file);
    const conflicts = findVersionConflicts(migrationsDir, migration.version);
    if (conflicts.length !== 1 || resolve(conflicts[0]) !== file) return finish(STATUS.PRECHECK_FAILED, `duplicate or conflicting migration version: ${conflicts.join(", ")}`, { version: migration.version, filename: migration.filename });
    const dbUrl = env[args.dbUrlEnv];
    if (!dbUrl) return finish(STATUS.PRECHECK_FAILED, `database URL environment variable is absent: ${args.dbUrlEnv}`, { version: migration.version, filename: migration.filename });
    const identity = sanitizeDatabaseIdentity(dbUrl);
    const hash = sha256File(file);
    if (args.expectedSha256 && args.expectedSha256.toLowerCase() !== hash) return finish(STATUS.PRECHECK_FAILED, "migration file hash does not match --expected-sha256", { version: migration.version, filename: migration.filename, sha256: hash });
    const sql = readFileSync(file, "utf8");
    const safety = classifyTransactionSafety(sql);
    const executableSql = unwrapOuterTransaction(sql).sql;
    const migrationStatements = parseSqlStatements(sql);
    evidence = { ...evidence, version: migration.version, filename: migration.filename, sha256: hash, target: identity, transaction_safe: safety.safe, transaction_blockers: safety.blockers, ledger_before_target: "ABSENT" };
    const unresolved = unresolvedEvidence(evidenceDir, migration.version);
    if (unresolved && !args.reconcile && !args.dryRun) return finish(STATUS.PRECHECK_FAILED, `previous run may have applied schema; do not replay migration, use --reconcile-applied-version after proof (${basename(unresolved)})`);
    const ledgerMeta = discoverLedger(dbUrl);
    const before = readLedger(dbUrl, ledgerMeta.statementsIsArray);
    const targetRows = before.filter((row) => String(row.version) === migration.version);
    evidence.ledger_before = sanitizedLedger(before);
    if (targetRows.length > 1) return finish(STATUS.PRECHECK_FAILED, "target migration version appears more than once", { ledger_before_target: "DUPLICATE" });
    if (targetRows.length === 1) return finish(STATUS.ALREADY_APPLIED, `migration ${migration.version} is already recorded`, { ledger_before_target: "PRESENT" });
    if (args.dryRun) return finish(STATUS.DRY_RUN, `${identity} ${migration.filename} sha256=${hash} path=${safety.safe ? "transactional" : `fallback(${safety.blockers.join(",")})`}`, { ledger_before_target: "ABSENT", intended_ledger_action: args.reconcile ? "bounded registration only" : "register exact version after apply" });
    if (args.reconcile) {
      const post = runPostcondition(dbUrl, args.postconditionSql);
      if (!post.ok) return finish(STATUS.POSTCONDITION_FAILED, `reconciliation postcondition failed: ${post.output || post.error}`, { postcondition: post });
      const repair = registerLedger(dbUrl, ledgerMeta, migration, migrationStatements);
      if (repair.status !== 0) return finish(STATUS.LEDGER_REGISTRATION_FAILED, "SCHEMA MAY BE APPLIED - DO NOT REPLAY MIGRATION; bounded reconciliation failed", { registration_stderr: redactOutput((repair.stderr || "").slice(0, 200), dbUrl) });
    } else if (safety.safe) {
      if (sha256File(file) !== hash) return finish(STATUS.PRECHECK_FAILED, "migration file changed after preflight", { ledger_before_target: "ABSENT" });
      const transaction = ["begin;", executableSql.trim(), ledgerInsertSql(ledgerMeta, migration, migrationStatements), "commit;"].join("\n");
      const result = psql(dbUrl, transaction);
      if (result.status !== 0) return finish(STATUS.MIGRATION_SQL_FAILED, "transaction rolled back; migration ledger remains absent", { apply_stderr: redactOutput(result.stderr.slice(0, 300), dbUrl) });
    } else {
      if (!args.postconditionSql) return finish(STATUS.PRECHECK_FAILED, `non-transactional migration requires --postcondition-sql (${safety.blockers.join(",")})`);
      if (sha256File(file) !== hash) return finish(STATUS.PRECHECK_FAILED, "migration file changed after preflight");
      const applied = psql(dbUrl, sql);
      if (applied.status !== 0) return finish(STATUS.MIGRATION_SQL_FAILED, "SCHEMA MAY BE APPLIED - DO NOT REPLAY MIGRATION; migration SQL failed", { schema_may_be_applied: true, apply_stderr: redactOutput(applied.stderr.slice(0, 300), dbUrl) });
      const post = runPostcondition(dbUrl, args.postconditionSql);
      if (!post.ok) return finish(STATUS.POSTCONDITION_FAILED, `SCHEMA MAY BE APPLIED - DO NOT REPLAY MIGRATION; postcondition failed: ${post.output || post.error}`, { schema_may_be_applied: true, postcondition: post });
      const repair = registerLedger(dbUrl, ledgerMeta, migration, migrationStatements);
      if (repair.status !== 0) return finish(STATUS.LEDGER_REGISTRATION_FAILED, "SCHEMA MAY BE APPLIED - DO NOT REPLAY MIGRATION; ledger registration failed", { schema_may_be_applied: true, registration_stderr: redactOutput((repair.stderr || "").slice(0, 200), dbUrl) });
    }
    const after = readLedger(dbUrl, ledgerMeta.statementsIsArray);
    const diff = diffLedgers(before, after);
    if (!validateExpectedLedgerDiff(diff, migration.version)) return finish(STATUS.LEDGER_DIFF_UNEXPECTED, `unexpected ledger diff: ${JSON.stringify(diff)}`, { schema_may_be_applied: true, ledger_after: sanitizedLedger(after), ledger_diff: diff });
    return finish(STATUS.PASS, `${migration.filename} applied and registered exactly once`, { ledger_after: sanitizedLedger(after), ledger_diff: diff, ledger_after_target: "PRESENT" });
  } catch (error) {
    return finish(STATUS.PRECHECK_FAILED, error instanceof Error ? error.message : String(error));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = execute();
