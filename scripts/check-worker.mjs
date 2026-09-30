import process from 'node:process';

const url = (process.env.MEDIA_WORKER_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const token = process.env.MEDIA_WORKER_TOKEN || '';

try {
  const response = await fetch(`${url}/health`, {
    headers: token ? { 'x-worker-token': token } : undefined,
    signal: AbortSignal.timeout(7000),
  });
  const data = await response.json().catch(() => ({}));
  console.log(JSON.stringify(data, null, 2));
  process.exit(response.ok ? 0 : 1);
} catch (error) {
  console.error(`Worker check failed: ${error instanceof Error ? error.message : String(error)}`);
  console.error(`Expected worker URL: ${url}`);
  process.exit(1);
}
