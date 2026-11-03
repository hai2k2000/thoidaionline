import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const root = 'supabase/migrations/';
const cutoff = '20261103200000_projects_v1_2_permissions.sql';
const current = readFileSync(root + cutoff, 'utf8');
const definition = (sql, name) => sql.match(new RegExp(
  `create or replace function public\\.${name}\\([\\s\\S]*?as (\\$[a-z_]*\\$)[\\s\\S]*?\\1;`, 'i',
))?.[0];
function previous(name) {
  for (const file of readdirSync(root).filter(file => file.endsWith('.sql') && file < cutoff).sort().reverse()) {
    const sql = definition(readFileSync(root + file, 'utf8'), name);
    if (sql) return { file, sql };
  }
  assert.fail(`Missing prior definition: ${name}`);
}

test('non-project assigned review preserves the latest legacy RPC byte for byte', () => {
  const name = 'api_review_assigned_task_completion';
  const old = previous(name);
  assert.equal(old.file, '20260924120000_task_approval_gates.sql');
  // Specialize only the explicit project additions for project_id IS NULL.
  const legacy = definition(current, name)
    .replace('v_before.project_id is not null or v_before.approval_required', 'v_before.approval_required')
    .replace(/    if v_before.project_id is not null then\r?\n      v_allowed := public\.api_project_is_lead\(p_actor_id,v_before.project_id\);\r?\n    else\r?\n/, '')
    .replace(/    end if;\r?\n(    if not v_allowed)/, '$1')
    .replace(' or (v_before.project_id is not null and p_decision is null)', '')
    .replace(/    if v_before.project_id is not null and p_decision='return' then\r?\n      insert into public.task_comments[^\n]*\r?\n    end if;\r?\n/, '');
  assert.equal(legacy, old.sql);
  assert.doesNotMatch(old.sql, /task_completion_scores|require_task_score/);
});

test('legacy completion wrappers and authorization helper are not replaced by V1.2', () => {
  for (const [name, file] of [
    ['api_review_task_completion', '20260814190000_phase1_authorization_facade.sql'],
    ['review_task_completion', '20261103160000_projects_v1.sql'],
    ['api_assert_task_action', '20261103160000_projects_v1.sql'],
  ]) {
    const old = previous(name);
    assert.equal(old.file, file);
    assert.equal(definition(current, name), undefined);
    assert.doesNotMatch(old.sql, /task_completion_scores|require_task_score/);
  }
});

test('non-project trigger retains the previous score gate when bound and enabled', () => {
  const body = sql => sql.slice(sql.indexOf('begin')).replace(/\s+/g, ' ').replace(/\s*([()])\s*/g, '$1').trim();
  const old = previous('require_task_score_before_done');
  assert.equal(old.file, '20260829110000_strict_fresh_task_score.sql');
  const legacy = definition(current, 'require_task_score_before_done')
    .replace('new.project_id is null and ', '');
  assert.equal(body(legacy), body(old.sql));
});
