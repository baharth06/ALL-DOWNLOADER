import { spawn } from 'node:child_process';
import process from 'node:process';

const isWindows = process.platform === 'win32';
const pythonCandidates = isWindows ? ['py', 'python'] : ['python3', 'python'];

function spawnLogged(command, args, name, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  child.on('error', (error) => {
    console.error(`[${name}] ${error.message}`);
  });
  return child;
}

const next = spawnLogged(process.execPath, ['node_modules/next/dist/bin/next', 'dev'], 'next');
let worker = null;
let pythonIndex = 0;

function startWorker() {
  const command = pythonCandidates[pythonIndex++];
  if (!command) {
    console.error('Python was not found. Install Python 3.12+ and worker dependencies first.');
    next.kill('SIGTERM');
    process.exit(1);
  }

  const args = ['-m', 'uvicorn', 'app.main:app', '--app-dir', 'worker', '--host', '127.0.0.1', '--port', '8000', '--reload'];
  worker = spawnLogged(command, args, 'worker', {
    env: {
      ...process.env,
      ENVIRONMENT: process.env.ENVIRONMENT || 'development',
      MEDIA_WORKER_TOKEN: process.env.MEDIA_WORKER_TOKEN || '',
      PUBLIC_WORKER_URL: process.env.PUBLIC_WORKER_URL || 'http://127.0.0.1:8000',
      ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
      PORT: '8000',
    },
  });

  worker.once('exit', (code) => {
    if (code === 0 || code === null) return;
    if (pythonIndex < pythonCandidates.length) {
      console.warn(`[worker] ${command} failed, trying ${pythonCandidates[pythonIndex]}...`);
      startWorker();
      return;
    }
    console.error('[worker] Could not start FastAPI. Run: python -m pip install -r worker/requirements.txt');
    next.kill('SIGTERM');
    process.exit(1);
  });
}

startWorker();

function shutdown(signal) {
  console.log(`\nStopping ALL DOWNLOADER (${signal})...`);
  if (worker && !worker.killed) worker.kill('SIGTERM');
  if (!next.killed) next.kill('SIGTERM');
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
