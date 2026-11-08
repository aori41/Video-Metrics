import type { FaceDetector } from '@mediapipe/tasks-vision';
import type { IFaceDetector } from '../types/contracts';

const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/models/blaze_face_short_range.tflite';
const READY_STATE_HAS_CURRENT_DATA = 2;

export class FaceDetectorService implements IFaceDetector {
  private detector: FaceDetector | null = null;
  private loading: Promise<void> | null = null;
  private lastTimestamp = 0;
  private readonly minConfidence: number;

  constructor(minConfidence: number) {
    this.minConfidence = minConfidence;
  }

  load(): Promise<void> {
    this.loading ??= this.create().catch(() => {
      this.loading = null;
      throw new Error('Face detection could not be loaded. Check the connection and try again.');
    });
    return this.loading;
  }

  detect(video: HTMLVideoElement): boolean {
    if (!this.detector || video.readyState < READY_STATE_HAS_CURRENT_DATA) return false;
    this.lastTimestamp = Math.max(this.lastTimestamp + 1, performance.now());
    return this.detector.detectForVideo(video, this.lastTimestamp).detections.length > 0;
  }

  private async create(): Promise<void> {
    const { FaceDetector: Detector, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    const minDetectionConfidence = this.minConfidence;
    function createWith(delegate: 'GPU' | 'CPU'): Promise<FaceDetector> {
      return Detector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate },
        runningMode: 'VIDEO',
        minDetectionConfidence,
      });
    }

    this.detector = await createWith('GPU').catch(() => createWith('CPU'));
  }
}
