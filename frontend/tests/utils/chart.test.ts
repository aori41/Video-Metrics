import { describe, expect, it } from 'vitest';
import { buildChartSeries, buildMetricPanels } from '../../src/utils/chart';
import type { ChartSeries } from '../../src/types/metrics';
import { limits, sampleAt } from '../helpers/fixtures';

describe('buildChartSeries', () => {
  it('fills missing seconds with gaps', () => {
    const series = buildChartSeries([sampleAt(2)], 3);
    expect(series.seconds).toEqual([1, 2, 3]);
    expect(series.fps).toEqual([null, 30, null]);
    expect(series.good).toEqual([null, true, null]);
  });

  it('keeps only the most recent window', () => {
    expect(buildChartSeries([sampleAt(40)], 30).seconds[0]).toBe(11);
  });
});

describe('buildMetricPanels', () => {
  const series: ChartSeries = {
    seconds: [1],
    fps: [30],
    brightness: [120],
    motion: [4],
    face: [true],
    good: [true],
  };
  const panels = buildMetricPanels(series, limits);
  function panelOf(id: string) {
    return panels.find((panel) => panel.id === id);
  }

  it('gives each metric its own panel and values', () => {
    expect(panels.map((panel) => panel.id)).toEqual(['fps', 'brightness', 'motion']);
    expect(panelOf('brightness')?.values).toEqual([120]);
  });

  it('draws only the limits that apply to each metric', () => {
    expect(panelOf('fps')).toMatchObject({ lowerLimit: 15 });
    expect(panelOf('fps')?.upperLimit).toBeUndefined();
    expect(panelOf('motion')?.lowerLimit).toBeUndefined();
    expect(panelOf('brightness')).toMatchObject({ lowerLimit: 60, upperLimit: 200 });
    expect(panelOf('motion')).toMatchObject({ upperLimit: 20 });
  });
});
