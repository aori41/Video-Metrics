import { describe, expect, it } from 'vitest';
import { evaluateVerdict } from '../../src/domain/verdict';
import { goodValues as good, limits } from '../helpers/fixtures';

describe('evaluateVerdict', () => {
  it('is good inside every limit, including exact boundaries', () => {
    expect(evaluateVerdict(good, limits).verdict).toBe('good');
    expect(
      evaluateVerdict({ fps: 15, brightness: 60, motion: 20, face: true }, limits).verdict,
    ).toBe('good');
  });

  it('reports each failing metric', () => {
    expect(evaluateVerdict({ ...good, face: false }, limits).reason).toBe('no_face');
    expect(evaluateVerdict({ ...good, brightness: 59 }, limits).reason).toBe('too_dark');
    expect(evaluateVerdict({ ...good, brightness: 201 }, limits).reason).toBe('too_bright');
    expect(evaluateVerdict({ ...good, motion: 21 }, limits).reason).toBe('hold_still');
    expect(evaluateVerdict({ ...good, fps: 14 }, limits).reason).toBe('low_fps');
  });

  it('follows the required priority order', () => {
    const allBad = { fps: 1, brightness: 10, motion: 99, face: false };
    expect(evaluateVerdict(allBad, limits).reason).toBe('no_face');
    expect(evaluateVerdict({ ...allBad, face: true }, limits).reason).toBe('too_dark');
    expect(evaluateVerdict({ ...allBad, face: true, brightness: 100 }, limits).reason).toBe(
      'hold_still',
    );
  });
});
