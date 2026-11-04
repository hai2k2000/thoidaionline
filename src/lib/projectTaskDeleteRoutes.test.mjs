import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { canDeleteCancelledProjectTasks } from './projectTaskDelete.mjs';

async function load(file, deps = {}) {
  const source = readFileSync(file, 'utf8').replace(/import "server-only";/g, '').replace(/import \{([^}]+)\} from [^;]+;/g, (_, names) => `const {${names}}=deps;`);
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; new Function('deps', 'exports', compiled)(deps, exports); return exports;
}
const { mapRpcError } = await load('src/lib/rpcErrorMapping.ts');
const id = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const context = { params: Promise.resolve({ id }) };
const json = (data, status = 200) => Response.json(data, { status });
const request = body => new Request('http://localhost/api', { method: 'DELETE', body: JSON.stringify(body) });
async function setup({ code, storage, denied } = {}) {
  const calls = [];
  const deps = {
    apiJson: json, apiError: (error, status) => json({ error }, status),
    asUuid: v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v) ? v : null,
    readJsonObject: async r => { const b = await r.json().catch(() => null); return b && typeof b === 'object' && !Array.isArray(b) ? b : null; },
    requireMutationActor: async () => denied ? { ok: false, response: json({}, denied) } : { ok: true, actor: { id } },
    rpcFailure: error => { const mapped = mapRpcError(error); return json({ error: mapped.code }, mapped.status); },
    projectRepository: { deleteCancelledTasks: async (...args) => { calls.push(['delete', ...args]); return code ? { ok: false, error: { code } } : { ok: true, data: { deleted: 2, storage_paths: ['a.pdf', 'b.pdf'] } }; } },
    serverSupabase: { storage: { from: bucket => { assert.equal(bucket, 'task-private'); return { remove: async paths => { calls.push(['remove', paths]); if (storage === 'throw') throw new Error('private detail'); return { error: storage === 'error' ? { message: 'private detail' } : null }; } }; } } },
  };
  return { route: await load('src/app/api/projects/[id]/tasks/route.ts', deps), calls };
}
test('permission gate only allows active leads on open projects or admins in cancelled view', () => {
  for (const role of ['lead', 'deputy', 'member']) for (const active of [true, false]) for (const status of ['active', 'closed']) for (const filter of ['', 'cancelled', 'done']) {
    const input = { actorRole: 'nhan_vien', actorId: id, projectStatus: status, statusFilter: filter, members: [{ user_id: id, role, staff_users: { active } }] };
    assert.equal(canDeleteCancelledProjectTasks(input), role === 'lead' && active && status === 'active' && filter === 'cancelled');
    assert.equal(canDeleteCancelledProjectTasks({ ...input, actorRole: 'admin', members: [] }), filter === 'cancelled');
  }
});
test('DELETE rejects invalid body, UUIDs and bounds before RPC', async () => {
  const { route, calls } = await setup();
  for (const body of [null, [], {}, { taskIds: [] }, { taskIds: [null] }, { taskIds: ['bad'] }, { taskIds: [id, 42] }, { taskIds: Array(101).fill(id) }]) assert.equal((await route.DELETE(request(body), context)).status, 400);
  assert.equal((await route.DELETE(request({ taskIds: [id] }), { params: Promise.resolve({ id: 'bad' }) })).status, 400);
  assert.equal((await route.DELETE(new Request('http://localhost', { method: 'DELETE', body: '{' }), context)).status, 400);
  assert.deepEqual(calls, []);
});
test('DELETE honors mutation guard and maps SQL errors without touching storage', async () => {
  for (const denied of [401, 403]) { const { route, calls } = await setup({ denied }); assert.equal((await route.DELETE(request({ taskIds: [id] }), context)).status, denied); assert.deepEqual(calls, []); }
  for (const [code, status] of [['42501', 403], ['22023', 400], ['55000', 409]]) {
    const { route, calls } = await setup({ code }); assert.equal((await route.DELETE(request({ taskIds: [id] }), context)).status, status); assert.equal(calls.length, 1);
  }
});
test('DELETE uses actor/project/ids and cleans storage only after successful RPC', async () => {
  const { route, calls } = await setup(); const response = await route.DELETE(request({ taskIds: [id, second] }), context);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { deleted: 2, storageWarnings: 0 });
  assert.deepEqual(calls, [['delete', id, id, [id, second]], ['remove', ['a.pdf', 'b.pdf']]]);
});
test('returned storage errors and thrown cleanup errors preserve successful DB deletion', async () => {
  for (const storage of ['error', 'throw']) {
    const { route } = await setup({ storage }); const response = await route.DELETE(request({ taskIds: [id, second] }), context);
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { deleted: 2, storageWarnings: 2 });
  }
});
test('repository forwards exact RPC args and sanitizes error result', async () => {
  const calls = []; let error = null;
  const { projectRepository } = await load('src/lib/projectRepository.ts', { serverSupabase: { rpc: async (...args) => { calls.push(args); return { data: { deleted: 1, storage_paths: [] }, error }; } } });
  assert.deepEqual(await projectRepository.deleteCancelledTasks(id, second, [id]), { ok: true, data: { deleted: 1, storage_paths: [] } });
  assert.deepEqual(calls[0], ['api_delete_cancelled_project_tasks', { p_actor_id: id, p_project_id: second, p_task_ids: [id] }]);
  error = { code: '42501', message: 'private detail' };
  assert.deepEqual(await projectRepository.deleteCancelledTasks(id, second, [id]), { ok: false, error: { code: '42501' } });
});
