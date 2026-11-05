import assert from 'node:assert/strict';
import test from 'node:test';
import { createPushScheduler } from './scheduler.mjs';
import { kickPushDispatcher } from './kick.mjs';

function fixture(dispatch, enabled = () => true) {
  let callback; let timers = 0;
  const scheduler = createPushScheduler({ dispatch, enabled, schedule: (fn, delay) => {
    assert.equal(delay, 250); callback = fn; timers++; return { unref() {} };
  } });
  return { scheduler, fire: () => callback(), timers: () => timers };
}
test('kick coalesces a burst into a single dispatch after 250ms', async () => {
  let runs = 0; const f = fixture(async () => { runs++; });
  f.scheduler.kick(); f.scheduler.kick(); f.scheduler.kick();
  assert.equal(runs, 0); assert.equal(f.timers(), 1);
  await f.fire(); assert.equal(runs, 1);
});
test('kick and interval never overlap and a kick during a run is retained', async () => {
  let release; let runs = 0; let active = 0; let peak = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture(async () => { runs++; peak = Math.max(peak, ++active); if (runs === 1) await gate; active--; });
  const tick = f.scheduler.tick();
  f.scheduler.kick(); await f.scheduler.tick();
  assert.equal(runs, 1); release(); await tick;
  await f.fire(); assert.equal(runs, 2); assert.equal(peak, 1);
});
test('disabled kick/tick does not schedule or dispatch', async () => {
  let runs = 0; const f = fixture(async () => { runs++; }, () => false);
  f.scheduler.kick(); await f.scheduler.tick();
  assert.equal(runs, 0); assert.equal(f.timers(), 0);
});

test('a debounce firing during an interval dispatch retains its follow-up', async () => {
  let release; let runs = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture(async () => { if (++runs === 1) await gate; });
  f.scheduler.kick();
  const interval = f.scheduler.tick();
  await f.fire();
  assert.equal(runs, 1);
  release(); await interval;
  assert.equal(f.timers(), 2);
  await f.fire(); assert.equal(runs, 2);
});

test('exported kick is disabled by default and shares the process scheduler', () => {
  const old = process.env.PUSH_DISPATCH_ENABLED; const previous = globalThis.thoidaiPushScheduler;
  let kicks = 0;
  try {
    globalThis.thoidaiPushScheduler = { kick: () => { kicks++; } };
    delete process.env.PUSH_DISPATCH_ENABLED; kickPushDispatcher(); assert.equal(kicks, 0);
    process.env.PUSH_DISPATCH_ENABLED = '1'; kickPushDispatcher(); assert.equal(kicks, 1);
  } finally {
    if (old === undefined) delete process.env.PUSH_DISPATCH_ENABLED; else process.env.PUSH_DISPATCH_ENABLED = old;
    globalThis.thoidaiPushScheduler = previous;
  }
});
