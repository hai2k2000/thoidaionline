import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  extractMigrationVersion,
  parseMigration,
  selectMissingMigrations,
  buildReport,
  buildBackfillSql,
} from './ledger-reconcile.mjs';

async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ledger-reconcile-'));
  await fs.writeFile(path.join(dir, '20260101000000_first.sql'), `
    -- create table ignored_table
    create table if not exists public.alpha (id uuid);
    alter table public.alpha add column if not exists note text;
    create or replace function public.alpha_fn() returns void language sql as $$ select 1 $$;
    create policy "alpha read" on public.alpha using (true);
    create trigger alpha_trigger after insert on public.alpha execute function public.alpha_fn();
    create unique index if not exists alpha_idx on public.alpha(id);
    create type public.alpha_kind as enum ('a');
    create or replace view public.alpha_view as select id from public.alpha;
  `);
  await fs.writeFile(path.join(dir, '20260102000000_second.sql'), `
    create table public.beta (id int);
    drop table public.alpha;
  `);
  return dir;
}

test('extracts versions and evidence while ignoring comments', async () => {
  const dir = await fixture();
  const first = await parseMigration(path.join(dir, '20260101000000_first.sql'));
  assert.equal(extractMigrationVersion('20260101000000_first.sql'), '20260101000000');
  assert.equal(first.objects.length, 8);
  assert.ok(first.objects.some((o) => o.kind === 'table' && o.object === 'public.alpha'));
  assert.ok(first.objects.some((o) => o.kind === 'function' && o.object === 'public.alpha_fn'));
  assert.ok(first.objects.some((o) => o.kind === 'policy' && o.object === 'alpha read'));
  assert.ok(first.objects.some((o) => o.kind === 'column' && o.object === 'public.alpha.note'));
  assert.ok(first.objects.some((o) => o.kind === 'trigger' && o.object === 'alpha_trigger' && o.table === 'public.alpha'));
});

test('filters versions already present in ledger and marks later drops', async () => {
  const dir = await fixture();
  const selected = await selectMissingMigrations(dir, new Set(['20260102000000']));
  assert.deepEqual(selected.map((m) => m.version), ['20260101000000']);
  assert.ok(selected[0].objects.every((o) => o.kind !== 'dropped-later'));
  assert.equal(selected[0].droppedObjects.some((o) => o.object === 'public.alpha'), true);
  assert.equal(selected[0].droppedObjects.find((o) => o.object === 'public.alpha')?.kind, 'dropped-later');
});

test('builds report classifications and superseded C-01 row', () => {
  const results = [
    '20260101000000|table|public.alpha|true',
    '20260101000000|view|public.alpha_view|false',
    '20260102000000|no-evidence|-|unknown',
    '20260103000000|table|public.gamma|false',
  ].join('\n');
  const report = buildReport(results, new Map([
    ['20260101000000', '20260101000000_first.sql'],
    ['20260102000000', '20260102000000_second.sql'],
    ['20260103000000', '20260103000000_third.sql'],
    ['20260901095000', '20260901095000_backend_security_hardening.sql'],
  ]));
  assert.match(report, /PARTIAL/);
  assert.match(report, /UNKNOWN/);
  assert.match(report, /NOT_APPLIED/);
  assert.match(report, /SUPERSEDED_BY_C01/);
});

test('backfill emits only applied versions and no destructive SQL', () => {
  const sql = buildBackfillSql('20260101000000|table|public.alpha|true\n20260101000000|view|public.alpha_view|false\n20260102000000|table|public.beta|true');
  assert.match(sql, /on conflict \(version\) do nothing/i);
  assert.doesNotMatch(sql, /20260101000000/);
  assert.match(sql, /20260102000000/);
  assert.doesNotMatch(sql, /\b(drop|delete|alter)\b/i);
});

test('backfill includes a version only when every evidence object is present', () => {
  const sql = buildBackfillSql('20260101000000|table|public.alpha|true\n20260101000000|view|public.alpha_view|true');
  assert.match(sql, /20260101000000/);
});
