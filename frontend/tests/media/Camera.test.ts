import { afterEach, describe, expect, it, vi } from 'vitest';
import { Camera } from '../../src/media/Camera';
import { CameraError } from '../../src/media/CameraError';

function createTrack() {
  return { addEventListener: vi.fn(), removeEventListener: vi.fn(), stop: vi.fn(), readyState: 'live' };
}

function createVideo(play = vi.fn().mockResolvedValue(undefined)): HTMLVideoElement {
  return { play, srcObject: null } as unknown as HTMLVideoElement;
}

function stubCamera(getUserMedia: unknown): void {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
}

function grantStream(track: ReturnType<typeof createTrack>) {
  return vi.fn().mockResolvedValue({ getVideoTracks: () => [track], getTracks: () => [track] });
}

describe('Camera', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for the front camera at 640x480 without audio', async () => {
    const getUserMedia = grantStream(createTrack());
    stubCamera(getUserMedia);

    await new Camera().open(createVideo(), vi.fn());

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    });
  });

  it.each([
    ['NotAllowedError', 'denied'],
    ['NotFoundError', 'not_found'],
    ['NotReadableError', 'in_use'],
    ['SomethingElse', 'unknown'],
  ])('turns %s into the %s message', async (name, code) => {
    stubCamera(vi.fn().mockRejectedValue(new DOMException('failed', name)));

    const error = await new Camera().open(createVideo(), vi.fn()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CameraError);
    expect(error).toMatchObject({ code, message: expect.any(String) });
  });

  it('reports that HTTPS is needed when the browser hides the camera API', async () => {
    vi.stubGlobal('navigator', {});

    await expect(new Camera().open(createVideo(), vi.fn())).rejects.toMatchObject({
      code: 'insecure',
    });
  });

  it('releases the camera if the preview cannot start', async () => {
    const track = createTrack();
    stubCamera(grantStream(track));
    const video = createVideo(vi.fn().mockRejectedValue(new DOMException('failed', 'AbortError')));

    await expect(new Camera().open(video, vi.fn())).rejects.toMatchObject({ code: 'in_use' });

    expect(track.stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
  });

  it('stops the tracks and clears the preview on close', async () => {
    const track = createTrack();
    stubCamera(grantStream(track));
    const video = createVideo();
    const camera = new Camera();
    await camera.open(video, vi.fn());
    expect(camera.isLive()).toBe(true);

    camera.close();

    expect(track.stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    expect(camera.isLive()).toBe(false);
  });
});
