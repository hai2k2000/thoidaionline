import { loadDepartmentLeaderIds, hasGlobalPersonFilter } from './taskDepartmentLeaders.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { parseTaskListSearchParams } from './taskFilters.mjs';
const source=readFileSync('src/lib/taskRepository.ts','utf8');
const order=source.slice(source.indexOf('const applyTaskListOrder'),source.indexOf('export const taskRepository'));
const list=source.split('  async list(actor, query) {')[1].split('\n  async access(')[0].replace(/},\s*$/, '}');
const compiled=ts.transpileModule(order+'\nasync function list(actor, query) {'+list,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const expected={deadline:['list_closed','list_due_at','created_at','id'],newest:['created_at','id'],priority:['list_priority_rank','list_closed','list_due_at','created_at','id']};
for(const sort of Object.keys(expected)) for(const scope of ['all','assigned','personal','collaborating','department_collaborating','watching','cancelled']) test('repository order '+scope+'/'+sort,async()=>{
 const calls=[];
 const db={from(table){const q=new Proxy({},{get(_t,method){if(method==='then')return done=>done({data:table==='departments'?[{id:'dep',active:true,manager_id:'actor'}]:table==='task_assignees'?[{task_id:'task'}]:[],error:null,count:0});return(...args)=>{if(table==='tasks')calls.push([method,...args]);return q;};}});return q;}};
 const ok=data=>({ok:true,data});
 const run=new Function('loadDepartmentLeaderIds','hasGlobalPersonFilter','serverSupabase','getTaskScopeTerms','TASK_LIST_FIELDS','NON_JOURNALISM_TASK_FIELDS','ok','fail','isTaskListRangeExhausted','enrichJournalismList','enrichAssignmentApprovers',compiled+';return list;')(loadDepartmentLeaderIds,hasGlobalPersonFilter,db,async()=>ok([]),'id','id',ok,error=>({ok:false,error}),()=>false,async items=>ok(items),async items=>ok(items));
 const result=await run({id:'actor',permissions:{}},parseTaskListSearchParams(new URLSearchParams({scope,sort,page:'2'})));
 assert.equal(result.ok,true);
 assert.deepEqual(calls.filter(c=>c[0]==='order').map(c=>c.slice(1)),expected[sort].map(key=>[key,key==='list_due_at'?{ascending:true,nullsFirst:false}:{ascending:key!=='created_at'}]));
 assert.deepEqual(calls.at(-1),['range',25,49]);
});
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { taskListHref } from './taskFilters.mjs';
test('sort selector renders options and keeps filters, resets page, omits default',()=>{
 const shell=readFileSync('src/components/TaskCenterShell.tsx','utf8');
 const body=shell.slice(shell.indexOf('function FilterFields('),shell.indexOf('function SummaryItem('));
 const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
 const Filter=new Function('React','Link','JOURNALISM_UI_HIDDEN','taskListHref',js+';return FilterFields;')(React,'a',true,taskListHref);
 const query=parseTaskListSearchParams(new URLSearchParams('scope=watching&sort=priority&page=4&q=report&state=unfinished&projectId=none'));
 const tree=Filter({query,departments:[],journalismWorkKinds:[],journalismTopics:[],journalismSeries:[],canAccessJournalism:false,basePath:'/my-tasks'});
 const html=renderToStaticMarkup(tree);
 for(const label of ['Sắp xếp','Hạn hoàn thành gần nhất','Mới giao nhất','Ưu tiên cao nhất'])assert.ok(html.includes(label));
 const find=node=>{if(!node||typeof node!=='object')return null;if(node.type==='select'&&node.props['aria-label']==='Sắp xếp')return node;for(const child of React.Children.toArray(node.props?.children)){const match=find(child);if(match)return match;}return null;};
 globalThis.window={location:{href:''}};
 try {find(tree).props.onChange({target:{value:'deadline'}});const url=new URL(window.location.href,'http://local');assert.equal(url.pathname,'/my-tasks');for(const [key,value] of [['scope','watching'],['q','report'],['state','unfinished'],['projectId','none']])assert.equal(url.searchParams.get(key),value);assert.equal(url.searchParams.has('page'),false);assert.equal(url.searchParams.has('sort'),false);}finally{delete globalThis.window;}
});
