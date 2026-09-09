// Always allocate a disposable database; never honor an external TEST_MONGODB_URI.
const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('node:child_process');
const path = require('node:path');

async function main() {
  const mongo = await MongoMemoryServer.create({
    instance: { dbName: 'yosem_e2e' },
  });
  try {
    const child = spawn(
      process.execPath,
      [
        require.resolve('jest/bin/jest'),
        '--config',
        'test/jest-e2e.json',
        '--runInBand',
        ...process.argv.slice(2),
      ],
      {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          TEST_MONGODB_URI: mongo.getUri(),
          MONGODB_URI: '',
          REDIS_URL: '',
          DOUBAO_API_KEY: '',
        },
      },
    );
    process.exitCode = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code) => resolve(code ?? 1));
    });
  } finally {
    await mongo.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
