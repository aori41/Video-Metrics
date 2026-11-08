import type { MetricTone } from '../types/metrics';

const EMPTY_VALUE = '–';
const SECONDS_PER_MINUTE = 60;

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function formatDecimal(value: number | null, suffix = ''): string {
  return value === null ? EMPTY_VALUE : `${value.toFixed(1)}${suffix}`;
}

export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString();
}

export function toneOf(isReady: boolean, isOk: boolean): MetricTone {
  if (!isReady) return 'idle';
  return isOk ? 'ok' : 'bad';
}
