import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const actor = {id:'actor',role_code:'ctv',rbacPermissionScopes:{}};
async function load(path, deps) {
 const source=readFileSync(path,'utf8').replace(/import "server-only";/g,'').replace(/import type[^;]+;/g,'').replace(/import \{([^}]+)\} from [^;]+;/g,(_,names)=>`const {${names}} = globalThis.__projectDeps;`);
 globalThis.__projectDeps=deps;
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${Math.random()}`);
}
const apiError=(code,status)=>Response.json({error:{code}},{status});
const rpcFailure=e=>apiError('forbidden',e.code==='42501'?403:500);
const context={params:Promise.resolve({id:'00000000-0000-4000-8000-000000000001'})};
test('lead guard denies nonmembers, ordinary members and global administrators without lead role',async()=>{
 for(const role of ['ctv','admin','tong_bien_tap']) {
  const guards=await load('src/lib/projectApiGuards.ts',{apiError,rpcFailure,projectRepository:{listMembers:async()=>({ok:true,data:[{user_id:'actor',role:'member',staff_users:{active:true}}]})}});
  assert.equal((await guards.requireProjectLead({...actor,role_code:role},'project')).status,403);
 }
 const guards=await load('src/lib/projectApiGuards.ts',{apiError,rpcFailure,projectRepository:{listMembers:async()=>({ok:false,error:{code:'42501'}})}});
 assert.equal((await guards.requireProjectLead(actor,'project')).status,403);
});
test('lead guard accepts only active leads and create permission honors effective denies',async()=>{
 const guards=await load('src/lib/projectApiGuards.ts',{apiError,rpcFailure,projectRepository:{listMembers:async()=>({ok:true,data:[{user_id:'actor',role:'lead',staff_users:{active:true}}]})}});
 assert.equal(await guards.requireProjectLead(actor,'project'),null);
 assert.equal(guards.isProjectCreator({...actor,role_code:'admin'}),false);
 assert.equal(guards.isProjectCreator({...actor,rbacPermissionScopes:{'project.create':['all']}}),true);
});
test('assignment and member routes deny non-leads before calling a mutation RPC',async()=>{
 for(const [path,method] of [['tasks','POST'],['members','POST'],['members','DELETE']]){
  let calls=0;
  const route=await load(`src/app/api/projects/[id]/${path}/route.ts`,{apiError,rpcFailure,asUuid:v=>v,requireMutationActor:async()=>({ok:true,actor}),requireProjectLead:async()=>apiError('forbidden',403),projectRepository:{assignTask:()=>calls++,setMember:()=>calls++}});
  assert.equal((await route[method](new Request('http://localhost',{method,body:'{}'}),context)).status,403);assert.equal(calls,0);
 }
});
test('detail maps nonmember denial to 403',async()=>{
 const fail=async()=>({ok:false,error:{code:'42501'}});
 const route=await load('src/app/api/projects/[id]/route.ts',{apiError,rpcFailure,asUuid:v=>v,requireReadActor:async()=>({ok:true,actor}),projectReader:x=>x,projectRepository:{get:fail,listMembers:fail,listTasks:fail}});
 assert.equal((await route.GET(new Request('http://localhost'),context)).status,403);
});
test('project assignment validates dates, UUIDs and unsupported modes, preserving requirements',async()=>{
 const {parseProjectAssignment}=await load('src/lib/projectValidation.ts',{asUuid:value=>typeof value==='string'&&/^[0-9a-f-]{36}$/.test(value)?value:null});
 const id='00000000-0000-4000-8000-000000000001';const input={title:'Script',description:'Details',requirements:[' First ','Second'],assigneeId:id,reviewerId:id,dueDate:'2026-11-10',dueTime:'17:30',collaboratorIds:[id],watcherIds:[],priority:'high'};
 assert.equal(parseProjectAssignment(input).evaluationCriteria,'["First","Second"]');
 for(const patch of [{dueDate:'2026-02-30'},{dueTime:'25:00'},{reviewerId:'bad'},{collaboratorIds:['bad']},{priority:'bad'},{recurrenceFrequency:'daily'},{groupDepartmentId:id},{requirements:['x'.repeat(2001)]}]) assert.equal(parseProjectAssignment({...input,...patch}),null);
});
test('assignment passes current actor to RPC and returns task identity for attachment upload',async()=>{
 let called;
 const input={title:'Script',requirements:['One']};
 const route=await load('src/app/api/projects/[id]/tasks/route.ts',{apiError,rpcFailure,apiJson:(body,status)=>Response.json(body,{status}),asUuid:v=>v,requireMutationActor:async()=>({ok:true,actor}),requireProjectLead:async()=>null,readJsonObject:async()=>input,parseProjectAssignment:x=>x,projectRepository:{assignTask:async(...args)=>{called=args;return {ok:true,data:{id:'task'}};}}});
 const response=await route.POST(new Request('http://localhost'),context);assert.equal(response.status,201);assert.deepEqual(await response.json(),{task:{id:'task'}});assert.equal(called[0],'actor');assert.deepEqual(called[2],input);
});
test('origin and unauthenticated guard rejections stop mutation before project lookup',async()=>{
 for(const [file,method] of [['route.ts','POST'],['[id]/route.ts','PATCH'],['[id]/members/route.ts','POST'],['[id]/tasks/route.ts','POST']]) {
 const route=await load(`src/app/api/projects/${file}`,{requireMutationActor:async()=>({ok:false,response:apiError('invalid_origin',403)})});
 assert.equal((await route[method](new Request('http://localhost'),context)).status,403);
 }
});
test('creation returns partial membership failures with the created identity rather than allowing duplicate retries',async()=>{
 const id='00000000-0000-4000-8000-000000000001';let args;
 const route=await load('src/app/api/projects/route.ts',{apiError,rpcFailure,apiJson:(body,status)=>Response.json(body,{status}),requireMutationActor:async()=>({ok:true,actor}),isProjectCreator:()=>true,readJsonObject:async()=>({leadIds:['actor'],memberIds:[id]}),parseProject:()=>({code:'VIDEO',name:'Video',hostDepartmentId:id}),projectIds:x=>x,projectRepository:{options:async()=>({ok:true,data:{people:[{id:'actor'},{id}]}}),create:async()=>({ok:true,data:{id:'project'}}),setMember:async(...values)=>{args=values;return {ok:false,error:{code:'42501'}};}}});
 const response=await route.POST(new Request('http://localhost'));assert.equal(response.status,201);assert.deepEqual(await response.json(),{project:{id:'project'},failedMemberIds:[id]});assert.equal(args[0],'actor');
});
