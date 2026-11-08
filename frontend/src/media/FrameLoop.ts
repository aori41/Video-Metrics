import type { IFrameLoop } from '../types/contracts';

export class FrameLoop implements IFrameLoop {
  private cancel: (() => void) | null = null;

  start(video: HTMLVideoElement, onFrame: () => void): void {
    this.stop();
    this.cancel =
      'requestVideoFrameCallback' in video
        ? this.runOnVideoFrames(video, onFrame)
        : this.runOnAnimationFrames(video, onFrame);
  }

  stop(): void {
    this.cancel?.();
    this.cancel = null;
  }

  private runOnVideoFrames(video: HTMLVideoElement, onFrame: () => void): (() => void) {
    let handle = 0;
    function step(): void {
      onFrame();
      handle = video.requestVideoFrameCallback(step);
    }
    handle = video.requestVideoFrameCallback(step);
    return () => video.cancelVideoFrameCallback(handle);
  }

  private runOnAnimationFrames(video: HTMLVideoElement, onFrame: () => void): (() => void) {
    let handle = 0;
    let lastTime = -1;
    function step(): void {
      if (video.currentTime !== lastTime) {
        lastTime = video.currentTime;
        onFrame();
      }
      handle = requestAnimationFrame(step);
    }
    handle = requestAnimationFrame(step);
    return () => cancelAnimationFrame(handle);
  }
}
