import uPlot from 'uplot';
import {
  CHART_AXIS_WIDTH,
  CHART_LIMIT_DASH,
  CHART_PANEL_HEIGHT,
  CHART_PLOT_BOTTOM_PADDING,
  CHART_PLOT_RIGHT_INSET,
  CHART_PLOT_TOP_PADDING,
  CHART_SECOND_STEPS,
  CHART_SOFT_MAX,
  CHART_SYNC_KEY,
  CHART_TIME_AXIS_HEIGHT,
  CHART_Y_TICK_SPACE,
} from '../config/chart';
import { CHART_COLORS, STATUS_STRIP_COLORS } from '../theme';
import type {
  ChartSeries,
  MetricPanelData,
  MetricPlotSettings,
  Sample,
  Thresholds,
} from '../types/metrics';

// Half a second each side makes every second one equal slice, like the status strips.
const SECOND_EDGE = 0.5;

export function buildChartSeries(samples: Sample[], windowSeconds: number): ChartSeries {
  const lastT = samples.at(-1)?.t ?? 0;
  const end = Math.max(lastT, windowSeconds);
  const byTime = new Map(samples.map((sample) => [sample.t, sample]));
  const series: ChartSeries = { seconds: [], fps: [], brightness: [], motion: [], face: [], good: [] };

  for (let second = end - windowSeconds + 1; second <= end; second += 1) {
    const sample = byTime.get(second);
    series.seconds.push(second);
    series.fps.push(sample?.fps ?? null);
    series.brightness.push(sample?.brightness ?? null);
    series.motion.push(sample?.motion ?? null);
    series.face.push(sample ? sample.face : null);
    series.good.push(sample ? sample.verdict === 'good' : null);
  }
  return series;
}

export function buildMetricPanels(
  series: ChartSeries,
  thresholds: Thresholds,
): MetricPanelData[] {
  return [
    {
      id: 'fps',
      label: 'FPS',
      hint: `Minimum ${thresholds.fpsMin}`,
      values: series.fps,
      lowerLimit: thresholds.fpsMin,
      softMax: CHART_SOFT_MAX.fps,
    },
    {
      id: 'brightness',
      label: 'Brightness',
      hint: `Between ${thresholds.brightnessMin} and ${thresholds.brightnessMax}`,
      values: series.brightness,
      lowerLimit: thresholds.brightnessMin,
      upperLimit: thresholds.brightnessMax,
      softMax: CHART_SOFT_MAX.brightness,
    },
    {
      id: 'motion',
      label: 'Motion',
      hint: `Maximum ${thresholds.motionMax}`,
      values: series.motion,
      upperLimit: thresholds.motionMax,
      softMax: CHART_SOFT_MAX.motion,
    },
  ];
}

function colorOf(value: boolean | null): string {
  if (value === null) return STATUS_STRIP_COLORS.empty;
  return value ? STATUS_STRIP_COLORS.ok : STATUS_STRIP_COLORS.bad;
}

export function buildGradient(values: (boolean | null)[]): string {
  const stops: string[] = [];
  let runStart = 0;
  for (let index = 1; index <= values.length; index += 1) {
    if (index === values.length || values[index] !== values[runStart]) {
      const from = (runStart / values.length) * 100;
      const to = (index / values.length) * 100;
      stops.push(`${colorOf(values[runStart] ?? null)} ${from}% ${to}%`);
      runStart = index;
    }
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export function describeValues(label: string, values: (boolean | null)[]): string {
  const measured = values.filter((value) => value !== null);
  const ok = measured.filter(Boolean).length;
  return `${label}: OK in ${ok} of ${measured.length} measured seconds`;
}

export function metricPlotHeight(showTimeAxis: boolean): number {
  return CHART_PANEL_HEIGHT + (showTimeAxis ? CHART_TIME_AXIS_HEIGHT : 0);
}

function drawLimits(plot: uPlot, lowerLimit?: number, upperLimit?: number): void {
  const { ctx, bbox } = plot;
  const bottom = bbox.top + bbox.height;

  function drawLimit(limit: number, regionEdge: number): void {
    const y = plot.valToPos(limit, 'y', true);
    ctx.fillStyle = CHART_COLORS.outOfLimitFill;
    ctx.fillRect(bbox.left, Math.min(y, regionEdge), bbox.width, Math.abs(regionEdge - y));
    ctx.beginPath();
    ctx.moveTo(bbox.left, y);
    ctx.lineTo(bbox.left + bbox.width, y);
    ctx.stroke();
  }

  ctx.save();
  ctx.strokeStyle = CHART_COLORS.limit;
  ctx.lineWidth = uPlot.pxRatio;
  ctx.setLineDash(CHART_LIMIT_DASH.map((length) => length * uPlot.pxRatio));
  if (lowerLimit !== undefined) drawLimit(lowerLimit, bottom);
  if (upperLimit !== undefined) drawLimit(upperLimit, bbox.top);
  ctx.restore();
}

function buildTimeAxis(showTimeAxis: boolean): uPlot.Axis {
  return {
    stroke: CHART_COLORS.axis,
    grid: { stroke: CHART_COLORS.grid },
    ticks: { show: false },
    incrs: CHART_SECOND_STEPS,
    ...(showTimeAxis
      ? { label: 'Seconds since start', labelSize: 20, size: CHART_TIME_AXIS_HEIGHT - 20 }
      : { size: 0, values: (_plot: uPlot, splits: number[]) => splits.map(() => '') }),
  };
}

export function buildMetricPlotOptions(
  width: number,
  { lowerLimit, upperLimit, softMax, showTimeAxis, onHover }: MetricPlotSettings,
): uPlot.Options {
  return {
    width,
    height: metricPlotHeight(showTimeAxis),
    padding: [
      CHART_PLOT_TOP_PADDING,
      CHART_PLOT_RIGHT_INSET,
      showTimeAxis ? 0 : CHART_PLOT_BOTTOM_PADDING,
      0,
    ],
    legend: { show: false },
    cursor: { y: false, drag: { x: false, y: false }, sync: { key: CHART_SYNC_KEY } },
    scales: {
      x: { time: false, range: (_plot, min, max) => [min - SECOND_EDGE, max + SECOND_EDGE] },
      y: { range: (_plot, _min, max) => [0, Math.max(softMax, max)] },
    },
    axes: [
      buildTimeAxis(showTimeAxis),
      {
        size: CHART_AXIS_WIDTH,
        space: CHART_Y_TICK_SPACE,
        stroke: CHART_COLORS.axis,
        grid: { stroke: CHART_COLORS.grid },
        ticks: { show: false },
      },
    ],
    series: [{}, { stroke: CHART_COLORS.line, width: 2, points: { show: false } }],
    hooks: {
      drawClear: [(plot) => drawLimits(plot, lowerLimit, upperLimit)],
      setCursor: [(plot) => onHover(plot.cursor.idx ?? null)],
    },
  };
}
