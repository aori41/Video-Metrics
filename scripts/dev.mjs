import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { backendDir, frontendDir, isWindows, venvPython } from './paths.mjs';

function fail(message) {
  console.error(message);
  process.exit(1);
}

const REQUIRED_PATHS = [
  venvPython,
  join(backendDir, '.env'),
  join(frontendDir, '.env'),
  join(frontendDir, 'node_modules'),
];

if (!REQUIRED_PATHS.every(existsSync)) fail('The project is not set up. Run: npm run setup');

function readBackendPort() {
  const env = readFileSync(join(backendDir, '.env'), 'utf8');
  const port = env.match(/^PORT=(\d+)\s*$/m)?.[1];
  if (!port) fail('Set PORT in backend/.env.');
  return port;
}

const children = [];
let isStopping = false;

function killTree({ pid }) {
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    // The process has already exited.
  }
}

function stopAll(exitCode) {
  if (isStopping) return;
  isStopping = true;
  children.forEach(killTree);
  process.exit(exitCode);
}

// On Unix, each server leads its own process group, so its whole tree can be stopped.
function start(name, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: 'inherit',
    detached: !isWindows,
  });
  child.on('error', (error) => {
    console.error(`${name} could not start: ${error.message}`);
    stopAll(1);
  });
  child.on('exit', (code) => {
    if (isStopping) return;
    console.error(`${name} stopped, so the other server is stopping too.`);
    stopAll(code ?? 1);
  });
  children.push(child);
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

start(
  'Backend',
  venvPython,
  ['-m', 'flask', '--app', 'wsgi', 'run', '--port', readBackendPort()],
  { cwd: backendDir },
);
start('Frontend', 'npm run dev', [], { cwd: frontendDir, shell: true });
