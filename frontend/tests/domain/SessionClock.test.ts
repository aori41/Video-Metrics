import { describe, expect, it } from 'vitest';
import { SessionClock } from '../../src/domain/SessionClock';

describe('SessionClock', () => {
  it('adds time missed during system sleep and never runs backwards', () => {
    let monotonic = 0;
    let wall = 1_000_000;
    const clock = new SessionClock(
      () => monotonic,
      () => wall,
    );
    clock.start();
    monotonic = 1000;
    wall += 1000;
    expect(clock.elapsedMs()).toBe(1000);
    wall += 60_000;
    expect(clock.elapsedMs()).toBe(61_000);
    wall -= 30_000;
    expect(clock.elapsedMs()).toBe(61_000);
  });
});
