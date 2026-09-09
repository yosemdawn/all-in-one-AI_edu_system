import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTaskPoller } from '../src/views/teacher/tools/task-poller.ts';
import { progressPercent } from '../src/views/teacher/tools/shared.ts';

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function deferred() { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

test('slow polls never overlap, and terminal results stop refreshing', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = deferred();
  let calls = 0;
  const updates = [];
  const poller = createTaskPoller({ fetchTask: () => { calls++; return calls === 1 ? pending.promise : Promise.resolve({ status: 'completed' }); }, onUpdate: task => updates.push(task.status), onError: () => assert.fail() });
  poller.start('one');
  t.mock.timers.tick(30000); await flush();
  assert.equal(calls, 1);
  pending.resolve({ status: 'processing' }); await flush();
  t.mock.timers.tick(3000); await flush();
  t.mock.timers.tick(30000); await flush();
  assert.equal(calls, 2);
  assert.deepEqual(updates, ['processing', 'completed']);
  poller.stop();
});

test('transient failure backs off and recovers; permission failures stop', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const errors = [];
  const updates = [];
  const poller = createTaskPoller({ fetchTask: async () => {
    calls++;
    if (calls === 1) throw new Error('offline');
    if (calls === 2) return { status: 'processing' };
    throw { response: { status: 403 } };
  }, onUpdate: task => updates.push(task.status), onError: fatal => errors.push(fatal) });
  poller.start('one'); await flush();
  t.mock.timers.tick(5999); await flush(); assert.equal(calls, 1);
  t.mock.timers.tick(1); await flush(); assert.equal(calls, 2);
  t.mock.timers.tick(3000); await flush();
  t.mock.timers.tick(60000); await flush();
  assert.equal(calls, 3);
  assert.deepEqual(errors, [false, true]);
  assert.deepEqual(updates, ['processing']);
  poller.stop();
});

test('changing tasks or leaving the page aborts and ignores late responses', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const first = deferred(); const second = deferred();
  const updates = []; const signals = [];
  const poller = createTaskPoller({ fetchTask: (id, signal) => { signals.push(signal); return id === 'old' ? first.promise : second.promise; }, onUpdate: task => updates.push(task), onError: () => assert.fail() });
  poller.start('old'); poller.start('new');
  assert.equal(signals[0].aborted, true);
  first.resolve({ status: 'completed' }); await flush();
  assert.equal(updates.length, 0);
  poller.stop();
  second.resolve({ status: 'processing' }); await flush();
  t.mock.timers.tick(60000); await flush();
  assert.equal(signals[1].aborted, true);
  assert.equal(updates.length, 0);
});

test('progress represents completed work and stays between zero and 100', () => {
  assert.equal(progressPercent({ totalCount: 10, processedCount: 0 }), 0);
  assert.equal(progressPercent({ totalCount: 10, processedCount: 3 }), 30);
  assert.equal(progressPercent({ totalCount: 2, processedCount: 3 }), 100);
  assert.equal(progressPercent({ totalCount: 0, processedCount: 0 }), 0);
});
