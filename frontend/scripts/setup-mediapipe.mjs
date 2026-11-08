import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSource = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmTarget = join(root, 'public', 'mediapipe', 'wasm');
const modelPath = join(root, 'public', 'models', 'blaze_face_short_range.tflite');
const modelUrl =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyWasm() {
  if (!(await exists(wasmSource))) return;
  await mkdir(wasmTarget, { recursive: true });
  await cp(wasmSource, wasmTarget, { recursive: true });
}

async function downloadModel() {
  if (await exists(modelPath)) return;
  const response = await fetch(modelUrl);
  if (!response.ok) throw new Error(`Model download failed with status ${response.status}`);
  await mkdir(dirname(modelPath), { recursive: true });
  await writeFile(modelPath, Buffer.from(await response.arrayBuffer()));
}

await copyWasm();
await downloadModel();
