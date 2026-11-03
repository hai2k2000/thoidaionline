import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { groupPermissions } from './approvalPermissionView.mjs';
import { supportedScopesForPermission } from './rbac/permissionScopes.mjs';
async function load(path,deps={}) {
 const source=readFileSync(path,'utf8').replace(/import "server-only";/g,'').replace(/import type[^;]+;/g,'').replace(/import \{([^}]+)\} from [^;]+;/g,(_,names)=>`const {${names}} = globalThis.__v12Deps;`);
 globalThis.__v12Deps=deps;
 return import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')}#${Math.random()}`);
}
const apiError=(error,status)=>Response.json({error},{status});
const apiJson=(body,status=200)=>Response.json(body,{status});
test('project creation is grouped and grants use only all scope',()=>{
 assert.equal(groupPermissions([{code:'project.create'}])[0].key,'project');
 assert.deepEqual(supportedScopesForPermission('project.create'),['all']);
});
test('admin bypasses both membership guards while CTV never creates even with stale grants',async()=>{
 const guards=await load('src/lib/projectApiGuards.ts',{apiError,projectRepository:{listMembers:()=>assert.fail('admin must not need membership')}});
 assert.equal(await guards.requireProjectLead({role_code:'admin'},'p'),null);
 assert.equal(await guards.requireProjectLeadOrDeputy({role_code:'admin'},'p'),null);
 assert.equal(guards.isProjectCreator({role_code:'cong_tac_vien',rbacPermissionScopes:{'project.create':['all']}}),false);
});
test('create adds creator as lead even when request omits leads',async()=>{
 let input;
 const route=await load('src/app/api/projects/route.ts',{apiError,apiJson,requireMutationActor:async()=>({ok:true,actor:{id:'creator'}}),isProjectCreator:()=>true,readJsonObject:async()=>({}),parseProject:()=>({name:'Project'}),projectIds:x=>x,projectRepository:{options:async()=>({ok:true,data:{people:[{id:'creator'}]}}),create:async(_,value)=>{input=value;return {ok:true,data:{id:'p'}};}}});
 assert.equal((await route.POST(new Request('http://localhost'))).status,201);
 assert.deepEqual(input.leadIds,['creator']);
});
test('transfer route validates role and uses authenticated actor for atomic RPC',async()=>{
 let args;
 const route=await load('src/app/api/projects/[id]/transfer-lead/route.ts',{apiError,apiJson,asUuid:x=>x,requireMutationActor:async()=>({ok:true,actor:{id:'actor'}}),requireProjectLead:async()=>null,readJsonObject:async()=>({userId:'target',ownRole:'deputy'}),projectRepository:{transferLead:async(...values)=>{args=values;return {ok:true,data:{}};}}});
 assert.equal((await route.POST(new Request('http://localhost'),{params:Promise.resolve({id:'p'})})).status,200);
 assert.deepEqual(args,['actor','p','target','deputy']);
});
test('permission UI hides project grant for collaborators and shows its description',()=>{
 const source=readFileSync('src/components/permissions/OtherPermissionsSection.tsx','utf8');
 assert.match(source,/user.role_code.*cong_tac_vien/);
 assert.match(source,/permission.description/);
});
