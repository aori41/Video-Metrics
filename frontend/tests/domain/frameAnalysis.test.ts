import { describe, expect, it } from 'vitest';
import { analyzeFrame } from '../../src/domain/frameAnalysis';

describe('analyzeFrame', () => {
  it('uses the luma formula and reports no motion on the first frame', () => {
    const rgba = new Uint8ClampedArray([100, 200, 50, 255]);
    const result = analyzeFrame(rgba, new Float32Array(1), null);
    expect(result.brightness).toBeCloseTo(0.299 * 100 + 0.587 * 200 + 0.114 * 50);
    expect(result.motion).toBeNull();
  });

  it('reports the mean absolute luma difference', () => {
    const rgba = new Uint8ClampedArray([10, 10, 10, 255, 20, 20, 20, 255]);
    const previous = new Float32Array([20, 10]);
    expect(analyzeFrame(rgba, new Float32Array(2), previous).motion).toBeCloseTo(10);
  });
});
