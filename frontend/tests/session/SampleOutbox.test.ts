import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../src/controllers/ApiRequestError';
import type { Sample } from '../../src/types/metrics';
import type { OutboxStatus } from '../../src/types/session';
import { SampleOutbox } from '../../src/session/SampleOutbox';
import { sampleAt } from '../helpers/fixtures';

const INTERVAL_MS = 2000;

function setup(send: (samples: Sample[]) => Promise<void>, batchSize = 10) {
  const statuses: OutboxStatus[] = [];
  const sendKeepalive = vi.fn();
  const outbox = new SampleOutbox(
    { send, sendKeepalive },
    { intervalMs: INTERVAL_MS, batchSize },
    (status) => statuses.push(status),
  );
  return { outbox, statuses, sendKeepalive, lastStatus: () => statuses.at(-1) };
}

describe('SampleOutbox', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends waiting samples on each tick and clears them after success', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { outbox, lastStatus } = setup(send);
    outbox.start();
    outbox.add(sampleAt(1));
    outbox.add(sampleAt(2));

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(send).toHaveBeenCalledWith([sampleAt(1), sampleAt(2)]);
    expect(lastStatus()?.pending).toBe(0);
  });

  it('keeps failed samples and sends them with new ones, oldest first', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiRequestError('offline'))
      .mockResolvedValue(undefined);
    const { outbox, lastStatus } = setup(send);
    outbox.start();
    outbox.add(sampleAt(1));

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(lastStatus()).toMatchObject({ pending: 1, connectionProblem: true });

    outbox.add(sampleAt(2));
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(send).toHaveBeenLastCalledWith([sampleAt(1), sampleAt(2)]);
    expect(lastStatus()).toMatchObject({ pending: 0, connectionProblem: false });
  });

  it('never runs two requests at once', async () => {
    let finish: () => void = () => undefined;
    const send = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { outbox } = setup(send);
    outbox.start();
    outbox.add(sampleAt(1));

    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 4);
    expect(send).toHaveBeenCalledTimes(1);
    finish();
  });

  it.each([408, 429, 500, 503])('keeps the samples and retries after a %i', async (status) => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiRequestError('busy', status))
      .mockResolvedValue(undefined);
    const { outbox, lastStatus } = setup(send);
    outbox.start();
    outbox.add(sampleAt(1));

    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 2);

    expect(send).toHaveBeenCalledTimes(2);
    expect(lastStatus()?.pending).toBe(0);
  });

  it('stops sending after a client error that a retry cannot fix', async () => {
    const send = vi.fn().mockRejectedValue(new ApiRequestError('invalid', 422));
    const { outbox, lastStatus } = setup(send);
    outbox.start();
    outbox.add(sampleAt(1));

    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3);

    expect(send).toHaveBeenCalledTimes(1);
    expect(lastStatus()).toMatchObject({ pending: 1, permanentError: 'invalid' });
  });

  it('keeps draining through a network failure until the samples are saved', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiRequestError('offline'))
      .mockResolvedValue(undefined);
    const { outbox, lastStatus } = setup(send);
    outbox.start();
    outbox.add(sampleAt(1));

    const drained = outbox.drain();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    await drained;

    expect(send).toHaveBeenCalledTimes(2);
    expect(lastStatus()?.pending).toBe(0);
  });

  it('finishes draining instead of hanging after a permanent error', async () => {
    const { outbox } = setup(vi.fn().mockRejectedValue(new ApiRequestError('invalid', 422)));
    outbox.add(sampleAt(1));

    await expect(outbox.drain()).resolves.toBeUndefined();
  });

  it('drains a backlog larger than one batch, in order', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { outbox } = setup(send, 2);
    [1, 2, 3].forEach((t) => outbox.add(sampleAt(t)));

    await outbox.drain();

    expect(send.mock.calls.map(([batch]) => batch.map((s: Sample) => s.t))).toEqual([[1, 2], [3]]);
  });

  it('keeps samples queued after a keepalive flush, as delivery is not confirmed', () => {
    const { outbox, sendKeepalive, lastStatus } = setup(vi.fn());
    outbox.add(sampleAt(1));
    outbox.flushKeepalive();
    expect(sendKeepalive).toHaveBeenCalledWith([sampleAt(1)]);
    expect(lastStatus()?.pending).toBe(1);
  });
});
