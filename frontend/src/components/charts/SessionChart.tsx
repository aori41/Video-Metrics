import { Paper, Stack, Text } from '@mantine/core';
import React, { memo, useMemo } from 'react';
import { appConfig } from '../../config/env';
import type { Sample } from '../../types/metrics';
import { buildChartSeries, buildMetricPanels } from '../../utils/chart';
import MetricPanel from './MetricPanel';
import StatusStrip from './StatusStrip';

type Props = {
  title: string;
  samples: Sample[];
  windowSeconds: number;
};

const SessionChart: React.FC<Props> = ({ title, samples, windowSeconds }) => {
  const series = useMemo(() => buildChartSeries(samples, windowSeconds), [samples, windowSeconds]);
  const panels = useMemo(() => buildMetricPanels(series, appConfig.thresholds), [series]);

  return (
    <Paper withBorder p="md" radius="md">
      <Text fw={600} mb="xs">
        {title}
      </Text>
      <Stack gap="xs">
        <StatusStrip label="Verdict" values={series.good} />
        <StatusStrip label="Face" values={series.face} />
        {panels.map((panel, index) => (
          <MetricPanel
            key={panel.id}
            panel={panel}
            seconds={series.seconds}
            showTimeAxis={index === panels.length - 1}
          />
        ))}
      </Stack>
    </Paper>
  );
};

export default memo(SessionChart);
