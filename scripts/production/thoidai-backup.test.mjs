import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const script = 'scripts/production/thoidai-backup.sh';
const source = readFileSync(script, 'utf8');
const drill = readFileSync('scripts/production/backup-restore-drill.sh', 'utf8');
test('offline self-test passes', () => { assert.match(execFileSync('bash', [script, 'self-test'], { encoding: 'utf8' }), /SELF_TEST=PASS/); });
test('backup safety contracts are present', () => { assert.match(source, /flock -n/); assert.match(source, /THOIDAI_BACKUP_MAX_MB/); assert.match(source, /\.partial/); assert.doesNotMatch(source, /docker system prune/); assert.doesNotMatch(source, /rm -rf -- \$[A-Za-z_][A-Za-z0-9_]*\s*$/m); assert.doesNotMatch(source, /\\s/); });
test('restore drill is isolated and guarded', () => {
  assert.match(drill, /main\(\)\s*\{/);
  assert.match(drill, /main "\$@"; exit \$\?/);
  assert.match(drill, /INCOMPLETE/);
  assert.match(drill, /trap .*cleanup/);
  assert.match(drill, /--network none/);
  assert.match(drill, /--memory 512m/);
  assert.match(drill, /PostgreSQL init process complete; ready for start up\./);
  assert.match(drill, /pg_isready/);
  assert.match(drill, /-h 127\.0\.0\.1 -U supabase_admin/);
  assert.match(drill, /alter default privileges/i);
  assert.match(drill, /TEMP_DEFAULT_ACL_PUBLIC/);
  assert.doesNotMatch(drill, /revoke all on schema public from public/i);
  assert.match(drill, /docker exec -i/);
  assert.match(drill, /pg_restore .* -h 127\.0\.0\.1 -U supabase_admin -d postgres/);
  assert.match(drill, /--schema=public/);
  assert.match(drill, /--schema=supabase_migrations/);
  assert.match(drill, /RESTORE_ERRORS/);
  assert.match(drill, /already exists/);
  assert.doesNotMatch(drill, /pg_restore[^\n]*--clean/);
  assert.doesNotMatch(drill, /pg_dump.*supabase_db_thoidai-work/);
  assert.doesNotMatch(drill, /\\s/);
});

test('run keeps only valid daily predecessor and cleans partials', () => {
  const root = mkdtempSync(join(tmpdir(), 'thoidai-backup-'));
  const bin = join(root, 'bin');
  const storage = join(root, 'storage');
  mkdirSync(bin);
  mkdirSync(storage);
  writeFileSync(join(storage, 'payload.txt'), 'storage-payload');
  writeFileSync(join(bin, 'docker'), `#!/usr/bin/env bash
set -Eeuo pipefail
counter_file="$THOIDAI_TEST_COUNTER"
case " $* " in
  *" pg_dump "*)
    n=0; [[ -f "$counter_file" ]] && n=$(cat "$counter_file")
    if [[ "\${THOIDAI_TEST_SAME:-0}" == 1 ]]; then n=2; else n=\$((n + 1)); fi
    printf '%s' "$n" > "$counter_file"
    printf 'fake-dump-%s\\n' "$n"
    ;;
  *" pg_restore --list "*)
    for i in $(seq 1 150); do printf 'item-%03d\\n' "$i"; done
    ;;
  *" psql "*) printf '17.6\\n' ;;
  *) exit 2 ;;
esac
`);
  writeFileSync(join(bin, 'flock'), `#!/usr/bin/env bash
exit 0
`);
  const envBase = {
    ...process.env,
    PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
    THOIDAI_BACKUP_ROOT: root,
    THOIDAI_BACKUP_LOCK: join(root, 'backup.lock'),
    THOIDAI_BACKUP_STORAGE: storage,
    THOIDAI_BACKUP_SKIP_DISK_GUARD: '1',
    THOIDAI_TEST_COUNTER: join(root, 'counter'),
  };
  if (process.platform !== 'win32') execFileSync('chmod', ['+x', join(bin, 'docker'), join(bin, 'flock')]);
  const bashPath = (value) => process.platform === 'win32'
    ? execFileSync('cygpath', ['-u', value], { encoding: 'utf8' }).trim()
    : value;
  const run = (now, same = false) => execFileSync('bash', [script, 'run'], {
    env: { ...envBase, PATH: `${bashPath(bin)}:${process.env.PATH}`, THOIDAI_BACKUP_ROOT: bashPath(root), THOIDAI_BACKUP_LOCK: bashPath(join(root, 'backup.lock')), THOIDAI_BACKUP_STORAGE: bashPath(storage), THOIDAI_TEST_COUNTER: bashPath(join(root, 'counter')), THOIDAI_BACKUP_NOW: now, THOIDAI_TEST_SAME: same ? '1' : '0' },
    encoding: 'utf8',
  });
  run('20261026T133856Z');
  run('20261026T133956Z');
  const daily = readdirSync(join(root, 'daily')).filter((name) => !name.startsWith('.'));
  assert.equal(daily.length, 2);
  assert.equal(existsSync(join(root, 'daily', '.20261026T133856Z-daily.partial')), false);
  assert.equal(existsSync(join(root, 'last-success')), true);
  const log = existsSync(join(root, 'backup.log')) ? readFileSync(join(root, 'backup.log'), 'utf8') : '';
  assert.doesNotMatch(log, /DUPLICATE_OF=.*\.partial/);
  run('20261026T134056Z', true);
  assert.equal(readdirSync(join(root, 'daily')).filter((name) => !name.startsWith('.')).length, 2);
  assert.match(readFileSync(join(root, 'backup.log'), 'utf8'), /DUPLICATE_OF=20261026T133956Z-daily/);
});
