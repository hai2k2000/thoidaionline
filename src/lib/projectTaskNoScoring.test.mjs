import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const read = (path) => readFileSync(path, 'utf8');
test('project detail hides scoring and offers score-free completion', () => {
  const ui = read('src/components/TaskDetailShell.tsx');
  assert.match(ui, /!projectTask && capabilities.review \? <Section/);
  assert.match(ui, /!projectTask && task.completion_score/);
  assert.match(ui, /projectTask \? "Chờ duyệt"/);
  assert.match(ui, /decision: "approve"/);
});
test('project task list suppresses score summaries and scoring links', () => {
  const ui = read('src/components/TaskCenterShell.tsx');
  assert.match(ui, /task.project_id \? "—" : task.completion_score/);
  assert.match(ui, /!task.project_id && <><SummaryItem label="Đánh giá"/);
});
test('project completion bypasses only the project score gate and rejects scoring writes', () => {
  const sql = read('supabase/migrations/20261103200000_projects_v1_2_permissions.sql');
  assert.match(sql, /new.project_id is null[\s\S]*new.status='done'/);
  assert.match(sql, /Project tasks cannot be scored/);
  assert.match(sql, /v_before.project_id is not null or v_before.approval_required/);
});

test('project detail never queries scoring tables and returns empty compatible fields', async () => {
  const queried = [];
  const task = { id: 'task', project_id: 'project', task_type: 'assigned', task_assignees: [] };
  const serverSupabase = { from(table) {
    queried.push(table);
    const result = { data: table === 'tasks' ? task : [], error: null };
    const chain = new Proxy({}, { get: (_, key) => key === 'then' ? Promise.resolve(result).then.bind(Promise.resolve(result)) : () => chain });
    return chain;
  } };
  globalThis.__projectDetailDeps = { serverSupabase, resolveTaskCompatibility: () => ({}), selectAssignmentApprovalActor: () => null };
  const source = read('src/lib/taskRepository.ts').replace(/import "server-only";/g, '').replace(/import type[\s\S]*?;/g, '').replace(/import \{([\s\S]*?)\} from [^;]+;/g, (_, names) => `const {${names.replace(/\btype\s+\w+,?/g, '')}} = globalThis.__projectDetailDeps;`);
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { taskRepository } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  const result = await taskRepository.detail('task');
  assert.equal(result.ok, true);
  assert.equal(result.data.completion_score, null);
  assert.equal(result.data.effort_weight, null);
  assert.deepEqual(result.data.legacy_evaluations, []);
  assert.deepEqual(result.data.qualitative_evaluations, []);
  for (const table of ['task_completion_scores', 'task_evaluation_checkpoints', 'task_qualitative_evaluations']) assert.equal(queried.includes(table), false, table);
  for (const table of ['task_comments', 'task_attachments', 'task_status_events', 'task_progress_reports']) assert.equal(queried.includes(table), true, table);
  delete globalThis.__projectDetailDeps;
});
