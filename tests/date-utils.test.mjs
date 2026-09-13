import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatDateTime, formatRelativeTime, isPastDate, isUrgent } from '../src/utils/date.ts';

test('date formatting preserves calendar years, leap days and invalid-value fallbacks', () => {
  assert.equal(formatDateTime('2024-02-29 08:05:09', 'yyyy/MM/dd HH:mm:ss'), '2024/02/29 08:05:09');
  assert.equal(formatDateTime('2023-01-01T00:00:00', 'yyyy年MM月dd日 HH:mm'), '2023年01月01日 00:00');
  assert.equal(formatDateTime('2023-02-29'), '--');
  assert.equal(formatDateTime('not a date'), '--');
  assert.equal(formatRelativeTime('not a date'), '--');
});

test('deadline boundaries are consistent and invalid deadlines do not expire', () => {
  const now = new Date('2026-09-13T00:00:00Z');
  assert.equal(isPastDate('2026-09-12T23:59:59Z', now), true);
  assert.equal(isPastDate(now, now), false);
  assert.equal(isPastDate('invalid', now), false);
  assert.equal(isUrgent('2026-09-14T00:00:00Z', now), true);
  assert.equal(isUrgent('2026-09-14T00:00:01Z', now), false);
  assert.equal(isUrgent(now, now), false);
  assert.equal(isUrgent('2026-09-12T23:59:59Z', now), false);
  assert.equal(isUrgent('invalid', now), false);
});

test('UTC timestamps display in the browser timezone, local form values retain their time', () => {
  const moduleUrl = pathToFileURL(resolve('src/utils/date.ts')).href;
  const code = `import {formatDateTime} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify([formatDateTime('2026-09-13T00:00:00Z'),formatDateTime('2026-09-13 08:30:00')]))`;
  for (const [TZ, expected] of [['Asia/Shanghai', '2026-09-13 08:00'], ['UTC', '2026-09-13 00:00']]) {
    const result = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', code], {
      env: { ...process.env, TZ, NODE_NO_WARNINGS: '1' }, encoding: 'utf8',
    });
    assert.deepEqual(JSON.parse(result), [expected, '2026-09-13 08:30']);
  }
});
