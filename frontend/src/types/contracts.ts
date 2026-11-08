import type { SessionCreated, SessionDetail, SessionRecord } from './api';
import type { Sample } from './metrics';
import type { SessionSnapshot } from './session';

export interface ISessionClock {
  start: () => void;
  elapsedMs: () => number;
}

export interface ISecondAggregator {
  addFrame: (elapsedMs: number, brightness: number, motion: number | null) => Sample[];
  addFaceResult: (elapsedMs: number, detected: boolean) => Sample[];
  tick: (elapsedMs: number) => Sample[];
  closePartial: (elapsedMs: number) => Sample[];
  beginWindow: (elapsedMs: number) => void;
}

export interface IAnalysisEngine {
  handleFrame: (bitmap: ImageBitmap) => void;
  handleFace: (detected: boolean) => void;
  tick: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
}

export interface ISampleOutbox {
  start: () => void;
  stop: () => void;
  add: (sample: Sample) => void;
  drain: () => Promise<void>;
  flushKeepalive: () => void;
}

export interface ISessionApi {
  createSession: (idempotencyKey: string) => Promise<SessionCreated>;
  sendSamples: (sessionId: string, samples: Sample[]) => Promise<void>;
  sendSamplesKeepalive: (sessionId: string, samples: Sample[]) => void;
  stopSession: (sessionId: string, samplesProduced: number) => Promise<SessionRecord>;
  stopSessionKeepalive: (sessionId: string, samplesProduced: number) => void;
  listSessions: () => Promise<SessionRecord[]>;
  getSession: (sessionId: string) => Promise<SessionDetail>;
}

export interface ICamera {
  open: (video: HTMLVideoElement, onEnded: () => void) => Promise<void>;
  close: () => void;
  isLive: () => boolean;
}

export interface IFaceDetector {
  load: () => Promise<void>;
  detect: (video: HTMLVideoElement) => boolean;
}

export interface IFrameLoop {
  start: (video: HTMLVideoElement, onFrame: () => void) => void;
  stop: () => void;
}

export interface IAnalysisPipeline {
  start: (video: HTMLVideoElement) => void;
  pause: () => void;
  resume: (video: HTMLVideoElement) => void;
  finish: () => Promise<void>;
  dispose: () => void;
}

export interface ISessionController {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => SessionSnapshot;
  preload: () => void;
  start: (video: HTMLVideoElement) => Promise<void>;
  stop: (notice?: string | null) => Promise<void>;
  dispose: () => void;
}
