import type { ICamera } from '../types/contracts';
import type { CameraErrorCode } from '../types/session';
import { CameraError } from './CameraError';

const ERROR_CODES: Record<string, CameraErrorCode> = {
  NotAllowedError: 'denied',
  SecurityError: 'denied',
  NotFoundError: 'not_found',
  OverconstrainedError: 'not_found',
  NotReadableError: 'in_use',
  AbortError: 'in_use',
};

const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
};

export class Camera implements ICamera {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private onEnded: (() => void) | null = null;

  async open(video: HTMLVideoElement, onEnded: () => void): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('insecure');
    this.close();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
      this.video = video;
      this.onEnded = onEnded;
      this.stream.getVideoTracks().forEach((track) => track.addEventListener('ended', onEnded));
      video.srcObject = this.stream;
      await video.play();
    } catch (error) {
      this.close();
      const name = error instanceof DOMException ? error.name : '';
      throw new CameraError(ERROR_CODES[name] ?? 'unknown');
    }
  }

  close(): void {
    this.stream?.getTracks().forEach((track) => {
      if (this.onEnded) track.removeEventListener('ended', this.onEnded);
      track.stop();
    });
    if (this.video) this.video.srcObject = null;
    this.stream = null;
    this.video = null;
    this.onEnded = null;
  }

  isLive(): boolean {
    return this.stream?.getVideoTracks().some((track) => track.readyState === 'live') ?? false;
  }
}
