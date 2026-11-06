import assert from 'node:assert/strict';
import test from 'node:test';
import { withPushActor } from './actorFetch.mjs';
import { createClient } from '@supabase/supabase-js';

test('Supabase RPC remains lazy and chainable and kicks after a successful response', async () => {
  let requests = 0; let kicks = 0;
  const actor = '11111111-1111-4111-8111-111111111111';
  const client = createClient('https://local.invalid', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: withPushActor(async (_url, init) => {
      requests++;
      assert.equal(init.headers.get('x-thoidai-push-actor'), actor);
      assert.match(init.headers.get('accept'), /object/);
      return new Response(JSON.stringify({ id: 'task' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }, () => { kicks++; }) },
  });
  const query = client.rpc('api_assign_task_v2', { p_actor_id: actor }).single();
  assert.equal(requests, 0);
  assert.equal(kicks, 0);
  const result = await query;
  assert.equal(result.error, null);
  assert.deepEqual(result.data, { id: 'task' });
  assert.equal(requests, 1);
  assert.equal(kicks, 1);
});

test('server RPC actor hint is request-local and preserves the business arguments', async () => {
  const calls = [];
  const fetcher = withPushActor(async (url, init) => { calls.push(init); return { ok: true }; });
  const headers = { apikey: 'test-only' };
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  await Promise.all([a,b].map(actor => fetcher('https://local.invalid/rest/v1/rpc/api_assign_task_v2', {
    method: 'POST', headers, body: JSON.stringify({ p_actor_id: actor, p_title: 'Task' }),
  })));
  assert.deepEqual(calls.map(call => call.headers.get('x-thoidai-push-actor')), [a,b]);
  assert.equal(headers['x-thoidai-push-actor'], undefined);
  assert.equal(JSON.parse(calls[0].body).p_actor_id, a);
  await fetcher('https://local.invalid/rest/v1/tasks', { method: 'POST', headers, body: JSON.stringify({ p_actor_id: a }) });
  assert.equal(calls[2].headers, headers);
});

test('successful notification mutations kick; failures and dispatcher claims do not', async () => {
  let kicks = 0; let success = true;
  const fetcher = withPushActor(async () => ({ ok: success }), () => { kicks++; });
  const mutations = ['api_assign_task_v2','api_assign_task_batch_v1','api_admin_set_task_participants',
    'api_add_task_comment','api_submit_assigned_task_completion','api_review_assigned_task_completion',
    'api_review_task_completion','api_approve_task_claim','api_assign_project_task',
    'api_assign_department_plan_task_v2','api_assign_journalism_task_v1','api_save_monthly_duty_roster'];
  for (const name of mutations) await fetcher(`https://local.invalid/rest/v1/rpc/${name}`, { method: 'POST', body: '{}' });
  assert.equal(kicks, mutations.length);
  success = false;
  await fetcher('https://local.invalid/rest/v1/rpc/api_add_task_comment', { method: 'POST', body: '{}' });
  success = true;
  await fetcher('https://local.invalid/rest/v1/rpc/claim_push_notifications', { method: 'POST', body: '{}' });
  await fetcher('https://local.invalid/rest/v1/rpc/api_add_task_comment', { method: 'GET' });
  assert.equal(kicks, mutations.length);
});
