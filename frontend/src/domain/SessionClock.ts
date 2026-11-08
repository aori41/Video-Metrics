import type { ISessionClock } from '../types/contracts';

const CLOCK_JUMP_MS = 2000;

export class SessionClock implements ISessionClock {
  private monotonicStart = 0;
  private wallStart = 0;
  private correction = 0;
  private readonly monotonicNow: () => number;
  private readonly wallNow: () => number;

  constructor(monotonicNow: () => number, wallNow: () => number) {
    this.monotonicNow = monotonicNow;
    this.wallNow = wallNow;
  }

  start(): void {
    this.monotonicStart = this.monotonicNow();
    this.wallStart = this.wallNow();
    this.correction = 0;
  }

  // The monotonic clock may stop during system sleep, so large wall clock jumps are added to it.
  elapsedMs(): number {
    const monotonicElapsed = this.monotonicNow() - this.monotonicStart;
    const drift = this.wallNow() - this.wallStart - monotonicElapsed;
    if (drift - this.correction > CLOCK_JUMP_MS) this.correction = drift;
    return monotonicElapsed + this.correction;
  }
}
