import { AnalysisPipeline } from '../media/AnalysisPipeline';
import { Camera } from '../media/Camera';
import { FaceDetectorService } from '../media/FaceDetectorService';
import type { AppConfig } from '../types/config';
import type { ISessionApi, ISessionController } from '../types/contracts';
import { SessionController } from './SessionController';

export function createSessionController(
  config: AppConfig,
  api: ISessionApi,
): ISessionController {
  const faceDetector = new FaceDetectorService(config.faceMinConfidence);
  return new SessionController(config, {
    api,
    faceDetector,
    camera: new Camera(),
    createPipeline: (callbacks) => new AnalysisPipeline(config, faceDetector, callbacks),
  });
}
