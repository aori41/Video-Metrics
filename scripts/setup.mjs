import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { backendDir, frontendDir, isWindows, venvPython } from './paths.mjs';

// The Windows installer does not add Python to PATH by default.
function findWindowsInstalls() {
  return [join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Python'), process.env.ProgramFiles ?? '']
    .filter(existsSync)
    .flatMap((dir) =>
      readdirSync(dir)
        .filter((name) => /^Python3\d+$/.test(name))
        .map((name) => [join(dir, name, 'python.exe')]),
    );
}

const PYTHON_CANDIDATES = [
  ...(process.env.PYTHON ? [[process.env.PYTHON]] : []),
  ['python3'],
  ['python'],
  ...(isWindows ? [['py', '-3'], ...findWindowsInstalls()] : []),
];
const VERSION_CHECK = 'import sys; print(sys.version_info[:2] >= (3, 12))';
const LOGIN_PLACEHOLDER = 'USER:PASSWORD@';

function fail(message) {
  console.error(`\nSetup failed: ${message}`);
  process.exit(1);
}

function step(title) {
  return console.log(`\n> ${title}`);
}

function runOrFail(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) fail(`${command} ${args.join(' ')}`);
}

function findPython() {
  const found = PYTHON_CANDIDATES.find(([command, ...args]) => {
    const { stdout } = spawnSync(command, [...args, '-c', VERSION_CHECK], { encoding: 'utf8' });
    return stdout?.trim() === 'True';
  });
  if (!found) fail('Python 3.12 or newer was not found. Set PYTHON to its full path.');
  return found;
}

function copyEnvExample(dir) {
  const target = join(dir, '.env');
  if (!existsSync(target)) copyFileSync(join(dir, '.env.example'), target);
}

function setupBackend() {
  if (!existsSync(venvPython)) {
    step('Creating the Python environment');
    const [command, ...args] = findPython();
    runOrFail(command, [...args, '-m', 'venv', '.venv'], backendDir);
  }

  step('Installing backend dependencies');
  runOrFail(
    venvPython,
    ['-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', '-r', 'requirements.txt'],
    backendDir,
  );

  copyEnvExample(backendDir);
  if (readFileSync(join(backendDir, '.env'), 'utf8').includes(LOGIN_PLACEHOLDER)) {
    fail('Set USER and PASSWORD in DATABASE_URL in backend/.env, then run npm run setup again.');
  }

  step('Creating the database and tables if missing');
  runOrFail(venvPython, ['-m', 'app.db.create_database'], backendDir);
}

function setupFrontend() {
  step('Installing frontend dependencies');
  const { status } = spawnSync('npm install --no-audit --no-fund', {
    cwd: frontendDir,
    shell: true,
    stdio: 'inherit',
  });
  if (status !== 0) fail('npm install');

  copyEnvExample(frontendDir);
}

setupBackend();
setupFrontend();
console.log('\nSetup complete. Start the app with: npm run dev');
