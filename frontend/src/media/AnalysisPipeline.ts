import type { IAnalysisPipeline, IFaceDetector, IFrameLoop } from '../types/contracts';
import type { AppConfig } from '../types/config';
import type { PipelineCallbacks } from '../types/session';
import type { WorkerInbound, WorkerOutbound } from '../types/worker';
import { FrameLoop } from './FrameLoop';

const FINISH_TIMEOUT_MS = 1500;

export class AnalysisPipeline implements IAnalysisPipeline {
  private readonly worker: Worker;
  private readonly frameLoop: IFrameLoop = new FrameLoop();
  private readonly config: AppConfig;
  private readonly faceDetector: IFaceDetector;
  private readonly callbacks: PipelineCallbacks;
  private readonly faceIntervalMs: number;
  private frameInFlight = false;
  private lastFaceAt = 0;
  private resolveFinish: (() => void) | null = null;

  constructor(config: AppConfig, faceDetector: IFaceDetector, callbacks: PipelineCallbacks) {
    this.config = config;
    this.faceDetector = faceDetector;
    this.callbacks = callbacks;
    this.faceIntervalMs = 1000 / config.faceDetectHz;
    this.worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (event: MessageEvent<WorkerOutbound>) => this.handleMessage(event.data);
    this.worker.onerror = () => callbacks.onFailure();
  }

  start(video: HTMLVideoElement): void {
    this.send({
      type: 'init',
      width: this.config.analysisWidth,
      height: this.config.analysisHeight,
      thresholds: this.config.thresholds,
    });
    this.startLoop(video);
  }

  pause(): void {
    this.frameLoop.stop();
    this.send({ type: 'pause' });
  }

  resume(video: HTMLVideoElement): void {
    this.send({ type: 'resume' });
    this.startLoop(video);
  }

  finish(): Promise<void> {
    this.frameLoop.stop();
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, FINISH_TIMEOUT_MS);
      this.resolveFinish = () => {
        clearTimeout(timeout);
        resolve();
      };
      this.send({ type: 'finish' });
    });
  }

  dispose(): void {
    this.frameLoop.stop();
    this.worker.terminate();
  }

  private startLoop(video: HTMLVideoElement): void {
    this.frameLoop.start(video, () => this.handleVideoFrame(video));
  }

  private handleVideoFrame(video: HTMLVideoElement): void {
    this.detectFaceIfDue(video);
    if (this.frameInFlight) return;

    this.frameInFlight = true;
    createImageBitmap(video, {
      resizeWidth: this.config.analysisWidth,
      resizeHeight: this.config.analysisHeight,
      resizeQuality: 'low',
    })
      .then((bitmap) => this.worker.postMessage({ type: 'frame', bitmap }, [bitmap]))
      .catch(() => {
        this.frameInFlight = false;
      });
  }

  private detectFaceIfDue(video: HTMLVideoElement): void {
    const now = performance.now();
    if (now - this.lastFaceAt < this.faceIntervalMs) return;
    this.lastFaceAt = now;
    this.send({ type: 'face', detected: this.faceDetector.detect(video) });
  }

  private handleMessage(message: WorkerOutbound): void {
    switch (message.type) {
      case 'frame_done':
        this.frameInFlight = false;
        break;
      case 'sample':
        this.callbacks.onSample(message.sample);
        break;
      case 'paused':
        this.callbacks.onPaused();
        break;
      case 'finished':
        this.resolveFinish?.();
        break;
    }
  }

  private send(message: WorkerInbound): void {
    this.worker.postMessage(message);
  }
}
