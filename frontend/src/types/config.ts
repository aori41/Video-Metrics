import type { REQUIRED_ENV_KEYS } from '../config/envKeys';
import type { Thresholds } from './metrics';

export type EnvKey = (typeof REQUIRED_ENV_KEYS)[number];

export type AppConfig = {
  apiBaseUrl: string;
  thresholds: Thresholds;
  analysisWidth: number;
  analysisHeight: number;
  faceDetectHz: number;
  faceMinConfidence: number;
  batchIntervalMs: number;
  batchSize: number;
  requestTimeoutMs: number;
  maxPauseSeconds: number;
  chartWindowSeconds: number;
};
