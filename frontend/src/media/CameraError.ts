import type { CameraErrorCode } from '../types/session';

const MESSAGES: Record<CameraErrorCode, string> = {
  denied: 'Camera permission was denied. Allow camera access in your browser and try again.',
  not_found: 'No camera was found. Connect a camera and try again.',
  in_use: 'The camera could not be started. It may be in use by another application.',
  insecure: 'The camera is only available over HTTPS.',
  unknown: 'The camera could not be started.',
};

export class CameraError extends Error {
  readonly code: CameraErrorCode;

  constructor(code: CameraErrorCode) {
    super(MESSAGES[code]);
    this.code = code;
  }
}
