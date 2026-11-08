import type { MeasuredValues, Sample, Thresholds } from '../../src/types/metrics';

export const limits: Thresholds = {
  fpsMin: 15,
  brightnessMin: 60,
  brightnessMax: 200,
  motionMax: 20,
};

export const goodValues: MeasuredValues = { fps: 30, brightness: 120, motion: 2, face: true };

export function sampleAt(t: number): Sample {
  return { ...goodValues, t, verdict: 'good', reason: null };
}
