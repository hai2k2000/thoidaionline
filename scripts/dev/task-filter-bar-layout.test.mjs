import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as taskFilters from '../../src/lib/taskFilters.mjs';
import * as journalismUi from '../../src/lib/journalismUi.mjs';
import * as collaboratorPicker from '../../src/lib/taskCollaboratorPicker.mjs';
import * as participantPosition from '../../src/components/participantPanelPosition.mjs';
import { JOURNALISM_UI_HIDDEN } from '../../src/lib/journalismUiHidden.mjs';

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const source = read('src/components/TaskCenterShell.tsx');
const compilerOptions = { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS };
const dependencies = { '@/lib/taskFilters.mjs': taskFilters, '@/lib/taskCollaboratorPicker.mjs': collaboratorPicker, './participantPanelPosition.mjs': participantPosition };
// Load the real closed controls and hooks without a browser or generated modules on disk.
function loadComponent(name) {
  const js = ts.transpileModule(read(`src/components/${name}.tsx`), { compilerOptions }).outputText;
  const componentModule = { exports: {} };
  new Function('require', 'module', 'exports', js)((id) => dependencies[id] ?? require(id), componentModule, componentModule.exports);
  dependencies[`@/components/${name}`] = componentModule.exports;
  return componentModule.exports.default;
}
loadComponent('ParticipantSelector');
const PersonFilter = loadComponent('PersonFilter');
const TaskFilterPopover = loadComponent('TaskFilterPopover');
const body = source.slice(source.indexOf('function FilterFields('), source.indexOf('function SummaryItem('));
const js = ts.transpileModule(body, { compilerOptions: { ...compilerOptions, jsx: ts.JsxEmit.React } }).outputText;
const FilterFields = new Function('React', 'Link', 'useState', 'TaskFilterPopover', 'PersonFilter', 'taskListHref', 'JOURNALISM_UI_HIDDEN', 'journalismLabels', 'journalismPublicationStatusLabel', `${js};return FilterFields;`)(React, require('next/link').default, React.useState, TaskFilterPopover, PersonFilter, taskFilters.taskListHref, JOURNALISM_UI_HIDDEN, journalismUi.journalismLabels, journalismUi.journalismPublicationStatusLabel);
const formClass = source.match(/<form id="task-filter-form"[^>]*className="([^"]+)"/)[1];
const parseQuery = (params = '') => taskFilters.parseTaskListSearchParams(new URLSearchParams(params));
function renderBar(overrides = {}) {
  const props = { query: parseQuery(), departments: [], personOptions: [], canFilterByPerson: true, journalismWorkKinds: [], journalismTopics: [], journalismSeries: [], canAccessJournalism: false, canReviewTaskApprovals: false, ...overrides };
  return renderToStaticMarkup(React.createElement('form', { id: 'task-filter-form', action: props.basePath ?? '/tasks', className: formClass }, React.createElement(FilterFields, props)));
}
// React escapes attribute values, so tags in this static form can be walked directly.
function parseMarkup(html) {
  const root = { children: [] }, stack = [root];
  for (const match of html.matchAll(/<(\/)?([a-z][\w-]*)([^>]*)>/gi)) {
    if (match[1]) { stack.pop(); continue; }
    const attrs = Object.fromEntries([...match[3].matchAll(/([\w-]+)="([^"]*)"/g)].map((attr) => [attr[1], attr[2]]));
    const node = { tag: match[2], attrs, children: [], parent: stack.at(-1) };
    node.parent.children.push(node);
    if (!['input', 'br', 'hr', 'img', 'link', 'meta'].includes(node.tag)) stack.push(node);
  }
  return root.children[0];
}
const hasClass = (node, name) => (node.attrs.class ?? '').split(/\s+/).includes(name);
const isItem = (node) => 'data-filter-item' in node.attrs;
const walk = (node) => [node, ...node.children.flatMap(walk)];
const fixtures = [
  {},
  { canFilterByPerson: false },
  { basePath: '/my-tasks', query: parseQuery('scope=watching&from=2026-11-01&to=2026-11-30&assignmentSource=self_registered&projectId=none&sort=priority') },
  { basePath: '/duty-schedule', taskMode: true },
  { query: parseQuery('personId=22222222-2222-4222-8222-222222222222'), personOptions: [{ id: '22222222-2222-4222-8222-222222222222', fullName: 'Example Person', username: 'example', departmentName: 'Example Department' }] },
];

test('real filter markup has only item, search, and action wrappers as direct children', () => {
  for (const fixture of fixtures) {
    const form = parseMarkup(renderBar(fixture));
    for (const child of form.children) {
      assert.ok(isItem(child) || hasClass(child, 'task-filter-search') || hasClass(child, 'task-filter-actions'), `Unwrapped direct child: ${child.tag} ${JSON.stringify(child.attrs)}`);
      assert.ok(!hasClass(child, 'w-full'), 'Full-width controls must be nested inside wrappers');
    }
    assert.equal(form.children.filter((node) => hasClass(node, 'task-filter-search')).length, 1);
    const actions = form.children.filter((node) => hasClass(node, 'task-filter-actions'));
    assert.equal(actions.length, 1);
    assert.deepEqual(actions[0].children.map((node) => node.tag), ['button', 'a']);
  }
});

test('real popover and person triggers remain inside individual filter items', () => {
  for (const fixture of fixtures) {
    const form = parseMarkup(renderBar(fixture));
    const triggers = walk(form).filter((node) => node.attrs['aria-haspopup']);
    assert.equal(triggers.length, fixture.canFilterByPerson === false ? 2 : 3);
    for (const trigger of triggers) {
      let item = trigger;
      while (item.parent !== form) item = item.parent;
      assert.ok(isItem(item), `Unwrapped trigger: ${trigger.attrs['aria-label']}`);
      assert.equal(walk(item).filter((node) => node.attrs['aria-haspopup']).length, 1);
    }
  }
});

test('emit the real filter form and production layout CSS as a static dev snapshot', () => {
  const css = read('src/app/globals.css');
  const layoutCss = css.slice(css.lastIndexOf('/* Keep each filter'));
  assert.ok(layoutCss.includes('.task-filter-bar > [data-filter-item]'));
  assert.doesNotMatch(layoutCss, /\.task-filter-bar\s*>\s*(?:button|a\b|\*)/);
  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Task filter bar - static development snapshot</title>
<script src="https://cdn.tailwindcss.com/3.4.16"></script>
<style>
body{margin:0;background:#f8fafc;color:#0f172a;font-family:"Segoe UI",sans-serif;font-size:15px;line-height:1.5}
main{width:100%;max-width:1240px;margin:24px auto}
${layoutCss}
</style></head><body><main>
<!-- Dev-only static render, no hydration. Resize to 1180/1220/1240, 768, and 390px. Uses the production fallback font; the Next-hosted font is not embedded. -->
${renderBar()}
</main></body></html>`;
  writeFileSync(new URL('./task-filter-bar-snapshot.html', import.meta.url), html);
});
