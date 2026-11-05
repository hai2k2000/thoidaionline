import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import ts from 'typescript';
import { parseTaskListSearchParams, taskListHref } from '../lib/taskFilters.mjs';
import { journalismLabels, journalismPublicationStatusLabel } from '../lib/journalismUi.mjs';

const source = readFileSync('src/components/TaskCenterShell.tsx', 'utf8');
const body = source.slice(source.indexOf('function FilterFields('), source.indexOf('function SummaryItem('));
const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
const parse = (params) => parseTaskListSearchParams(new URLSearchParams(params), { journalismUiHidden: false });
const fixture = 'q=report&scope=watching&type=assigned&category=duty&status=in_progress&state=unfinished&from=2026-10-01&to=2026-11-30&deadline=overdue&department=11111111-1111-4111-8111-111111111111&personId=22222222-2222-4222-8222-222222222222&projectId=none&journalism=only&approvalQueue=assignment&assignmentSource=self_registered&sort=priority&workKind=33333333-3333-4333-8333-333333333333&topicId=44444444-4444-4444-8444-444444444444&seriesId=55555555-5555-4555-8555-555555555555&publicationStatus=scheduled&plannedFrom=2026-10-01&plannedTo=2026-12-31&page=4&pageSize=50';
function harness(overrides = {}, hidden = false) {
  const state = [];
  let cursor = 0;
  const useState = (initial) => {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], (next) => { state[index] = next; }];
  };
  const Filter = new Function('React', 'Link', 'JOURNALISM_UI_HIDDEN', 'taskListHref', 'useState', 'TaskFilterPopover', 'PersonFilter', 'journalismLabels', 'journalismPublicationStatusLabel', js + ';return FilterFields;')(React, 'a', hidden, taskListHref, useState, 'popover', 'person', journalismLabels, journalismPublicationStatusLabel);
  const props = { query: parse(fixture), departments: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Editorial' }], journalismWorkKinds: [], journalismTopics: [], journalismSeries: [], canAccessJournalism: true, canReviewTaskApprovals: true, canSeeDepartmentCollaborating: true, ...overrides };
  return () => { cursor = 0; return Filter(props); };
}
function nodes(tree, predicate, descendPanels = true) {
  if (!tree || typeof tree !== 'object') return [];
  const result = predicate(tree) ? [tree] : [];
  if (!descendPanels && tree.type === 'popover') return result;
  for (const child of React.Children.toArray(tree.props?.children)) result.push(...nodes(child, predicate, descendPanels));
  return result;
}
const byLabel = (tree, label) => nodes(tree, (node) => node.props['aria-label'] === label)[0];
function submitted(tree) {
  const params = new URLSearchParams();
  for (const node of nodes(tree, (node) => ['input', 'select'].includes(node.type) && node.props.name)) {
    if (!node.props.disabled) params.append(node.props.name, node.props.value ?? node.props.defaultValue ?? '');
  }
  return parseTaskListSearchParams(params, { journalismUiHidden: false });
}
test('all pre-change URL params round-trip through the closed form, resetting only page', () => {
  for (const basePath of ['/tasks', '/my-tasks']) {
    const tree = harness({ basePath })();
    assert.deepEqual(submitted(tree), { ...parse(fixture), page: 1 });
    const names = nodes(tree, (node) => ['input', 'select'].includes(node.type) && node.props.name).map((node) => node.props.name);
    assert.equal(new Set(names).size, names.length);
    assert.equal(nodes(tree, (node) => node.type === 'a')[0].props.href, basePath);
  }
});
test('scope options preserve old tab patches and role/route gates', () => {
  globalThis.window = { location: { href: '' } };
  try {
    const query = parse(fixture);
    const select = byLabel(harness()(), 'Phạm vi công việc');
    for (const [value, patch] of [['approval:assignment', { approvalQueue: 'assignment' }], ['approval:completion', { approvalQueue: 'completion' }], ['collaborating', { scope: 'collaborating', taskType: null, approvalQueue: null }], ['department_collaborating', { scope: 'department_collaborating', taskType: null, approvalQueue: null }], ['journalism:exclude', { journalism: 'exclude' }], ['journalism:only', { journalism: 'only' }]]) {
      select.props.onChange({ target: { value } });
      assert.equal(window.location.href, taskListHref(query, { ...patch, page: 1 }));
    }
    for (const props of [{ canReviewTaskApprovals: false, canSeeDepartmentCollaborating: false }, { basePath: '/my-tasks', canSeeDepartmentCollaborating: false }, { taskMode: true, canSeeDepartmentCollaborating: false }]) {
      const options = nodes(byLabel(harness(props)(), 'Phạm vi công việc'), (node) => node.type === 'option').map((node) => node.props.value);
      assert.ok(!options.includes('approval:assignment'));
      assert.ok(!options.includes('approval:completion'));
      assert.ok(!options.includes('department_collaborating'));
    }
    const options = nodes(byLabel(harness({ canAccessJournalism: false })(), 'Phạm vi công việc'), (node) => node.type === 'option').map((node) => node.props.value);
    assert.ok(options.includes('approval:assignment'));
    assert.ok(!options.includes('journalism:only'));
  } finally { delete globalThis.window; }
});
test('date changes and clear update the existing from/to inputs while closed', () => {
  const render = harness();
  byLabel(render(), 'Từ ngày').props.onChange({ target: { value: '2026-11-05' } });
  byLabel(render(), 'Đến ngày').props.onChange({ target: { value: '2026-11-08' } });
  assert.equal(submitted(render()).fromDate, '2026-11-05');
  assert.equal(submitted(render()).toDate, '2026-11-08');
  nodes(render(), (node) => node.type === 'button' && node.props.children === 'Xóa')[0].props.onClick();
  assert.equal(submitted(render()).fromDate, null);
  assert.equal(submitted(render()).toDate, null);
});
test('extra panel owns source/department and badge reflects draft values', () => {
  const render = harness({}, true);
  const panel = () => nodes(render(), (node) => node.type === 'popover' && node.props.label === 'Lọc thêm')[0];
  assert.equal(panel().props.count, 2);
  assert.ok(byLabel(panel(), 'Hình thức'));
  assert.ok(byLabel(panel(), 'Phòng'));
  byLabel(panel(), 'Hình thức').props.onChange({ target: { value: '' } });
  assert.equal(panel().props.count, 1);
  assert.equal(submitted(render()).assignmentSource, undefined);
  byLabel(panel(), 'Phòng').props.onChange({ target: { value: '' } });
  assert.equal(panel().props.count, 0);
  assert.equal(submitted(render()).departmentId, null);
  assert.equal(nodes(harness()(), (node) => node.type === 'popover' && node.props.label === 'Lọc thêm')[0].props.count, 8);
});
test('one responsive block follows approved control order and hides removed tab row', () => {
  assert.equal((source.match(/<form /g) ?? []).length, 1);
  assert.doesNotMatch(source, /aria-label="Loại công việc"|tabClass|placeholder="Tìm theo tên công việc"/);
  const tree = harness({ canFilterByPerson: true })();
  const actions = nodes(tree, (node) => node.props.className?.split(" ").includes("task-filter-actions"));
  assert.equal(actions.length, 1);
  assert.deepEqual(React.Children.toArray(actions[0].props.children).map((node) => node.type), ['button', 'a']);
  const controls = nodes(tree, (node) => node.type === 'select' || node.type === 'person' || node.type === 'popover' || node.props.name === 'q', false).map((node) => node.props['aria-label'] ?? node.props.label ?? node.type);
  assert.deepEqual(controls, ['Phạm vi công việc', 'Tìm kiếm công việc', 'person', 'Dự án', 'Trạng thái', 'Thời hạn', 'Khoảng ngày', 'Sắp xếp', 'Lọc thêm']);
});
test('popover uses fixed portal and handles outside click, Escape and focus restoration', () => {
  const popover = readFileSync('src/components/TaskFilterPopover.tsx', 'utf8');
  assert.match(popover, /createPortal/);
  assert.match(popover, /position: "fixed"/);
  assert.match(popover, /panel\.current\?\.contains/);
  assert.match(popover, /event\.key === "Escape"/);
  assert.match(popover, /trigger\.current\?\.focus\(\)/);
  assert.match(popover, /aria-expanded=\{open\}/);
  assert.match(popover, /window\.removeEventListener\("scroll"/);
});
