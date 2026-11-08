import { describe, expect, it } from 'vitest';
import { formatDecimal, formatDuration } from '../../src/utils/formatters';

describe('formatDuration', () => {
  it('shows seconds alone under a minute, and minutes above', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(59)).toBe('59s');
    expect(formatDuration(125)).toBe('2m 5s');
  });
});

describe('formatDecimal', () => {
  it('shows a placeholder for missing values, never a fake zero', () => {
    expect(formatDecimal(null, '%')).toBe('–');
    expect(formatDecimal(0, '%')).toBe('0.0%');
  });
});
