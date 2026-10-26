import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const script = 'scripts/production/thoidai-backup.sh';
const source = readFileSync(script, 'utf8');
test('offline self-test passes', () => { assert.match(execFileSync('bash', [script, 'self-test'], { encoding: 'utf8' }), /SELF_TEST=PASS/); });
test('backup safety contracts are present', () => { assert.match(source, /flock -n/); assert.match(source, /THOIDAI_BACKUP_MAX_MB/); assert.match(source, /\.partial/); assert.doesNotMatch(source, /docker system prune/); assert.doesNotMatch(source, /rm -rf -- \$[A-Za-z_][A-Za-z0-9_]*\s*$/m); assert.doesNotMatch(source, /\\s/); });