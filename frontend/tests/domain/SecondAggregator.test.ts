import { describe, expect, it } from 'vitest';
import { SecondAggregator } from '../../src/domain/SecondAggregator';
import { limits } from '../helpers/fixtures';

function feedSecond(aggregator: SecondAggregator, second: number, frames = 10): void {
  for (let frame = 0; frame < frames; frame += 1) {
    const elapsed = second * 1000 + (frame * 1000) / frames;
    aggregator.addFrame(elapsed, 100, 2);
    aggregator.addFaceResult(elapsed, true);
  }
}

describe('SecondAggregator', () => {
  it('combines one second of frames into one sample using real averages', () => {
    const aggregator = new SecondAggregator(limits);
    aggregator.addFrame(0, 100, null);
    aggregator.addFrame(250, 120, 4);
    aggregator.addFrame(500, 140, 2);
    aggregator.addFaceResult(600, false);
    aggregator.addFaceResult(700, true);

    expect(aggregator.tick(1000)).toEqual([
      { t: 1, fps: 3, brightness: 120, motion: 3, face: true, verdict: 'poor', reason: 'low_fps' },
    ]);
  });

  it('reports no face only when no detection found one in the second', () => {
    const aggregator = new SecondAggregator(limits);
    aggregator.addFrame(0, 100, 1);
    aggregator.addFaceResult(100, false);
    expect(aggregator.tick(1000)[0]?.reason).toBe('no_face');
  });

  it('produces no sample for seconds without frames', () => {
    const aggregator = new SecondAggregator(limits);
    feedSecond(aggregator, 0);
    expect(aggregator.tick(1000).map((sample) => sample.t)).toEqual([1]);
    expect(aggregator.tick(5000)).toEqual([]);
    feedSecond(aggregator, 5);
    expect(aggregator.tick(6000).map((sample) => sample.t)).toEqual([6]);
  });

  it('drops a second with no face detection attempt instead of reporting no face', () => {
    const aggregator = new SecondAggregator(limits);
    aggregator.addFrame(0, 100, 1);
    expect(aggregator.tick(1000)).toEqual([]);
  });

  it('calculates FPS of a partial second from its real length and drops short ones', () => {
    const aggregator = new SecondAggregator(limits);
    feedSecond(aggregator, 0, 30);
    aggregator.tick(1000);
    for (let frame = 0; frame < 15; frame += 1) {
      aggregator.addFrame(1000 + frame * 33, 100, 1);
      aggregator.addFaceResult(1000 + frame * 33, true);
    }
    expect(aggregator.closePartial(1500)[0]?.fps).toBe(30);

    const short = new SecondAggregator(limits);
    feedSecond(short, 0, 30);
    short.tick(1000);
    short.addFrame(1100, 100, 1);
    short.addFaceResult(1100, true);
    expect(short.closePartial(1200)).toEqual([]);
  });

  it('never repeats a time value after a quick pause and resume', () => {
    const aggregator = new SecondAggregator(limits);
    feedSecond(aggregator, 0, 30);
    expect(aggregator.closePartial(800).map((sample) => sample.t)).toEqual([1]);
    aggregator.beginWindow(850);
    aggregator.addFrame(860, 100, 1);
    aggregator.addFaceResult(860, true);
    expect(aggregator.tick(1000)).toEqual([]);
    feedSecond(aggregator, 1, 30);
    expect(aggregator.tick(2000).map((sample) => sample.t)).toEqual([2]);
  });
});
