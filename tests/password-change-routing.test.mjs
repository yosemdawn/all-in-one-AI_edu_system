import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRouter, createMemoryHistory } from 'vue-router';
import { createPasswordChangeGuard } from '../src/router/password-change.ts';

test('initial-password navigation reaches the change page without requesting protected menus', async () => {
  let mustChange = true;
  let menuLoads = 0;
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/dashboard', component: {} },
    { path: '/force-change-password', component: {} },
  ] });
  router.beforeEach(createPasswordChangeGuard(() => mustChange, (_to, _from, next) => {
    menuLoads++;
    next();
  }));
  await router.push('/dashboard');
  assert.equal(router.currentRoute.value.path, '/force-change-password');
  assert.equal(menuLoads, 0);
  mustChange = false;
  await router.push('/dashboard');
  assert.equal(router.currentRoute.value.path, '/dashboard');
  assert.equal(menuLoads, 1);
});

test('direct entry to the password-change page does not require role menus', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/force-change-password', component: {} },
  ] });
  router.beforeEach(createPasswordChangeGuard(() => true, () => {
    throw new Error('Protected menus must not be loaded during activation');
  }));
  await router.push('/force-change-password');
  assert.equal(router.currentRoute.value.path, '/force-change-password');
});
