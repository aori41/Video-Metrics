import type { AppConfig, EnvKey } from '../types/config';

function readNumber(key: EnvKey): number {
  const value = Number(import.meta.env[key]);
  if (!Number.isFinite(value)) throw new Error(`${key} must be a number`);
  return value;
}

export const appConfig: AppConfig = {
  apiBaseUrl: String(import.meta.env.VITE_API_BASE_URL),
  thresholds: {
    fpsMin: readNumber('VITE_FPS_MIN'),
    brightnessMin: readNumber('VITE_BRIGHTNESS_MIN'),
    brightnessMax: readNumber('VITE_BRIGHTNESS_MAX'),
    motionMax: readNumber('VITE_MOTION_MAX'),
  },
  analysisWidth: readNumber('VITE_ANALYSIS_WIDTH'),
  analysisHeight: readNumber('VITE_ANALYSIS_HEIGHT'),
  faceDetectHz: readNumber('VITE_FACE_DETECT_HZ'),
  faceMinConfidence: readNumber('VITE_FACE_MIN_CONFIDENCE'),
  batchIntervalMs: readNumber('VITE_BATCH_INTERVAL_MS'),
  batchSize: readNumber('VITE_BATCH_SIZE'),
  requestTimeoutMs: readNumber('VITE_REQUEST_TIMEOUT_MS'),
  maxPauseSeconds: readNumber('VITE_MAX_PAUSE_SECONDS'),
  chartWindowSeconds: readNumber('VITE_CHART_WINDOW_SECONDS'),
};
