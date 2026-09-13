// Creates a fresh configuration only. Existing environments require migration.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const backend = path.resolve(__dirname, '..');
let template = fs.readFileSync(path.join(backend, '.env.production.example'), 'utf8');
for (const key of ['MONGO_ROOT_PASSWORD', 'MONGO_APP_PASSWORD', 'REDIS_PASSWORD', 'JWT_SECRET', 'AI_KEY_ENCRYPTION_SECRET']) {
  template = template.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${randomBytes(32).toString('hex')}`);
}
fs.writeFileSync(path.join(backend, '.env.production'), template, { flag: 'wx', mode: 0o600 });
console.log('Created backend/.env.production. Set CORS_ORIGINS before deployment; keep this file private.');
