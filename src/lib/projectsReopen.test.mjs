import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const read = path => existsSync(path) ? readFileSync(path, 'utf8') : '';
const migration = 'supabase/migrations/20261105100000_projects_reopen.sql';

test('reopen RPC locks, authorizes, rejects active state, audits and restricts execution', () => {
  const sql = read(migration);
  assert.match(sql, /function public\.api_reopen_project\(p_actor_id uuid,p_project_id uuid\) returns public\.projects/);
  for (const pattern of [/security definer set search_path=public,pg_temp/, /for update/i, /errcode='P0002'/, /api_project_is_lead\(p_actor_id,p_project_id\)/, /errcode='42501'/, /Project is already active\./, /errcode='55000'/, /status='active',closed_at=null,updated_at=now\(\)/, /'reopen',to_jsonb\(v\)/, /from public,anon,authenticated/, /to service_role/, /owner to postgres/]) assert.match(sql, pattern);
  assert.doesNotMatch(sql, /(?:create or replace|drop) function public\.api_close_project/);
  assert.match(read('src/lib/projectRepository.ts'), /reopen:.*rpc<Project>\("api_reopen_project", \{ p_actor_id: actorId, p_project_id: projectId \}\)/);
});

test('status control requires explicit acknowledgement and accessible cancellation', () => {
  const ui = read('src/components/ProjectStatusControl.tsx');
  for (const pattern of [/role="dialog"/, /aria-modal="true"/, /aria-labelledby=/, /aria-describedby=/, /showModal\(\)/, /cancelRef\.current\?\.focus\(\)/, /onCancel=/, /type="checkbox"/, /checked=\{acknowledged\}/, /disabled=\{busy \|\| \(!reopening && !acknowledged\)\}/, /Tôi hiểu và muốn đóng dự án này/, /Hủy/, /Mở lại dự án/, /Đóng dự án/, /Asia\/Ho_Chi_Minh/, /vi-VN/, /router\.refresh\(\)/, /role="alert"/, /Dự án đang hoạt động/]) assert.match(ui, pattern);
  assert.doesNotMatch(ui, /chỉ đọc/);
  const shell = read('src/components/ProjectDetailShell.tsx');
  assert.match(shell, /import ProjectStatusControl from/);
  assert.match(shell, /isLead\?<ProjectStatusControl project=\{project\} disabled=\{busy\}\/>/);
  assert.doesNotMatch(shell, /action:\s*['"]close['"]/);
});

test('closed projects remain reachable in the existing all-status list', () => {
  assert.match(read('src/components/ProjectsGrid.tsx'), /<option value="closed">Đã đóng<\/option>/);
  const list = read('src/lib/projectRepository.ts').split('async list(actor:')[1].split('async get(')[0];
  assert.doesNotMatch(list, /\.eq\("status"/);
});

async function loadRoute(deps) {
  const source = read('src/app/api/projects/[id]/route.ts').replace(/import \{([^}]+)\} from [^;]+;/g, (_, names) => `const {${names}} = globalThis.__reopenDeps;`);
  globalThis.__reopenDeps = deps;
  return import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}#${Math.random()}`);
}
test('PATCH reopen dispatches the actor and project, preserves guards and RPC conflicts', async () => {
  for (const mode of ['success', 'conflict', 'denied', 'origin']) {
    let calls = 0;
    const apiError = (code, status) => Response.json({ error: { code } }, { status });
    const route = await loadRoute({ apiError, apiJson: Response.json, asUuid: x => x,
      requireMutationActor: async () => mode === 'origin' ? { ok: false, response: apiError('invalid_origin', 403) } : { ok: true, actor: { id: 'actor' } },
      requireProjectLead: async () => mode === 'denied' ? apiError('forbidden', 403) : null,
      readJsonObject: async () => ({ action: 'reopen' }), parseProject: () => null,
      rpcFailure: e => { assert.equal(e.code, '55000'); return apiError('conflict', 409); },
      projectRepository: { reopen: async (...args) => { calls++; assert.deepEqual(args, ['actor', 'project']); return mode === 'conflict' ? { ok: false, error: { code: '55000' } } : { ok: true, data: { id: 'project', status: 'active' } }; } }
    });
    const response = await route.PATCH(new Request('http://localhost'), { params: Promise.resolve({ id: 'project' }) });
    assert.equal(response.status, mode === 'success' ? 200 : mode === 'conflict' ? 409 : 403);
    assert.equal(calls, ['success', 'conflict'].includes(mode) ? 1 : 0);
  }
});
