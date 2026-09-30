import { execFileSync } from 'node:child_process';
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [];

function commandVersion(command, args = ['--version']) {
  try { return execFileSync(command, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim(); }
  catch { return null; }
}

const nodeVersion = Number(process.versions.node.split('.')[0]);
checks.push(['Node.js >= 22', nodeVersion >= 22, process.version]);
checks.push(['npm available', Boolean(commandVersion(process.platform === 'win32' ? 'npm.cmd' : 'npm')), commandVersion(process.platform === 'win32' ? 'npm.cmd' : 'npm') || 'missing']);
const pythonCommands = process.platform === 'win32' ? ['py', 'python'] : ['python3', 'python'];
let pythonVersion = null;
for (const cmd of pythonCommands) { pythonVersion = commandVersion(cmd, ['--version']); if (pythonVersion) break; }
const pyMatch = pythonVersion?.match(/(\d+)\.(\d+)/);
checks.push(['Python >= 3.12', Boolean(pyMatch && Number(pyMatch[1]) >= 3 && Number(pyMatch[2]) >= 12), pythonVersion || 'missing']);
checks.push(['FFmpeg available', Boolean(commandVersion(process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')), commandVersion(process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg') || 'missing']);
checks.push(['Deno >= 2.3', Boolean(commandVersion(process.platform === 'win32' ? 'deno.exe' : 'deno')), commandVersion(process.platform === 'win32' ? 'deno.exe' : 'deno') || 'missing']);
checks.push(['worker requirements file', fs.existsSync(path.join(root, 'worker', 'requirements.txt')), 'worker/requirements.txt']);
checks.push(['.env.local', fs.existsSync(path.join(root, '.env.local')), fs.existsSync(path.join(root, '.env.local')) ? 'present' : 'missing — copy .env.example']);

console.log('\nALL DOWNLOADER preflight\n');
for (const [name, ok, detail] of checks) console.log(`${ok ? '✓' : '✗'} ${name} — ${detail}`);
const hardFailures = checks.slice(0, 6).filter(([, ok]) => !ok);
if (hardFailures.length) {
  console.error('\nPreflight failed. Install the missing runtime(s), then rerun: npm run preflight');
  process.exit(1);
}
console.log('\nPreflight passed.');
