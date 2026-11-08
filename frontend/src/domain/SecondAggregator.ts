import type { ISecondAggregator } from '../types/contracts';
import type { BucketAdvance, Sample, SecondBucket, Thresholds } from '../types/metrics';
import { evaluateVerdict } from './verdict';

const MIN_WINDOW_MS = 500;
const MAX_FPS = 120;
const MS_PER_SECOND = 1000;

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export class SecondAggregator implements ISecondAggregator {
  private bucket: SecondBucket | null = null;
  private windowFloorMs = 0;
  private lastEmittedT = 0;
  private readonly thresholds: Thresholds;

  constructor(thresholds: Thresholds) {
    this.thresholds = thresholds;
  }

  addFrame(elapsedMs: number, brightness: number, motion: number | null): Sample[] {
    const { closed, bucket } = this.advance(elapsedMs);
    bucket.frames += 1;
    bucket.brightnessTotal += brightness;
    if (motion !== null) {
      bucket.motionTotal += motion;
      bucket.motionFrames += 1;
    }
    return closed;
  }

  addFaceResult(elapsedMs: number, detected: boolean): Sample[] {
    const { closed, bucket } = this.advance(elapsedMs);
    bucket.faceAttempts += 1;
    bucket.faceDetected ||= detected;
    return closed;
  }

  tick(elapsedMs: number): Sample[] {
    if (!this.bucket || elapsedMs < this.bucket.t * MS_PER_SECOND) return [];
    return this.close(this.bucket.t * MS_PER_SECOND);
  }

  closePartial(elapsedMs: number): Sample[] {
    return this.bucket ? this.close(elapsedMs) : [];
  }

  beginWindow(elapsedMs: number): void {
    this.bucket = null;
    this.windowFloorMs = elapsedMs;
  }

  private advance(elapsedMs: number): BucketAdvance {
    const closed = this.tick(elapsedMs);
    this.bucket ??= this.openBucket(elapsedMs);
    return { closed, bucket: this.bucket };
  }

  private openBucket(elapsedMs: number): SecondBucket {
    const t = Math.floor(elapsedMs / MS_PER_SECOND) + 1;
    return {
      t,
      windowStartMs: Math.max((t - 1) * MS_PER_SECOND, this.windowFloorMs),
      frames: 0,
      brightnessTotal: 0,
      motionTotal: 0,
      motionFrames: 0,
      faceAttempts: 0,
      faceDetected: false,
    };
  }

  private close(windowEndMs: number): Sample[] {
    const bucket = this.bucket;
    this.bucket = null;
    if (!bucket) return [];

    const windowMs = windowEndMs - bucket.windowStartMs;
    const hasRealData = bucket.frames > 0 && bucket.motionFrames > 0 && bucket.faceAttempts > 0;
    if (!hasRealData || windowMs < MIN_WINDOW_MS || bucket.t <= this.lastEmittedT) return [];

    this.lastEmittedT = bucket.t;
    return [this.toSample(bucket, windowMs)];
  }

  private toSample(bucket: SecondBucket, windowMs: number): Sample {
    const values = {
      fps: Math.min((bucket.frames * MS_PER_SECOND) / windowMs, MAX_FPS),
      brightness: bucket.brightnessTotal / bucket.frames,
      motion: bucket.motionTotal / bucket.motionFrames,
      face: bucket.faceDetected,
    };
    return {
      t: bucket.t,
      fps: roundToTenth(values.fps),
      brightness: roundToTenth(values.brightness),
      motion: roundToTenth(values.motion),
      face: values.face,
      ...evaluateVerdict(values, this.thresholds),
    };
  }
}
