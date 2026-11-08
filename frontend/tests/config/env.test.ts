import { afterEach, describe, expect, it, vi } from 'vitest';

describe('appConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('reads thresholds from the environment', async () => {
    vi.stubEnv('VITE_MOTION_MAX', '33');
    vi.resetModules();

    const { appConfig } = await import('../../src/config/env');

    expect(appConfig.thresholds.motionMax).toBe(33);
  });

  it('refuses to start with a value that is not a number', async () => {
    vi.stubEnv('VITE_FPS_MIN', 'fast');
    vi.resetModules();

    await expect(import('../../src/config/env')).rejects.toThrow('VITE_FPS_MIN');
  });
});
