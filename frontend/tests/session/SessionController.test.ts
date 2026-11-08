import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../src/controllers/ApiRequestError';
import { CameraError } from '../../src/media/CameraError';
import type { AppConfig } from '../../src/types/config';
import type { Sample } from '../../src/types/metrics';
import type { PipelineCallbacks } from '../../src/types/session';
import { SessionController } from '../../src/session/SessionController';
import { sampleAt } from '../helpers/fixtures';

const config: AppConfig = {
  apiBaseUrl: 'http://api.test',
  thresholds: { fpsMin: 15, brightnessMin: 60, brightnessMax: 200, motionMax: 20 },
  analysisWidth: 160,
  analysisHeight: 120,
  faceDetectHz: 10,
  faceMinConfidence: 0.5,
  batchIntervalMs: 2000,
  batchSize: 120,
  requestTimeoutMs: 10000,
  maxPauseSeconds: 300,
  chartWindowSeconds: 3,
};

const video = {} as HTMLVideoElement;

function setup() {
  let callbacks: PipelineCallbacks | null = null;
  const api = {
    createSession: vi.fn().mockResolvedValue({ id: 's1', started_at: 'now' }),
    sendSamples: vi.fn().mockResolvedValue(undefined),
    sendSamplesKeepalive: vi.fn(),
    stopSession: vi.fn().mockResolvedValue({
      id: 's1',
      started_at: 'now',
      ended_at: 'later',
      summary: { samples_saved: 2 },
    }),
    stopSessionKeepalive: vi.fn(),
    listSessions: vi.fn(),
    getSession: vi.fn(),
  };
  const camera = {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    isLive: vi.fn(() => true),
  };
  const faceDetector = { load: vi.fn().mockResolvedValue(undefined), detect: vi.fn() };
  const pipeline = {
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    finish: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
  };
  const controller = new SessionController(config, {
    api,
    camera,
    faceDetector,
    createPipeline: (received) => {
      callbacks = received;
      return pipeline;
    },
  });
  function emitSample(sample: Sample): void {
    return callbacks!.onSample(sample);
  }
  function emitPaused(): void {
    return callbacks!.onPaused();
  }
  return { api, camera, pipeline, controller, emitSample, emitPaused };
}

