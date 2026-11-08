import type { FrameMetrics } from '../types/metrics';

const RED_WEIGHT = 0.299;
const GREEN_WEIGHT = 0.587;
const BLUE_WEIGHT = 0.114;
const CHANNELS = 4;

export function analyzeFrame(
  rgba: Uint8ClampedArray,
  luma: Float32Array,
  previous: Float32Array | null,
): FrameMetrics {
  const pixelCount = luma.length;
  let lumaTotal = 0;
  let differenceTotal = 0;

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * CHANNELS;
    const value =
      RED_WEIGHT * rgba[offset]! + GREEN_WEIGHT * rgba[offset + 1]! + BLUE_WEIGHT * rgba[offset + 2]!;
    luma[pixel] = value;
    lumaTotal += value;
    if (previous) differenceTotal += Math.abs(value - previous[pixel]!);
  }

  return {
    brightness: lumaTotal / pixelCount,
    motion: previous ? differenceTotal / pixelCount : null,
  };
}
