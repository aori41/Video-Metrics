import { Box, Group, Text } from '@mantine/core';
import React, { memo, useMemo, useState } from 'react';
import { CHART_PLOT_LEFT_INSET, CHART_PLOT_RIGHT_INSET } from '../../config/chart';
import type { MetricPanelData } from '../../types/metrics';
import { formatDecimal } from '../../utils/formatters';
import MetricPlot from './MetricPlot';

type Props = {
  panel: MetricPanelData;
  seconds: number[];
  showTimeAxis: boolean;
};

const MetricPanel: React.FC<Props> = ({ panel, seconds, showTimeAxis }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const latest = useMemo(
    () => panel.values.filter((value) => value !== null).at(-1) ?? null,
    [panel.values],
  );

  const isHovering = hoverIndex !== null;
  const shownValue = isHovering ? (panel.values[hoverIndex] ?? null) : latest;
  const caption = isHovering ? `at ${seconds[hoverIndex]}s` : 'latest';

  return (
    <Box role="group" aria-label={`${panel.label}, ${panel.hint}`}>
      <Group justify="space-between" pl={CHART_PLOT_LEFT_INSET} pr={CHART_PLOT_RIGHT_INSET}>
        <Group gap="xs" align="baseline">
          <Text size="sm" fw={600}>
            {panel.label}
          </Text>
          <Text size="xs" c="dimmed">
            {panel.hint}
          </Text>
        </Group>
        <Group gap={6} align="baseline">
          <Text size="sm" fw={600}>
            {formatDecimal(shownValue)}
          </Text>
          <Text size="xs" c="dimmed">
            {caption}
          </Text>
        </Group>
      </Group>
      <MetricPlot
        seconds={seconds}
        values={panel.values}
        lowerLimit={panel.lowerLimit}
        upperLimit={panel.upperLimit}
        softMax={panel.softMax}
        showTimeAxis={showTimeAxis}
        onHover={setHoverIndex}
      />
    </Box>
  );
};

export default memo(MetricPanel);
