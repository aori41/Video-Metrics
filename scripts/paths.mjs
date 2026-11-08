import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const isWindows = process.platform === 'win32';
export const backendDir = join(rootDir, 'backend');
export const frontendDir = join(rootDir, 'frontend');
export const venvPython = join(
  backendDir,
  '.venv',
  isWindows ? 'Scripts/python.exe' : 'bin/python',
);
