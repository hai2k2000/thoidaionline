import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTaskListSearchParams, taskListHref } from './taskFilters.mjs';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { hasGlobalPersonFilter, loadDepartmentLeaderIds } from './taskDepartmentLeaders.mjs';

test('person selection survives pagination and sorting and rejects malformed ids', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const query = parseTaskListSearchParams(new URLSearchParams({personId: id, sort: 'priority'}));
  assert.equal(query.personId, id);
  assert.match(taskListHref(query, {page: 2}), /personId=11111111-1111-4111-8111-111111111111/);
  assert.doesNotMatch(taskListHref(query, {personId: null}), /personId=/);
  assert.equal(parseTaskListSearchParams(new URLSearchParams('personId=invalid')).personId ?? null, null);
});

test('person picker selects and clears one person while retaining sort and scope', () => {
  const source = readFileSync('src/components/PersonFilter.tsx', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export default function', 'function');
  const js = ts.transpileModule(source, {compilerOptions: {jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022}}).outputText;
  const Component = new Function('React','useState','ParticipantSelector','taskListHref',js+';return PersonFilter;')(React, () => [null, () => {}], 'picker', taskListHref);
  const id = '11111111-1111-4111-8111-111111111111';
  const query = parseTaskListSearchParams(new URLSearchParams({personId: id, sort: 'priority', scope: 'watching', page: '4'}));
  const tree = Component({query, basePath: '/my-tasks', people: [{id, fullName: 'Thanh Hai', username: 'hai', departmentName: 'Editorial'}]});
  const children = React.Children.toArray(tree.props.children);
  assert.equal(children[0].props.panel, 'collaborator');
  assert.equal(children[0].props.label, 'Nhân sự');
  assert.match(renderToStaticMarkup(children[1]), /name="personId"/);
  globalThis.window = {location: {href: ''}};
  try {
    children[0].props.onChange([id, '22222222-2222-4222-8222-222222222222']);
    let url = new URL(window.location.href, 'http://local');
    assert.equal(url.searchParams.get('personId'), '22222222-2222-4222-8222-222222222222');
    assert.equal(url.searchParams.get('sort'), 'priority');
    React.Children.toArray(children[1].props.children)[2].props.onClick();
    url = new URL(window.location.href, 'http://local');
    assert.equal(url.pathname, '/my-tasks');
    assert.equal(url.searchParams.has('personId'), false);
    assert.equal(url.searchParams.has('page'), false);
    assert.equal(url.searchParams.get('scope'), 'watching');
  } finally { delete globalThis.window; }
});

test('repository ignores personId for ordinary staff and intersects person roles with viewer scope', async () => {
  const source = readFileSync('src/lib/taskRepository.ts', 'utf8');
  const order = source.slice(source.indexOf('const applyTaskListOrder'), source.indexOf('export const taskRepository'));
  const list = source.split('  async list(actor, query) {')[1].split('\n  async access(')[0].replace(/},\s*$/, '}');
  const js = ts.transpileModule(order+'\nasync function list(actor, query) {'+list,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const id = '11111111-1111-4111-8111-111111111111';
  for (const role of ['admin','tong_bien_tap','pho_tong_bien_tap','deputy','employee']) {
    const calls=[];
    const db={from(table){const q=new Proxy({}, {get(_t,method){if(method==='then')return done=>done({data:table==='departments'?[{id:'dept',active:true,manager_id:'manager'}]:table==='staff_users'?{active:true,department_id:'dept',roles:{code:role==='deputy'?'pho_truong_phong':'nhan_vien',active:true}}:[],error:null,count:0});return(...args)=>{calls.push([table,method,...args]);return q;};}});return q;}};
    const ok=data=>({ok:true,data});
    const run=new Function('serverSupabase','getTaskScopeTerms','TASK_LIST_FIELDS','NON_JOURNALISM_TASK_FIELDS','ok','fail','isTaskListRangeExhausted','enrichJournalismList','enrichAssignmentApprovers','loadDepartmentLeaderIds','hasGlobalPersonFilter',js+';return list;')(db,async()=>ok(['assignee_id.eq.viewer']),'id','id',ok,error=>({ok:false,error}),()=>false,async items=>ok(items),async items=>ok(items),loadDepartmentLeaderIds,hasGlobalPersonFilter);
    assert.equal((await run({id:'viewer',roleCode:role,permissions:{}},parseTaskListSearchParams(new URLSearchParams({personId:id})))).ok,true);
    const predicates=calls.filter(([table,method])=>table==='tasks'&&method==='or').map(call=>call[2]);
    assert.deepEqual(predicates,role==='employee'?['assignee_id.eq.viewer']:['assignee_id.eq.viewer',`assignee_id.eq.${id},owner_id.eq.${id},person_filter.not.is.null`]);
    assert.equal(calls.some(([table])=>table==='task_assignees'),false);
  }
});

test('repository applies the person predicate after viewer scope and unions direct and participant roles', () => {
  const source = readFileSync('src/lib/taskRepository.ts', 'utf8');
  const body = source.slice(source.indexOf('if (query.personId)'), source.indexOf('if (query.journalism === "exclude"'));
  assert.match(body, /assignee_id\.eq/);
  assert.match(body, /owner_id\.eq/);
  assert.match(body, /task_assignees/);
  assert.match(body, /loadDepartmentLeaderIds/);
});
