import { ApiRequestError } from '../controllers/ApiRequestError';
import type { ISampleOutbox } from '../types/contracts';
import type { Sample } from '../types/metrics';
import type { OutboxOptions, OutboxStatus, OutboxTransport } from '../types/session';

export class SampleOutbox implements ISampleOutbox {
  private readonly transport: OutboxTransport;
  private readonly options: OutboxOptions;
  private readonly onStatus: (status: OutboxStatus) => void;
  private queue: Sample[] = [];
  private inFlight = false;
  private connectionProblem = false;
  private permanentError: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private drainWaiters: (() => void)[] = [];

  constructor(
    transport: OutboxTransport,
    options: OutboxOptions,
    onStatus: (status: OutboxStatus) => void,
  ) {
    this.transport = transport;
    this.options = options;
    this.onStatus = onStatus;
  }

  start(): void {
    this.timer ??= setInterval(() => void this.sendNext(), this.options.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  add(sample: Sample): void {
    this.queue.push(sample);
    this.publish();
  }

  drain(): Promise<void> {
    if (this.isSettled()) return Promise.resolve();
    return new Promise((resolve) => {
      this.drainWaiters.push(resolve);
      void this.sendNext();
    });
  }

  flushKeepalive(): void {
    if (this.queue.length > 0 && !this.permanentError) {
      this.transport.sendKeepalive(this.nextBatch());
    }
  }

  private nextBatch(): Sample[] {
    return this.queue.slice(0, this.options.batchSize);
  }

  private isSettled(): boolean {
    return !this.inFlight && (this.queue.length === 0 || this.permanentError !== null);
  }

  private async sendNext(): Promise<void> {
    if (this.inFlight || this.permanentError || this.queue.length === 0) return;

    this.inFlight = true;
    const batch = this.nextBatch();
    try {
      await this.transport.send(batch);
      this.queue.splice(0, batch.length);
      this.connectionProblem = false;
    } catch (error) {
      this.recordFailure(error);
    } finally {
      this.inFlight = false;
      this.publish();
      this.continueDraining();
    }
  }

  private recordFailure(error: unknown): void {
    if (error instanceof ApiRequestError && error.retryable) {
      this.connectionProblem = true;
    } else {
      this.permanentError = error instanceof Error ? error.message : 'Samples could not be saved';
    }
  }

  private continueDraining(): void {
    if (this.isSettled()) {
      this.drainWaiters.splice(0).forEach((resolve) => resolve());
    } else if (this.drainWaiters.length > 0 && !this.connectionProblem) {
      void this.sendNext();
    }
  }

  private publish(): void {
    this.onStatus({
      pending: this.queue.length,
      connectionProblem: this.connectionProblem,
      permanentError: this.permanentError,
    });
  }
}
