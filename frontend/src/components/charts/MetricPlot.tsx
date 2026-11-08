import { useElementSize } from '@mantine/hooks';
import React, { memo, useEffect, useMemo, useRef } from 'react';
import uPlot from 'uplot';
import type { MetricPlotSettings } from '../../types/metrics';
import { buildMetricPlotOptions, metricPlotHeight } from '../../utils/chart';

type Props = MetricPlotSettings & {
  seconds: number[];
  values: (number | null)[];
};

const INITIAL_WIDTH = 1;
const EMPTY_DATA: uPlot.AlignedData = [[], []];

const MetricPlot: React.FC<Props> = ({
  seconds,
  values,
  lowerLimit,
  upperLimit,
  softMax,
  showTimeAxis,
  onHover,
}) => {
  const { ref: sizeRef, width } = useElementSize();
  const targetRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  const data = useMemo<uPlot.AlignedData>(() => [seconds, values], [seconds, values]);

  const roundedWidth = Math.floor(width);
  const hasWidth = roundedWidth > 0;

  useEffect(() => {
    if (!hasWidth || !targetRef.current) return undefined;

    const options = buildMetricPlotOptions(INITIAL_WIDTH, {
      lowerLimit,
      upperLimit,
      softMax,
      showTimeAxis,
      onHover,
    });
    const plot = new uPlot(options, EMPTY_DATA, targetRef.current);
    plotRef.current = plot;

    return () => {
      plot.destroy();
      plotRef.current = null;
    };
  }, [hasWidth, lowerLimit, upperLimit, softMax, showTimeAxis, onHover]);

  useEffect(() => {
    plotRef.current?.setData(data);
  }, [data, hasWidth, lowerLimit, upperLimit, softMax, showTimeAxis]);

  useEffect(() => {
    if (hasWidth) {
      plotRef.current?.setSize({
        width: roundedWidth,
        height: metricPlotHeight(showTimeAxis)
      });
    }
  }, [hasWidth, roundedWidth, showTimeAxis]);

  return (
    <div ref={sizeRef}>
      <div ref={targetRef} />
    </div>
  );
};

export default memo(MetricPlot);
