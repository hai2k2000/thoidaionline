import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { parseTaskRequirements, serializeAdminRequirements } from './taskRequirements.ts';
import { createTaskApplication } from './taskHandlerFactory.ts';
import { isCollaboratorAllowedApiPath } from './collaboratorRole.mjs';

test('requirements parser and serializer retain JSON content and order', () => {
  const values = ['first', '"quoted"\ntext', 'last'];
  assert.deepEqual(parseTaskRequirements(serializeAdminRequirements(values)), values);
});
test('plain text, multiline text, malformed JSON and non-array JSON remain visible', () => {
  assert.deepEqual(parseTaskRequirements('  Legacy  '), ['Legacy']);
  assert.deepEqual(parseTaskRequirements(' first\n\n second\r\nthird '), ['first', 'second', 'third']);
  for (const text of ['[invalid', '[1,"a"]', '{"a":1}']) assert.deepEqual(parseTaskRequirements(text), [text]);
  assert.deepEqual(parseTaskRequirements(''), []);
  assert.deepEqual(parseTaskRequirements(null), []);
  assert.deepEqual(parseTaskRequirements(undefined), []);
  assert.deepEqual(parseTaskRequirements('   '), []);
  assert.deepEqual(parseTaskRequirements('[" first ", "", " ", "second"]'), ['first', 'second']);
  for (const text of ['null', '123', 'true', '"text"']) assert.deepEqual(parseTaskRequirements(text), [text]);
});
test('no silent truncation, assignment limits and empty initial state', () => {
  assert.equal(parseTaskRequirements(JSON.stringify(Array(51).fill('a'))).length, 51);
  assert.throws(() => serializeAdminRequirements(Array(51).fill('a')));
  assert.throws(() => serializeAdminRequirements(['x'.repeat(2001)]));
  assert.throws(() => serializeAdminRequirements(Array(6).fill('x'.repeat(2000))));
  assert.equal(JSON.parse(serializeAdminRequirements(Array(50).fill('a'))).length, 50);
  assert.equal(serializeAdminRequirements([' first ', '', '  second  ']), '["first","second"]');
  assert.throws(() => serializeAdminRequirements(['', '   ']));
});

