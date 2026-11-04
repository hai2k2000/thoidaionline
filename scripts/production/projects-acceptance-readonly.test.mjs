import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('./projects-acceptance-readonly.sql', import.meta.url), 'utf8');
const md = fs.readFileSync(new URL('../../docs/projects-manual-acceptance.md', import.meta.url), 'utf8');
// Mask literals as well as comments: 'project.create' is data, not DDL.
// Keep dollar quotes visible so anonymous DO blocks cannot bypass the check.
const executable = sql.replace(/'(?:''|[^'])*'|--[^\r\n]*|\/\*[\s\S]*?\*\//g, ' ');
const forbidden = /\b(?:insert|update|delete|truncate|alter|create|drop|grant|revoke|copy|perform|call)\b|\bset\s+role\b|\bdo\s+\$\$/i;

test('diagnostic SQL is explicitly read-only and references all migrations', () => {
  assert.match(executable.trimStart(), /^begin transaction read only;/i);
  assert.match(executable.trim(), /rollback;\s*$/i);
  assert.doesNotMatch(executable, forbidden);
  assert.doesNotMatch(executable, /\bset_config\s*\(/i);
  const statements = executable.replace(/^\s*\\echo[^\r\n]*/gm, '').split(';').map(s => s.trim()).filter(Boolean);
  assert.equal(statements[0].toLowerCase(), 'begin transaction read only');
  assert.equal(statements.at(-1).toLowerCase(), 'rollback');
  for (const statement of statements.slice(1, -1)) assert.match(statement, /^select\b/i);
  for (const version of ['20261103150000','20261103160000','20261103180000','20261103200000']) assert.match(sql, new RegExp(version));
});

test('forbidden SQL detection covers mixed case and anonymous blocks', () => {
  for (const command of ['INSERT', 'uPdAtE', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'DROP', 'GRANT', 'REVOKE', 'COPY', 'SET\nROLE', 'PERFORM', 'DO $$', 'CALL']) {
    assert.match(command, forbidden);
  }
});

test('manual acceptance covers cases A through H', () => {
  for (const section of 'ABCDEFGH') assert.match(md, new RegExp(`^## ${section}\\.`, 'm'), `missing section ${section}`);
});
