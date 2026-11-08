import type { MeasuredValues, Reason, Thresholds, VerdictResult } from '../types/metrics';

export const REASON_LABELS: Record<Reason, string> = {
  no_face: 'No face',
  too_dark: 'Too dark',
  too_bright: 'Too bright',
  hold_still: 'Hold still',
  low_fps: 'Low FPS',
};

function findReason(values: MeasuredValues, limits: Thresholds): Reason | null {
  if (!values.face) return 'no_face';
  if (values.brightness < limits.brightnessMin) return 'too_dark';
  if (values.brightness > limits.brightnessMax) return 'too_bright';
  if (values.motion > limits.motionMax) return 'hold_still';
  if (values.fps < limits.fpsMin) return 'low_fps';
  return null;
}

export function evaluateVerdict(values: MeasuredValues, limits: Thresholds): VerdictResult {
  const reason = findReason(values, limits);
  return { verdict: reason ? 'poor' : 'good', reason };
}