test('admin editor edits and submits all requirements for normal and project tasks', async () => {
  const source = readFileSync(new URL('../components/AdminTaskEditForm.tsx', import.meta.url), 'utf8');
  assert.match(source, /parseTaskRequirements\(task\.evaluation_criteria\)/);
  assert.match(source, /body\.evaluationCriteria = serializeAdminRequirements\(criteria\)/);
  assert.doesNotMatch(source, /parseAdminRequirements|mode === ["']legacy|criteria\.text/);
  assert.match(source, /Yêu cầu công việc/);
  assert.equal(serializeAdminRequirements([]), '[]');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  for (const project_id of [null, 'project']) {
    for (const existing of ['["first","second"]', 'first\nsecond']) {
      const states = []; let cursor = 0; let payload;
      const jsx = (type, props) => ({ type, props });
      const context = {
        exports: {},
        require(name) {
          if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
          if (name === 'react') return { useState(initial) {
            const index = cursor++;
            if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
            return [states[index], value => { states[index] = value; }];
          } };
          if (name === 'next/navigation') return { useRouter: () => ({ push() {}, refresh() {} }) };
          if (name.endsWith('taskRequirements')) return { parseTaskRequirements, serializeAdminRequirements, MAX_TASK_REQUIREMENTS: 50 };
          if (name.endsWith('ActionFeedbackProvider')) return { useActionFeedback: () => ({ notify() {} }) };
          if (name.endsWith('actionFeedback')) return { errorMessage: error => error.message };
          return { default: () => null };
        },
        FormData: class { get() { return ''; } },
        fetch: async (url, options) => { payload = JSON.parse(options.body); return { ok: true }; },
      };
      vm.runInNewContext(compiled, context);
      const render = () => { cursor = 0; return context.exports.default({ task: { id: 'task', project_id, evaluation_criteria: existing } }); };
      function nodes(node) {
        if (!node || typeof node !== 'object') return [];
        if (Array.isArray(node)) return node.flatMap(nodes);
        return [node, ...nodes(node.props?.children)];
      }
      const tree = render();
      const inputs = nodes(tree).filter(node => node.type === 'input' && node.props['aria-label']);
      assert.equal(inputs.length, 2);
      inputs[0].props.onChange({ target: { value: 'edited first' } });
      await render().props.onSubmit({ preventDefault() {}, currentTarget: {} });
      assert.deepEqual(JSON.parse(payload.evaluationCriteria), ['edited first', 'second']);
    }
  }
});

test('every task evaluation criteria display reader uses the shared parser', () => {
  const files = [
    '../components/TaskDetailShell.tsx',
    '../components/TaskCenterShell.tsx',
    '../components/TaskDetailModal.tsx',
    './taskPrintModel.ts',
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /parseTaskRequirements\(task\.evaluation_criteria\)/ , file);
    assert.doesNotMatch(source, /JSON\.parse\([^\n]*evaluation_criteria/, file);
    assert.doesNotMatch(source, /\{task\.evaluation_criteria\s*\|\|/, file);
  }
});
const taskId='11111111-1111-4111-8111-111111111111';
const attachmentId='22222222-2222-4222-8222-222222222222';
function application({ role='admin', dbError=null, storageFails=false, status='done' }={}) {
  const calls=[];
  return { calls, app: createTaskApplication({
    mutationActor: async()=>({ok:true,actor:{id:'actor',role_code:role}}),
    asUuid: value => typeof value==='string' && /^[a-f0-9-]{36}$/.test(value)?value:null,
    json:(body,status=200)=>Response.json(body,{status}),
    error:(code,status)=>Response.json({code},{status}),
    rpcFailure:error=>Response.json(error,{status:error.code==='P0002'?404:409}),
    repository:{
      deleteAttachment:async(actor,task,attachment,reason)=>{ calls.push(['delete',actor,task,attachment,reason]);return dbError?{ok:false,error:{code:dbError}}:{ok:true,data:{storage_path:'safe/key'}}; },
      access:async()=>({ok:true,data:{status}}),
      addAttachmentMetadata:async()=>({ok:true,data:{id:attachmentId}}),
    },
    removePrivateAttachment:async path=>{calls.push(['storage',path]);if(storageFails)throw new Error('storage failed');},
    uploadPrivateAttachment:async()=>({ok:true}),newUuid:()=>attachmentId,
    canTaskAction:()=>false,taskRbacEnabled:true,taskRbacBaseAllowed:async()=>false,
  }) };
}
const request=body=>new Request('https://example.test',{method:'DELETE',body:JSON.stringify(body)});
test('DELETE rejects non-admin before touching DB or storage',async()=>{const {app,calls}=application({role:'cong_tac_vien'});assert.equal((await app.deleteAttachment(request({reason:'x'}),taskId,attachmentId)).status,403);assert.deepEqual(calls,[]);});
test('DELETE requires nonblank bounded reason',async()=>{for(const reason of [undefined,' ','x'.repeat(2001)]){const {app,calls}=application();assert.equal((await app.deleteAttachment(request({reason}),taskId,attachmentId)).status,400);assert.deepEqual(calls,[]);}});
test('DELETE wrong task is 404 and never removes storage',async()=>{const {app,calls}=application({dbError:'P0002'});assert.equal((await app.deleteAttachment(request({reason:'x'}),taskId,attachmentId)).status,404);assert.equal(calls.length,1);});
test('DELETE commits authorized DB tombstone before storage and reports storage failure for retry',async()=>{for(const storageFails of [false,true]){const {app,calls}=application({storageFails});assert.equal((await app.deleteAttachment(request({reason:' correction '}),taskId,attachmentId)).status,storageFails?503:200);assert.deepEqual(calls,[['delete','actor',taskId,attachmentId,'correction'],['storage','safe/key']]);}});
test('admin uploads on completed task even when ordinary capability is denied; cancelled is blocked',async()=>{for(const status of ['done','cancelled']){const {app}=application({status});const form=new FormData();form.set('file',new File(['pdf'],'file.pdf',{type:'application/pdf'}));const response=await app.uploadAttachment(new Request('https://example.test',{method:'POST',body:form}),taskId);assert.equal(response.status,status==='done'?201:403);}});
test('CTV allowlist never permits attachment DELETE',()=>{assert.equal(isCollaboratorAllowedApiPath(`/api/tasks/${taskId}/attachments/${attachmentId}`,'DELETE'),false);});
import { readFileSync } from 'node:fs';
test('attachment migration keeps admin-only RPC and tombstone retry contract', () => {
  const sql=readFileSync('supabase/migrations/20261106130000_admin_task_attachment_delete.sql','utf8');
  for(const token of ['security definer','r.active',"r.code='admin'",'for update','source_attachment_id=p_attachment_id','deleted_at=now()','admin_delete','revoke all','from public,anon,authenticated','to service_role','owner to postgres',"notify pgrst,'reload schema'"]) assert.ok(sql.includes(token),token);
  assert.match(sql,/if v_attachment\.deleted_at is not null then return v_attachment/);
  assert.doesNotMatch(sql,/create policy|delete from public\.task_attachments/i);
});
test('dryrun uses isolated backup restore and real behavior, replay, revert gates',()=>{
  const source=readFileSync('scripts/production/admin-task-attachment-delete-dryrun.sh','utf8');
  for(const token of ['THOIDAI_ADMIN_ATTACHMENT_DELETE_DRYRUN_APPROVED','docker run','pg_restore','disk_guard_require','sha256sum','safe-apply-migration.sh','step=behaviour','step=idempotency','step=revert','step=reapply']) assert.ok(source.includes(token),token);
  const behavior=readFileSync('supabase/tests/admin_task_attachment_delete_behaviour.sql','utf8');
  assert.doesNotMatch(behavior,/disable trigger|session_replication_role/i);
  assert.match(behavior,/set constraints all immediate/);
});
