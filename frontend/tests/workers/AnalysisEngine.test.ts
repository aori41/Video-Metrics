import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sample } from '../../src/types/metrics';
import type { WorkerOutbound } from '../../src/types/worker';
import { AnalysisEngine } from '../../src/workers/AnalysisEngine';
import { limits } from '../helpers/fixtures';

const FRAME_MS = 100;
const WIDTH = 2;
const HEIGHT = 1;
const CHANNELS = 4;

let pixelValue = 100;
const drawImage = vi.fn();

class FakeCanvas {
  getContext() {
    return {
      drawImage,
      getImageData: () => ({
        data: new Uint8ClampedArray(WIDTH * HEIGHT * CHANNELS).fill(pixelValue),
      }),
    };
  }
}

function createBitmap(): ImageBitmap {
  return { close: vi.fn() } as unknown as ImageBitmap;
}

function setup() {
  const messages: WorkerOutbound[] = [];
  const engine = new AnalysisEngine({ width: WIDTH, height: HEIGHT, thresholds: limits }, (message) =>
    messages.push(message),
  );

  function feedFrames(count: number): void {
    for (let frame = 0; frame < count; frame += 1) {
      engine.handleFrame(createBitmap());
      engine.handleFace(true);
      vi.advanceTimersByTime(FRAME_MS);
    }
  }

  function samples(): Sample[] {
    return messages.flatMap((message) => (message.type === 'sample' ? [message.sample] : []));
  }

  return { engine, messages, feedFrames, samples };
}

describe('AnalysisEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    pixelValue = 100;
    drawImage.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('measures one sample from the frames it really processed in a second', () => {
    const { engine, feedFrames, samples } = setup();

    feedFrames(10);
    engine.tick();

    expect(samples()).toEqual([
      { t: 1, fps: 10, brightness: 100, motion: 0, face: true, verdict: 'poor', reason: 'low_fps' },
    ]);
  });

  it('releases every frame and asks for the next one, even while paused', () => {
    const { engine, messages } = setup();
    engine.pause();
    const bitmap = createBitmap();

    engine.handleFrame(bitmap);

    expect(bitmap.close).toHaveBeenCalled();
    expect(drawImage).not.toHaveBeenCalled();
    expect(messages.at(-1)).toEqual({ type: 'frame_done' });
  });

  it('does not count the change across a pause as motion', () => {
    const { engine, feedFrames, samples } = setup();
    feedFrames(9);
    engine.pause();
    vi.advanceTimersByTime(200);

    pixelValue = 200;
    engine.resume();
    feedFrames(9);
    engine.tick();

    expect(samples().at(-1)).toMatchObject({ t: 2, brightness: 200, motion: 0 });
  });

  it('sends the unfinished second before reporting that it finished', () => {
    const { engine, feedFrames, messages } = setup();
    feedFrames(6);

    engine.finish();

    const types = messages.map((message) => message.type).filter((type) => type !== 'frame_done');
    expect(types).toEqual(['sample', 'finished']);
  });
});
