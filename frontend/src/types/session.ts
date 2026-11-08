import type { IAnalysisPipeline, ICamera, IFaceDetector, ISessionApi } from './contracts';
import type { Sample } from './metrics';

export type SessionPhase =
  | 'idle'
  | 'loading_model'
  | 'requesting_camera'
  | 'creating_session'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'error';

export type CameraErrorCode = 'denied' | 'not_found' | 'in_use' | 'insecure' | 'unknown';

export type SaveResult = {
  saved: number;
  produced: number;
};

export type OutboxStatus = {
  pending: number;
  connectionProblem: boolean;
  permanentError: string | null;
};

export type OutboxOptions = {
  intervalMs: number;
  batchSize: number;
};

export type OutboxTransport = {
  send: (samples: Sample[]) => Promise<void>;
  sendKeepalive: (samples: Sample[]) => void;
};

export type SessionSnapshot = OutboxStatus & {
  phase: SessionPhase;
  notice: string | null;
  latest: Sample | null;
  history: Sample[];
  saveResult: SaveResult | null;
};

export type PipelineCallbacks = {
  onSample: (sample: Sample) => void;
  onPaused: () => void;
  onFailure: () => void;
};

export type SessionControllerDeps = {
  api: ISessionApi;
  camera: ICamera;
  faceDetector: IFaceDetector;
  createPipeline: (callbacks: PipelineCallbacks) => IAnalysisPipeline;
};

export type ApiResource<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

export type SettledResource<T> = {
  load: () => Promise<T>;
  resource: Exclude<ApiResource<T>, { status: 'loading' }>;
};

export type UseSessionControllerResult = {
  snapshot: SessionSnapshot;
  start: (video: HTMLVideoElement) => void;
  stop: () => void;
};