describe('SessionController', () => {
  let page: EventTarget & { visibilityState: string };
  let browserWindow: EventTarget;

  function setVisibility(state: string): void {
    page.visibilityState = state;
    page.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    browserWindow = new EventTarget();
    vi.stubGlobal('document', page);
    vi.stubGlobal('window', browserWindow);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('opens the camera before creating the session, then records', async () => {
    const { api, camera, controller, pipeline } = setup();
    await controller.start(video);

    expect(camera.open.mock.invocationCallOrder[0]!).toBeLessThan(
      api.createSession.mock.invocationCallOrder[0]!,
    );
    expect(pipeline.start).toHaveBeenCalledWith(video);
    expect(controller.getSnapshot().phase).toBe('running');
  });

  it('shows a clear error and creates no session when the camera is denied', async () => {
    const { api, camera, controller } = setup();
    camera.open.mockRejectedValue(new CameraError('denied'));
    await controller.start(video);

    expect(api.createSession).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'error',
      notice: expect.stringContaining('denied'),
    });
  });

  it('releases the camera when the server cannot create a session', async () => {
    const { api, camera, controller } = setup();
    api.createSession.mockRejectedValue(new ApiRequestError('invalid', 422));
    await controller.start(video);

    expect(camera.close).toHaveBeenCalled();
    expect(controller.getSnapshot().phase).toBe('error');
  });

  it('retries session creation with the same idempotency key', async () => {
    const { api, controller } = setup();
    api.createSession.mockRejectedValueOnce(new ApiRequestError('offline'));
    await controller.start(video);

    const [first, second] = api.createSession.mock.calls;
    expect(first).toEqual(second);
    expect(controller.getSnapshot().phase).toBe('running');
  });

  it('keeps only the chart window in memory, but updates the latest sample', async () => {
    const { controller, emitSample } = setup();
    await controller.start(video);
    [1, 2, 3, 4].forEach((t) => emitSample(sampleAt(t)));

    const { history, latest } = controller.getSnapshot();
    expect(history.map((sample) => sample.t)).toEqual([2, 3, 4]);
    expect(latest?.t).toBe(4);
  });

  it('on Stop, closes the camera, sends remaining samples, then reports the count', async () => {
    const { api, camera, controller, emitSample } = setup();
    await controller.start(video);
    emitSample(sampleAt(1));
    emitSample(sampleAt(2));

    await controller.stop();

    expect(camera.close).toHaveBeenCalled();
    expect(api.sendSamples).toHaveBeenCalledWith('s1', [sampleAt(1), sampleAt(2)]);
    expect(api.stopSession).toHaveBeenCalledWith('s1', 2);
    expect(api.sendSamples.mock.invocationCallOrder[0]!).toBeLessThan(
      api.stopSession.mock.invocationCallOrder[0]!,
    );
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'idle',
      saveResult: { saved: 2, produced: 2 },
    });
  });

  it('ignores a second Start while one is already running', async () => {
    const { api, controller } = setup();

    await Promise.all([controller.start(video), controller.start(video)]);

    expect(api.createSession).toHaveBeenCalledTimes(1);
  });

  it('retries Stop through a network failure', async () => {
    const { api, controller } = setup();
    await controller.start(video);
    api.stopSession.mockRejectedValueOnce(new ApiRequestError('offline'));

    const stopping = controller.stop();
    await vi.advanceTimersByTimeAsync(config.batchIntervalMs);
    await stopping;

    expect(api.stopSession).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().phase).toBe('idle');
  });

  it('tells the user when the server rejects Stop', async () => {
    const { api, controller } = setup();
    await controller.start(video);
    api.stopSession.mockRejectedValue(new ApiRequestError('missing', 404));

    await controller.stop();

    expect(controller.getSnapshot()).toMatchObject({
      phase: 'idle',
      notice: 'The session could not be closed on the server.',
      saveResult: null,
    });
  });

  it('ends the session with a clear message when the camera is disconnected', async () => {
    const { api, camera, controller } = setup();
    await controller.start(video);
    const notifyCameraEnded = camera.open.mock.calls[0]![1] as () => void;

    notifyCameraEnded();
    await vi.advanceTimersByTimeAsync(0);

    expect(api.stopSession).toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'idle',
      notice: 'The camera was disconnected.',
    });
  });

  it('pauses and flushes when hidden, then resumes when visible', async () => {
    const { api, controller, emitPaused, emitSample, pipeline } = setup();
    await controller.start(video);
    emitSample(sampleAt(1));

    setVisibility('hidden');
    emitPaused();
    expect(pipeline.pause).toHaveBeenCalled();
    expect(controller.getSnapshot().phase).toBe('paused');
    expect(api.sendSamplesKeepalive).toHaveBeenCalledWith('s1', [sampleAt(1)]);

    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(pipeline.resume).toHaveBeenCalledWith(video);
    expect(controller.getSnapshot().phase).toBe('running');
  });

  it('ends the session on resume after a long pause', async () => {
    const { api, controller, pipeline } = setup();
    await controller.start(video);

    setVisibility('hidden');
    vi.advanceTimersByTime((config.maxPauseSeconds + 1) * 1000);
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);

    expect(pipeline.resume).not.toHaveBeenCalled();
    expect(api.stopSession).toHaveBeenCalled();
    expect(controller.getSnapshot().phase).toBe('idle');
  });

  it('reopens a camera lost during the pause', async () => {
    const { camera, controller, pipeline } = setup();
    await controller.start(video);
    setVisibility('hidden');
    camera.isLive.mockReturnValue(false);

    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);

    expect(camera.open).toHaveBeenCalledTimes(2);
    expect(pipeline.resume).toHaveBeenCalled();
  });

  it('flushes and sends Stop with keepalive when the tab closes', async () => {
    const { api, controller, emitSample } = setup();
    await controller.start(video);
    emitSample(sampleAt(1));

    browserWindow.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: false }));

    expect(api.sendSamplesKeepalive).toHaveBeenCalledWith('s1', [sampleAt(1)]);
    expect(api.stopSessionKeepalive).toHaveBeenCalledWith('s1', 1);
  });

  it('ends the session when the page enters the back/forward cache', async () => {
    const { api, camera, controller, emitSample, pipeline } = setup();
    await controller.start(video);
    emitSample(sampleAt(1));

    browserWindow.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: true }));

    expect(api.sendSamplesKeepalive).toHaveBeenCalledWith('s1', [sampleAt(1)]);
    expect(api.stopSessionKeepalive).toHaveBeenCalledWith('s1', 1);
    expect(camera.close).toHaveBeenCalled();
    expect(pipeline.dispose).toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'idle',
      notice: 'The session ended because you left the page.',
    });
  });

  it('sends Stop only once if the page is hidden twice', async () => {
    const { api, controller } = setup();
    await controller.start(video);

    browserWindow.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: true }));
    browserWindow.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: true }));

    expect(api.stopSessionKeepalive).toHaveBeenCalledTimes(1);
  });
});
