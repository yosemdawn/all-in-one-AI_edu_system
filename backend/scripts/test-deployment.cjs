// Isolated acceptance test. Never selects the normal Compose project or existing volumes.
const { spawnSync, spawn } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const temporary = mkdtempSync(path.join(tmpdir(), 'yosem-deployment-'));
const project = `yosem-acceptance-${randomBytes(5).toString('hex')}`;
const envFile = path.join(temporary, 'test.env');
const overlay = path.join(temporary, 'override.yml');
const secret = () => randomBytes(32).toString('hex');
writeFileSync(envFile, `MONGO_ROOT_PASSWORD=${secret()}\nMONGO_APP_PASSWORD=${secret()}\nREDIS_PASSWORD=${secret()}\nJWT_SECRET=${secret()}\nCORS_ORIGINS=http://localhost\nAI_REVIEW_REQUIRED=true\nENABLE_DEMO_SEED=false\nDOUBAO_BASE_URL=http://127.0.0.1:1\nDOUBAO_API_KEY=\n`);
writeFileSync(overlay, `services:
  backend:
    image: ${project}-backend
    env_file: !override [${JSON.stringify(envFile.replaceAll('\\', '/'))}]
  frontend:
    image: ${project}-frontend
    ports: !override ["127.0.0.1::80"]
`);
const prefix = ['compose', '-p', project, '--env-file', envFile, '-f', path.join(root, 'docker-compose.yml'), '-f', overlay];
function compose(...args) {
  const result = spawnSync('docker', [...prefix, ...args], { cwd: root, encoding: 'utf8', timeout: 120000 });
  if (result.status !== 0) throw new Error(`Compose ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
}
async function command(args) {
  await new Promise((resolve, reject) => {
    const child = spawn('docker', [...prefix, ...args], { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Compose ${args[0]} failed (${code})`)));
  });
}
const node = script => compose('exec', '-T', 'backend', 'node', '-e', script);
async function main() {
  try {
    const config = JSON.parse(compose('config', '--format', 'json'));
    assert.equal(config.services.mongo.ports, undefined);
    assert.equal(config.services.redis.ports, undefined);
    assert.equal(config.services.backend.ports, undefined);
    assert(config.services.backend.volumes.some(v => v.target === '/app/uploads' && v.type === 'volume'));
    console.log('PASS: production database ports are private; uploads use a named volume');
    await command(['up', '-d', '--build', '--wait', '--wait-timeout', '180']);
    const address = compose('port', 'frontend', '80');
    const base = `http://${address}/api`;
    async function api(url, options, expected = 200) {
      const response = await fetch(base + url, { ...options, signal: AbortSignal.timeout(7000) });
      const body = await response.json();
      assert.equal(response.status, expected, `${url}: ${body.message || 'unexpected HTTP status'}`);
      return body;
    }
    await api('/readyz');
    const mongoNoAuth = compose('exec', '-T', 'mongo', 'mongosh', '--quiet', '--eval', "try { db.getSiblingDB('yosem_ai').users.findOne(); quit(2); } catch(e) { if(e.code !== 13) quit(3); print('unauthorized'); }");
    assert(mongoNoAuth.includes('unauthorized'));
    assert(compose('exec', '-T', 'redis', 'redis-cli', 'ping').includes('NOAUTH'));
    console.log('PASS: unauthenticated database access denied; application credentials and readiness work');
    const credentials = { username: 'deployment-teacher', role: 'teacher', password: secret() };
    const registration = await api('/v1/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...credentials, confirmPassword: credentials.password }) }, 201);
    const token = registration.data.token;
    const post = (url, body, access = token) => api(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${access}` }, body: JSON.stringify(body) }, 201);
    const createdClass = (await post('/classes/create', { name: 'Deployment acceptance' })).data;
    const classItem = (await api(`/classes/${createdClass.classId}`, { headers: { authorization: `Bearer ${token}` } })).data;
    const student = (await post('/v1/auth/register', { username: 'deployment-student', role: 'student', password: credentials.password, confirmPassword: credentials.password })).data;
    await post('/classes/join', { code: classItem.code }, student.token);
    const assignment = (await post('/teacher/assignments', { title: 'Recovery', description: 'Local failure test', classes: [classItem._id], startDate: new Date(Date.now() - 60000).toISOString(), endDate: new Date(Date.now() + 86400000).toISOString() })).data;
    await post(`/teacher/assignments/${assignment.id}/status`, { status: 'published' });
    let acceptedSubmission;

    node("const { Queue } = require('bullmq'); const q = new Queue('teacher-tools', { connection: { url: process.env.REDIS_URL } }); q.pause().then(() => q.close());");
    const form = new FormData();
    form.append('standardAnswers', JSON.stringify({ '1': 'A' }));
    form.append('answerCards', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'acceptance.png');
    const uploaded = await api('/teacher/tools/objective-grading/tasks', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form }, 201);
    const fileHash = () => node("const fs=require('fs'),c=require('crypto'); const d='/app/uploads/teacher-tools/objective-grading'; const files=fs.readdirSync(d); if(files.length!==1)process.exit(2); console.log(c.createHash('sha256').update(fs.readFileSync(d+'/'+files[0])).digest('hex'));");
    const hash = fileHash();
    await command(['up', '-d', '--no-deps', '--force-recreate', '--wait', '--wait-timeout', '120', 'backend']);
    assert.equal(fileHash(), hash);
    node("const { Queue } = require('bullmq'); const q = new Queue('teacher-tools', { connection: { url: process.env.REDIS_URL } }); q.resume().then(() => q.close());");
    await api('/readyz');
    const taskId = uploaded.data.id || uploaded.data._id;
    assert(taskId);
    let resumed = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const task = (await api(`/teacher/tools/tasks/${taskId}`, { headers: { authorization: `Bearer ${token}` } })).data;
      if (task.status !== 'queued') { resumed = true; break; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert(resumed, 'Persisted upload task resumed after backend recreation');

    console.log('PASS: multipart upload and queued job survive backend container recreation');
    for (const dependency of ['redis', 'mongo']) {
      compose('stop', dependency);
      await api('/healthz');
      await api('/readyz', undefined, 503);
      if (dependency === 'redis') {
        acceptedSubmission = (await post('/students/submissions/submit', { assignmentId: assignment.id, classId: classItem._id, content: 'An answer retained during Redis outage' }, student.token)).data;
        assert.equal(acceptedSubmission.submissionCount, 1);
        assert.equal(acceptedSubmission.status, 'submitted');
        assert.equal(acceptedSubmission.aiReviewMetadata.queueStatus, 'queued');
        console.log('PASS: real Redis outage accepts submission without consuming another attempt');
      }

      console.log(`PASS: ${dependency} outage produces readiness 503 while liveness stays 200`);
      await command(['up', '-d', '--wait', '--wait-timeout', '90', dependency]);
      let restored = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        const res = await fetch(base + '/readyz', { signal: AbortSignal.timeout(5000) });
        if (res.status === 200) { restored = true; break; }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      assert(restored, `${dependency} readiness recovery`);
      if (dependency === 'redis') {
        let recovered = false;
        for (let attempt = 0; attempt < 60; attempt++) {
          const detail = (await api(`/teachers/submissions/detail/${acceptedSubmission.id}`, { headers: { authorization: `Bearer ${token}` } })).data;
          assert.equal(detail.submissionCount, 1);
          if (detail.status === 'ai_review_failed') { recovered = true; break; }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        assert(recovered, 'Persisted dispatch was delivered; missing local AI key becomes terminal failure');
        const retried = (await post('/teachers/submissions/retry-ai', { submissionId: acceptedSubmission.id, revision: acceptedSubmission.revision })).data;
        assert.equal(retried.submissionCount, 1);
        assert.equal(retried.revision, acceptedSubmission.revision + 1);
        console.log('PASS: real queue resumes dispatch/retries and teacher retry preserves submission count');
      }

    }
    console.log('PASS: dependency recovery restores readiness');
  } finally {
    console.log(`Cleaning isolated project ${project}`);
    compose('down', '--volumes', '--remove-orphans', '--rmi', 'local');
    // Verify the exact generated temporary directory before recursive cleanup.
    if (path.dirname(temporary) !== path.resolve(tmpdir()) || !path.basename(temporary).startsWith('yosem-deployment-')) throw new Error('Unsafe temporary path');
    rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
