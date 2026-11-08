import type { IAnalysisEngine } from '../types/contracts';
import type { AnalysisWorkerScope, WorkerInbound } from '../types/worker';
import { AnalysisEngine } from './AnalysisEngine';

const TICK_INTERVAL_MS = 100;

const scope = self as unknown as AnalysisWorkerScope;
let engine: IAnalysisEngine | null = null;

setInterval(() => engine?.tick(), TICK_INTERVAL_MS);

function handleMessage(message: WorkerInbound): void {
  switch (message.type) {
    case 'init':
      engine = new AnalysisEngine(message, (outbound) => scope.postMessage(outbound));
      break;
    case 'frame':
      if (engine) engine.handleFrame(message.bitmap);
      else message.bitmap.close();
      break;
    case 'face':
      engine?.handleFace(message.detected);
      break;
    case 'pause':
      engine?.pause();
      break;
    case 'resume':
      engine?.resume();
      break;
    case 'finish':
      engine?.finish();
      break;
  }
}

scope.onmessage = (event) => handleMessage(event.data);
