import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { canTaskAction } from '../lib/authorization.ts';
import { normalizePermissions } from '../lib/permissions.ts';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('./TaskDetailShell.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function loadShell() {
  const deps = {
    'next/link': { default: ({ children, href }) => React.createElement('a', { href }, children) },
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/lib/auth': { useAuth: () => ({ user: { id: 'owner', role_code: 'nhan_vien' }, logout() {} }) },
    '@/components/ActionFeedbackProvider': { useActionFeedback: () => ({ notify() {} }) },
    '@/components/ConfirmDialog': { useConfirm: () => () => {}, usePromptDialog: () => () => {} },
    '@/lib/taskRequirements': { parseTaskRequirements: () => [] },
  };
  const exports = {};
  new Function('require', 'exports', compiled)((name) => {
    if (deps[name]) return deps[name];
    if (name.startsWith('@/components/')) return { default: () => null, FilePreviewList: () => null };
    if (name.startsWith('@/lib/')) {
      if (name.endsWith('.mjs')) return require('../lib/' + name.slice('@/lib/'.length));
      if (name === '@/lib/actionFeedback') return {};
    }
    return require(name);
  }, exports);
  return exports.default;
}
const Shell = loadShell();
const base = {
  id: 'task', title: 'Task', task_type: 'assigned', task_category: 'regular', workflow_type: 'STANDARD',
  due_date: null, due_time: null, status: 'done', description: '', evaluation_criteria: null,
  task_assignees: [], attachments: [], links: [], comments: [], status_events: [], deadline_history: [], progress_logs: [], qualitative_evaluations: [],
  progress_reports: [{ id: 'report', reported_on: '2026-11-13', report_status: 'in_progress', progress_text: 'Nội dung đã bàn giao', blockers: 'Vướng mắc cũ', reporter: { full_name: 'Nguyễn An' } }],
};
for (const project_id of [null, 'project']) for (const status of ['done', 'pending_review', 'cancelled']) {
  test('history and result form respect status and viewer role: ' + project_id + '/' + status, () => {
    for (const assignmentRole of ['owner', 'assignee', 'watcher']) {
      const snapshot = { id: 'task', taskType: 'assigned', projectId: project_id, status, ownerId: 'other', assigneeId: 'other', participants: [{ userId: 'viewer', assignmentRole }] };
      const report = canTaskAction({ id: 'viewer', roleCode: 'nhan_vien', permissions: normalizePermissions({}) }, snapshot, 'report');
      const html = renderToStaticMarkup(React.createElement(Shell, { task: { ...base, project_id, status }, capabilities: { report }, journalismStructureOptions: { topics: [], series: [] } }));
      for (const text of ['Nội dung đã bàn giao', 'Vướng mắc cũ', 'Nguyễn An', '13']) assert.ok(html.includes(text), text);
      if (status === 'done') assert.ok(html.includes('Cập nhật kết quả'));
      assert.equal(html.includes('<form'), status !== 'cancelled' && assignmentRole !== 'watcher');
      if (report) assert.match(html, /<select[^>]*disabled/);
    }
  });
}
