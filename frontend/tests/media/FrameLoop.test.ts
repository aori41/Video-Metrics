import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameLoop } from '../../src/media/FrameLoop';

describe('FrameLoop', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('runs on video frames when the browser supports them', () => {
    let nextFrame: () => void = () => undefined;
    const cancelVideoFrameCallback = vi.fn();
    const video = {
      requestVideoFrameCallback: vi.fn((callback: () => void) => {
        nextFrame = callback;
        return 7;
      }),
      cancelVideoFrameCallback,
    } as unknown as HTMLVideoElement;
    const onFrame = vi.fn();
    const loop = new FrameLoop();

    loop.start(video, onFrame);
    nextFrame();
    nextFrame();
    loop.stop();

    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(cancelVideoFrameCallback).toHaveBeenCalledWith(7);
  });

  it('counts a video frame once when falling back to animation frames', () => {
    let nextPaint: () => void = () => undefined;
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
      nextPaint = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const video = { currentTime: 1 } as HTMLVideoElement;
    const onFrame = vi.fn();
    const loop = new FrameLoop();

    loop.start(video, onFrame);
    nextPaint();
    nextPaint();
    expect(onFrame).toHaveBeenCalledTimes(1);

    video.currentTime = 2;
    nextPaint();
    expect(onFrame).toHaveBeenCalledTimes(2);
    loop.stop();
  });
});
