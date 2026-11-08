import { analyzeFrame } from '../domain/frameAnalysis';
import { SecondAggregator } from '../domain/SecondAggregator';
import { SessionClock } from '../domain/SessionClock';
import type { IAnalysisEngine, ISecondAggregator, ISessionClock } from '../types/contracts';
import type { Sample } from '../types/metrics';
import type { AnalysisInit, WorkerOutbound } from '../types/worker';

const FRAME_GAP_MS = 1500;

export class AnalysisEngine implements IAnalysisEngine {
  private readonly context: OffscreenCanvasRenderingContext2D;
  private readonly width: number;
  private readonly height: number;
  private readonly clock: ISessionClock;
  private readonly aggregator: ISecondAggregator;
  private readonly post: (message: WorkerOutbound) => void;
  private luma: Float32Array;
  private previousLuma: Float32Array;
  private hasPrevious = false;
  private started = false;
  private paused = false;
  private lastFrameMs = 0;

  constructor(init: AnalysisInit, post: (message: WorkerOutbound) => void) {
    const canvas = new OffscreenCanvas(init.width, init.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas is not available');

    this.context = context;
    this.width = init.width;
    this.height = init.height;
    this.post = post;
    this.luma = new Float32Array(init.width * init.height);
    this.previousLuma = new Float32Array(init.width * init.height);
    this.clock = new SessionClock(
      () => performance.now(),
      () => Date.now(),
    );
    this.aggregator = new SecondAggregator(init.thresholds);
  }

  handleFrame(bitmap: ImageBitmap): void {
    try {
      if (!this.paused) this.analyze(bitmap);
    } finally {
      bitmap.close();
      this.post({ type: 'frame_done' });
    }
  }

  handleFace(detected: boolean): void {
    if (!this.started || this.paused) return;
    this.emit(this.aggregator.addFaceResult(this.clock.elapsedMs(), detected));
  }

  tick(): void {
    if (!this.started || this.paused) return;
    this.emit(this.aggregator.tick(this.clock.elapsedMs()));
  }

  pause(): void {
    this.closeCurrentWindow();
    this.paused = true;
    this.post({ type: 'paused' });
  }

  resume(): void {
    this.paused = false;
    this.hasPrevious = false;
    if (this.started) this.aggregator.beginWindow(this.clock.elapsedMs());
  }

  finish(): void {
    this.closeCurrentWindow();
    this.paused = true;
    this.post({ type: 'finished' });
  }

  private closeCurrentWindow(): void {
    if (this.started && !this.paused) this.emit(this.aggregator.closePartial(this.clock.elapsedMs()));
  }

  private analyze(bitmap: ImageBitmap): void {
    if (!this.started) {
      this.clock.start();
      this.started = true;
    }
    const elapsedMs = this.clock.elapsedMs();
    if (this.hasPrevious && elapsedMs - this.lastFrameMs > FRAME_GAP_MS) {
      this.hasPrevious = false;
      this.aggregator.beginWindow(elapsedMs);
    }

    this.context.drawImage(bitmap, 0, 0, this.width, this.height);
    const { data } = this.context.getImageData(0, 0, this.width, this.height);
    const { brightness, motion } = analyzeFrame(
      data,
      this.luma,
      this.hasPrevious ? this.previousLuma : null,
    );

    [this.luma, this.previousLuma] = [this.previousLuma, this.luma];
    this.hasPrevious = true;
    this.lastFrameMs = elapsedMs;
    this.emit(this.aggregator.addFrame(elapsedMs, brightness, motion));
  }

  private emit(samples: Sample[]): void {
    samples.forEach((sample) => this.post({ type: 'sample', sample }));
  }
}
