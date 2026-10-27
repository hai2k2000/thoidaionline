import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const VERSION_RE = /^(\d{14})/;

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)--[^\r\n]*/g, '$1');
}

export function extractMigrationVersion(name) {
  const match = path.basename(name).match(VERSION_RE);
  return match?.[1] ?? null;
}

function qualified(value) {
  return value.replaceAll('"', '').trim();
}

function addObject(objects, kind, object, evidence, table = null) {
  if (object && !objects.some((entry) => entry.kind === kind && entry.object === object)) objects.push({ kind, object, evidence, ...(table ? { table } : {}) });
}

export function parseMigrationText(text, fileName = '') {
  const clean = stripComments(text);
  const objects = [];
  const drops = [];
  let match;
  const patterns = [
    [/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([\w."-]+)/gi, 'table'],
    [/\balter\s+table\s+([\w."-]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([\w"]+)/gi, 'column'],
    [/\bcreate\s+(?:or\s+replace\s+)?function\s+([\w."-]+)\s*\(/gi, 'function'],
    [/\bcreate\s+policy\s+(['"])(.*?)\1\s+on\s+([\w."-]+)/gi, 'policy'],
    [/\bcreate\s+trigger\s+([\w"-]+)[\s\S]*?\bon\s+([\w."-]+)/gi, 'trigger'],
    [/\bcreate\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?([\w."-]+)/gi, 'index'],
    [/\bcreate\s+type\s+(?:if\s+not\s+exists\s+)?([\w."-]+)/gi, 'type'],
    [/\bcreate\s+(?:or\s+replace\s+)?view\s+([\w."-]+)/gi, 'view'],
  ];
  for (const [pattern, kind] of patterns) {
    while ((match = pattern.exec(clean))) {
      if (kind === 'column') addObject(objects, kind, `${qualified(match[1])}.${qualified(match[2])}`, match[0]);
      else if (kind === 'policy') addObject(objects, kind, match[2], match[0], qualified(match[3]));
      else if (kind === 'trigger') addObject(objects, kind, qualified(match[1]), match[0], qualified(match[2]));
      else addObject(objects, kind, qualified(match[1]), match[0]);
    }
  }
  const dropPattern = /\bdrop\s+(?:table|view|function|type|index|trigger)\s+(?:if\s+exists\s+)?([\w."-]+)/gi;
  while ((match = dropPattern.exec(clean))) drops.push(qualified(match[1]));
  return { fileName: path.basename(fileName), version: extractMigrationVersion(fileName), objects, drops, droppedObjects: [] };
}

export async function parseMigration(filePath) {
  return parseMigrationText(await fs.readFile(filePath, 'utf8'), filePath);
}

export async function selectMissingMigrations(migrationsDir, ledgerVersions) {
  const names = (await fs.readdir(migrationsDir)).filter((name) => name.endsWith('.sql'))
    .sort((a, b) => (extractMigrationVersion(a) ?? '').localeCompare(extractMigrationVersion(b) ?? ''));
  const parsed = [];
  for (const name of names) {
    const migration = await parseMigration(path.join(migrationsDir, name));
    if (migration.version) parsed.push(migration);
  }
  return parsed.filter((migration) => !ledgerVersions.has(migration.version)).map((migration, index) => {
    const laterDrops = new Set(parsed.slice(index).flatMap((entry) => entry.drops));
    const droppedObjects = migration.objects.filter((entry) => laterDrops.has(entry.object))
      .map((entry) => ({ ...entry, kind: 'dropped-later' }));
    return { ...migration, droppedObjects, objects: migration.objects.filter((entry) => !laterDrops.has(entry.object)) };
  });
}

function existenceCondition(entry) {
  const [schema, name] = entry.object.includes('.') ? entry.object.split('.', 2) : ['public', entry.object];
  if (entry.kind === 'column') {
    const [table, column] = entry.object.split('.').slice(-2);
    const tableParts = table.includes('.') ? table.split('.') : [schema, table];
    return `exists (select 1 from information_schema.columns where table_schema = ${sqlString(tableParts[0])} and table_name = ${sqlString(tableParts[1])} and column_name = ${sqlString(column)})`;
  }
  if (entry.kind === 'function') return `exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = ${sqlString(schema)} and p.proname = ${sqlString(name)})`;
  if (entry.kind === 'policy') {
    return `exists (select 1 from pg_policies where schemaname = ${sqlString(schema)} and tablename = ${sqlString(entry.table)} and policyname = ${sqlString(entry.object)})`;
  }
  if (entry.kind === 'trigger') {
    return `exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = ${sqlString(schema)} and c.relname = ${sqlString(entry.table)} and t.tgname = ${sqlString(entry.object)} and not t.tgisinternal)`;
  }
  if (entry.kind === 'type') return `exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = ${sqlString(schema)} and t.typname = ${sqlString(name)})`;
  if (entry.kind === 'view') return `exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = ${sqlString(schema)} and c.relname = ${sqlString(name)} and c.relkind = 'v')`;
  return `to_regclass(${sqlString(`${schema}.${name}`)}) is not null`;
}

function resultLine(version, kind, object, value) {
  return `select ${sqlString(`${version}|${kind}|${object}|`)} || (${value})::text;`;
}

export function buildChecks(migrations) {
  const lines = ['set default_transaction_read_only = on;'];
  for (const migration of migrations) {
    if (!migration.objects.length) {
      lines.push(resultLine(migration.version, 'no-evidence', '-', "'unknown'"));
      continue;
    }
    for (const entry of migration.objects) lines.push(resultLine(migration.version, entry.kind, entry.object, existenceCondition(entry)));
  }
  return `${lines.join('\n')}\n`;
}

export function buildReport(results, fileMap = new Map()) {
  const groups = new Map();
  for (const line of results.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split('|');
    if (parts.length < 4) continue;
    const [version, kind, , raw] = parts;
    const value = raw.trim().toLowerCase() === 'true' || raw.trim() === 't';
    const group = groups.get(version) ?? { total: 0, present: 0, unknown: false };
    if (kind === 'no-evidence') group.unknown = true;
    else { group.total += 1; if (value) group.present += 1; }
    groups.set(version, group);
  }
  const rows = ['| Version | Migration | Objects present/total | Classification |', '|---|---|---:|---|'];
  for (const [version, group] of groups) {
    const classification = group.unknown ? 'UNKNOWN' : group.present === group.total && group.total > 0 ? 'APPLIED' : group.present > 0 ? 'PARTIAL' : 'NOT_APPLIED';
    rows.push(`| ${version} | ${fileMap.get(version) ?? '-'} | ${group.present}/${group.total} | ${classification} |`);
  }
  rows.push(`| 20260901095000 | ${fileMap.get('20260901095000') ?? '20260901095000_backend_security_hardening.sql'} | - | SUPERSEDED_BY_C01 |`);
  return `${rows.join('\n')}\n`;
}

export function buildBackfillSql(results, fileMap = new Map()) {
  const groups = new Map();
  for (const line of results.split(/\r?\n/)) {
    const [version, kind, , raw] = line.split('|');
    if (!version || kind === 'no-evidence') continue;
    const group = groups.get(version) ?? { total: 0, present: 0 };
    group.total += 1;
    if (raw?.trim().toLowerCase() === 'true' || raw?.trim() === 't') group.present += 1;
    groups.set(version, group);
  }
  const lines = ['-- backfill — ghi nhận migration đã áp dụng ngoài ledger; cần owner duyệt; không chạy lại SQL migration', 'begin;'];
  for (const [version, group] of groups) {
    if (group.present !== group.total || group.total === 0) continue;
    const name = fileMap.get(version) ?? version;
    lines.push(`insert into supabase_migrations.schema_migrations(version, name, statements) values (${sqlString(version)}, ${sqlString(name.replace(/\.sql$/, '').replace(/^\d+_/, ''))}, array[]::text[]) on conflict (version) do nothing;`);
  }
  lines.push('commit;');
  return `${lines.join('\n')}\n`;
}

async function main(argv) {
  const [command, ...args] = argv;
  const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
  if (!['checks', 'report', 'backfill-sql'].includes(command)) throw new Error('Usage: checks|report|backfill-sql');
  if (command === 'checks') {
    const ledger = new Set((await fs.readFile(value('--ledger'), 'utf8')).split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    const migrations = await selectMissingMigrations(path.join(process.cwd(), 'supabase', 'migrations'), ledger);
    process.stdout.write(buildChecks(migrations));
  } else {
    const results = await fs.readFile(value('--results'), 'utf8');
    const names = await fs.readdir(path.join(process.cwd(), 'supabase', 'migrations'));
    const fileMap = new Map(names.map((name) => [extractMigrationVersion(name), name]));
    process.stdout.write(command === 'report' ? buildReport(results, fileMap) : buildBackfillSql(results, fileMap));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
