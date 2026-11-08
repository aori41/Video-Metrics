import type { Sample, Thresholds } from './metrics';

export type AnalysisInit = {
  width: number;
  height: number;
  thresholds: Thresholds;
};

export type WorkerInbound =
  | ({ type: 'init' } & AnalysisInit)
  | { type: 'frame'; bitmap: ImageBitmap }
  | { type: 'face'; detected: boolean }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'finish' };

export type WorkerOutbound =
  | { type: 'frame_done' }
  | { type: 'sample'; sample: Sample }
  | { type: 'paused' }
  | { type: 'finished' };

export type AnalysisWorkerScope = {
  postMessage: (message: WorkerOutbound) => void;
  onmessage: ((event: MessageEvent<WorkerInbound>) => void) | null;
};
