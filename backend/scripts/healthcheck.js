const port = process.env.PORT || '3000';
const url = `http://127.0.0.1:${port}/api/healthz`;

async function run() {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  const body = await response.json();
  if (body?.code !== 200 || body?.data?.ok !== true) {
    throw new Error('Health check payload is invalid');
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Health check failed');
  process.exit(1);
});
