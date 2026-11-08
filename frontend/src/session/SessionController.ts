import { ApiRequestError } from '../controllers/ApiRequestError';
import { RECORDING_PHASES } from '../domain/phaseLabels';
import type { SessionCreated, SessionRecord } from '../types/api';
import type { AppConfig } from '../types/config';
import type {
  IAnalysisPipeline,
  ICamera,
  IFaceDetector,
  ISampleOutbox,
  ISessionApi,
  ISessionController,
} from '../types/contracts';
import type { Sample } from '../types/metrics';
import type {
  OutboxStatus,
  PipelineCallbacks,
  SessionControllerDeps,
  SessionSnapshot,
} from '../types/session';
import { SampleOutbox } from './SampleOutbox';

const CREATE_SESSION_ATTEMPTS = 3;
const FALLBACK_ERROR = 'Something went wrong. Please try again.';

const INITIAL_SNAPSHOT: SessionSnapshot = {
  phase: 'idle',
  notice: null,
  latest: null,
  history: [],
  saveResult: null,
  pending: 0,
  connectionProblem: false,
  permanentError: null,
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SessionController implements ISessionController {
  private snapshot = INITIAL_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private readonly config: AppConfig;
  private readonly api: ISessionApi;
  private readonly camera: ICamera;
  private readonly faceDetector: IFaceDetector;
  private readonly createPipeline: (callbacks: PipelineCallbacks) => IAnalysisPipeline;
  private outbox: ISampleOutbox | null = null;
  private pipeline: IAnalysisPipeline | null = null;
  private video: HTMLVideoElement | null = null;
  private sessionId: string | null = null;
  private samplesProduced = 0;
  private pausedAt = 0;

  constructor(config: AppConfig, deps: SessionControllerDeps) {
    this.config = config;
    this.api = deps.api;
    this.camera = deps.camera;
    this.faceDetector = deps.faceDetector;
    this.createPipeline = deps.createPipeline;

    this.subscribe = this.subscribe.bind(this);
    this.getSnapshot = this.getSnapshot.bind(this);
    this.dispose = this.dispose.bind(this);
    this.handleSample = this.handleSample.bind(this);
    this.handleOutboxStatus = this.handleOutboxStatus.bind(this);
    this.handleCameraEnded = this.handleCameraEnded.bind(this);
    this.pause = this.pause.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleResume = this.handleResume.bind(this);
    this.handlePageHide = this.handlePageHide.bind(this);
  }

  subscribe(listener: () => void): (() => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): SessionSnapshot {
    return this.snapshot;
  }

  preload(): void {
    this.faceDetector.load().catch(() => undefined);
  }

  async start(video: HTMLVideoElement): Promise<void> {
    if (this.snapshot.phase !== 'idle' && this.snapshot.phase !== 'error') return;

    this.video = video;
    this.setSnapshot({ ...INITIAL_SNAPSHOT, phase: 'loading_model' });
    try {
      await this.faceDetector.load();
      this.update({ phase: 'requesting_camera' });
      await this.camera.open(video, this.handleCameraEnded);
      this.update({ phase: 'creating_session' });
      const session = await this.createSessionWithRetry();
      this.beginRecording(session.id, video);
    } catch (error) {
      this.teardown();
      this.update({ phase: 'error', notice: error instanceof Error ? error.message : FALLBACK_ERROR });
    }
  }

  async stop(notice: string | null = null): Promise<void> {
    if (!RECORDING_PHASES.includes(this.snapshot.phase)) return;
    const { outbox, pipeline, sessionId } = this;
    if (!outbox || !pipeline || !sessionId) return;

    this.update({ phase: 'stopping' });
    this.removeLifecycleListeners();
    this.camera.close();
    await pipeline.finish();
    pipeline.dispose();
    this.pipeline = null;

    await outbox.drain();
    const stopped = await this.stopSessionWithRetry(sessionId);
    this.teardown();
    this.update({
      phase: 'idle',
      notice: notice ?? (stopped ? null : 'The session could not be closed on the server.'),
      saveResult: stopped
        ? { saved: stopped.summary.samples_saved, produced: this.samplesProduced }
        : null,
    });
  }

  dispose(): void {
    this.teardown();
  }

  private async createSessionWithRetry(): Promise<SessionCreated> {
    const idempotencyKey = crypto.randomUUID();
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.api.createSession(idempotencyKey);
      } catch (error) {
        const canRetry = error instanceof ApiRequestError && error.retryable;
        if (!canRetry || attempt >= CREATE_SESSION_ATTEMPTS) throw error;
      }
    }
  }

  private async stopSessionWithRetry(sessionId: string): Promise<SessionRecord | null> {
    for (;;) {
      try {
        return await this.api.stopSession(sessionId, this.samplesProduced);
      } catch (error) {
        if (!(error instanceof ApiRequestError && error.retryable)) return null;
        this.update({ connectionProblem: true });
        await wait(this.config.batchIntervalMs);
      }
    }
  }

  private beginRecording(sessionId: string, video: HTMLVideoElement): void {
    this.sessionId = sessionId;
    this.samplesProduced = 0;
    this.outbox = new SampleOutbox(
      {
        send: (samples) => this.api.sendSamples(sessionId, samples),
        sendKeepalive: (samples) => this.api.sendSamplesKeepalive(sessionId, samples),
      },
      { intervalMs: this.config.batchIntervalMs, batchSize: this.config.batchSize },
      this.handleOutboxStatus,
    );
    this.pipeline = this.createPipeline({
      onSample: this.handleSample,
      onPaused: () => this.outbox?.flushKeepalive(),
      onFailure: () => void this.stop('Video analysis stopped unexpectedly.'),
    });

    this.outbox.start();
    this.pipeline.start(video);
    this.addLifecycleListeners();
    this.update({ phase: 'running' });
    if (document.visibilityState === 'hidden') this.pause();
  }

  private handleSample(sample: Sample): void {
    this.samplesProduced += 1;
    this.outbox?.add(sample);
    this.update({
      latest: sample,
      history: [...this.snapshot.history, sample].slice(-this.config.chartWindowSeconds),
    });
  }

  private handleOutboxStatus(status: OutboxStatus): void {
    this.update(status);
  }

  private handleCameraEnded(): void {
    if (this.snapshot.phase === 'running') void this.stop('The camera was disconnected.');
  }

  private pause(): void {
    if (this.snapshot.phase !== 'running') return;
    this.pausedAt = Date.now();
    this.pipeline?.pause();
    this.update({ phase: 'paused' });
  }

  private async resume(): Promise<void> {
    const { video } = this;
    if (this.snapshot.phase !== 'paused' || !video) return;

    if (Date.now() - this.pausedAt > this.config.maxPauseSeconds * 1000) {
      await this.stop('The session ended because it was paused for too long.');
      return;
    }
    try {
      if (!this.camera.isLive()) await this.camera.open(video, this.handleCameraEnded);
    } catch {
      await this.stop('The camera could not be reopened after the pause.');
      return;
    }
    if (this.snapshot.phase !== 'paused') return;
    this.pipeline?.resume(video);
    this.update({ phase: 'running' });
  }

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') this.pause();
    else void this.resume();
  }

  private handleResume(): void {
    if (document.visibilityState === 'visible') void this.resume();
  }

  // A page kept in the back/forward cache may never return, so leaving always ends the session.
  private handlePageHide(): void {
    if (!this.sessionId) return;
    this.outbox?.flushKeepalive();
    this.api.stopSessionKeepalive(this.sessionId, this.samplesProduced);
    this.teardown();
    this.update({ phase: 'idle', notice: 'The session ended because you left the page.' });
  }

  private addLifecycleListeners(): void {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    document.addEventListener('freeze', this.pause);
    document.addEventListener('resume', this.handleResume);
    window.addEventListener('pagehide', this.handlePageHide);
  }

  private removeLifecycleListeners(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    document.removeEventListener('freeze', this.pause);
    document.removeEventListener('resume', this.handleResume);
    window.removeEventListener('pagehide', this.handlePageHide);
  }

  private teardown(): void {
    this.removeLifecycleListeners();
    this.camera.close();
    this.pipeline?.dispose();
    this.outbox?.stop();
    this.pipeline = null;
    this.outbox = null;
    this.sessionId = null;
  }

  private update(partial: Partial<SessionSnapshot>): void {
    this.setSnapshot({ ...this.snapshot, ...partial });
  }

  private setSnapshot(snapshot: SessionSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}
