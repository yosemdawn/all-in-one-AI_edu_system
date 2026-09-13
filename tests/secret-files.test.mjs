import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

function removeFixture(fixture) {
  const target = realpathSync(fixture);
  assert.equal(dirname(target), realpathSync(tmpdir()));
  assert.ok(/^edu-(secret-guard|env-init)-/.test(basename(target)));
  rmSync(target, { recursive: true, force: true });
}

test('secret file guard rejects staged configuration and permits templates and untracked configuration', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'edu-secret-guard-'));
  const script = resolve('scripts/check-secret-files.mjs');
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: fixture });
    mkdirSync(join(fixture, 'backend'));
    writeFileSync(join(fixture, 'backend/.env.production'), 'JWT_SECRET=test-only\n');
    writeFileSync(join(fixture, 'backend/.env.production.example'), 'JWT_SECRET=\n');
    execFileSync('git', ['add', 'backend/.env.production.example'], { cwd: fixture });
    assert.equal(spawnSync(process.execPath, [script], { cwd: fixture }).status, 0);
    execFileSync('git', ['add', 'backend/.env.production'], { cwd: fixture });
    const rejected = spawnSync(process.execPath, [script], { cwd: fixture, encoding: 'utf8' });
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /backend\/\.env\.production/);
    assert.ok(!rejected.stderr.includes('test-only'));
  } finally {
    removeFixture(fixture);
  }
});

test('new production configuration uses independent secrets and refuses to overwrite existing configuration', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'edu-env-init-'));
  try {
    mkdirSync(join(fixture, 'scripts'));
    copyFileSync(resolve('backend/scripts/init-production-env.cjs'), join(fixture, 'scripts/init-production-env.cjs'));
    writeFileSync(join(fixture, '.env.production.example'), ['MONGO_ROOT_PASSWORD', 'MONGO_APP_PASSWORD', 'REDIS_PASSWORD', 'JWT_SECRET', 'AI_KEY_ENCRYPTION_SECRET'].map(k => k + '=').join('\n'));
    const script = join(fixture, 'scripts/init-production-env.cjs');
    assert.equal(spawnSync(process.execPath, [script]).status, 0);
    const original = readFileSync(join(fixture, '.env.production'), 'utf8');
    const values = original.split('\n').map(line => line.split('=')[1]);
    assert.equal(new Set(values).size, 5);
    assert.ok(values.every(value => /^[a-f0-9]{64}$/.test(value)));
    assert.notEqual(spawnSync(process.execPath, [script]).status, 0);
    assert.equal(readFileSync(join(fixture, '.env.production'), 'utf8'), original);
  } finally {
    removeFixture(fixture);
  }
});
