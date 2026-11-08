import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { REQUIRED_ENV_KEYS } from './src/config/envKeys.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const missing = REQUIRED_ENV_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) throw new Error(`Missing environment values: ${missing.join(', ')}`);

  return {
    plugins: [react()],
    worker: { format: 'es' },
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  };
});
